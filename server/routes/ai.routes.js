import express from 'express';
import { query as dbQuery } from '../db/neon.js';
import { searchWithVectors } from '../services/embedding.service.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Lazy Groq client
let _groq = null;
async function getGroq() {
  if (!_groq) {
    const OpenAI = (await import('openai')).default;
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groq;
}

// GET /api/ai/models — probe Groq for available embedding + chat models
router.get('/models', async (req, res, next) => {
  try {
    const groq = await getGroq();
    const modelList = await groq.models.list();
    const all = modelList.data || [];
    const embeddings = all.filter(m => m.id.includes('embedding'));
    const chats = all.filter(m =>
      m.id.includes('llama') || m.id.includes('mixtral') || m.id.includes('qwen')
    );
    res.json({ embeddings, chats, all: all.map(m => m.id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/ask — 3-tier confidence pipeline via pgvector + Groq
router.post('/ask', async (req, res, next) => {
  try {
    const { query: userQuery } = req.body;
    if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
      throw new ValidationError('Query is required');
    }

    // Step 1: Vector search with temporal decay → get top match
    const topFaqs = await searchWithVectors(userQuery.trim(), 3);
    const matchedFaq = topFaqs[0] || null;

    let score = matchedFaq ? parseFloat(matchedFaq.confidence_score) : 0.0;
    if (isNaN(score) || score < 0) score = 0.0;

    let answer = null;
    let source = 'escalation';

    // Step 2: 3-tier confidence routing
    if (matchedFaq && score >= 0.96) {
      // Tier 1 — High confidence: direct DB answer
      source = 'db';
      answer = matchedFaq.short_answer || matchedFaq.answer;
    } else if (matchedFaq && score >= 0.70) {
      // Tier 2 — Medium confidence: LLM refinement via Groq
      source = 'llm';
      try {
        const groq = await getGroq();
        const context = topFaqs
          .map((f, i) => `FAQ #${i + 1}: "${f.question}" → "${f.short_answer || f.answer}"`)
          .join('\n');

        const chatCompletion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 250,
          messages: [
            {
              role: 'system',
              content:
                'You are a concise FAQ assistant. Answer in one sentence. ' +
                'Answer based strictly on the provided FAQs. Combine info from multiple ' +
                'FAQs if needed. If the FAQs do not cover the query, say so honestly.',
            },
            {
              role: 'user',
              content:
                `User query: "${userQuery}"\n\nRelevant FAQs:\n${context}`,
            },
          ],
        });
        answer = chatCompletion.choices[0].message.content.trim();
      } catch (llmErr) {
        console.error('Groq LLM call failed, falling back to short_answer:', llmErr);
        answer = matchedFaq.short_answer || matchedFaq.answer;
        source = 'db';
      }
    } else {
      // Tier 3 — Low confidence: escalate to support ticket
      source = 'escalation';
      answer = null;
    }

    // Step 3: Always log the search event
    await dbQuery(
      `INSERT INTO search_logs (query_text, matched_faq_id, confidence_score, source)
       VALUES ($1, $2, $3, $4)`,
      [userQuery.trim(), matchedFaq?.id || null, score, source]
    );

    res.status(200).json({
      success: true,
      answer,
      source,
      confidence: Math.round(score * 1000) / 1000,
      matched_faq_id: matchedFaq?.id || null,
      related_faqs: topFaqs.map((f) => ({
        id: f.id,
        question: f.question,
        short_answer: f.short_answer || f.answer,
        category: f.category,
        confidence: Math.round(parseFloat(f.confidence_score || 0) * 1000) / 1000,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;