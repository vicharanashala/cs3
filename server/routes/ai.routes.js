import express from 'express';
import { query as dbQuery } from '../db/neon.js';
import { searchWithFullText } from '../services/embedding.service.js';
import { ValidationError } from '../middleware/errorHandler.js';
import OpenAI from 'openai';

const router = express.Router();

// Lazy LLM client — uses OPENAI_API_KEY + OPENAI_BASE_URL from .env
let _llm = null;
function getLLM() {
  if (!_llm) {
    _llm = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
  return _llm;
}

const LLM_MODEL = process.env.OPENAI_MODEL || 'llama-3.1-8b-instant';

// POST /api/ai/ask — 3-tier confidence pipeline via PG full-text + Groq LLM
router.post('/ask', async (req, res, next) => {
  try {
    const { query: userQuery } = req.body;
    if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
      throw new ValidationError('Query is required');
    }

    // Step 1: Full-text search → get top matches
    const topFaqs = await searchWithFullText(userQuery.trim(), 3);
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
    } else if (matchedFaq && score >= 0.01) {
      // Tier 2 — Medium confidence: LLM refinement via Groq
      source = 'llm';
      try {
        const llm = getLLM();
        const context = topFaqs
          .map((f, i) => `FAQ #${i + 1}: "${f.question}" → "${f.short_answer || f.answer}"`)
          .join('\n');

        const chatCompletion = await llm.chat.completions.create({
          model: LLM_MODEL,
          max_tokens: 300,
          messages: [
            {
              role: 'system',
              content:
                'You are Yaksha, a friendly and knowledgeable assistant for the VINS/Samagama community. ' +
                'Help users find answers using the FAQs provided below. Be warm, approachable, and conversational — like a helpful friend. ' +
                'If the FAQs cover the question, give a clear helpful answer combining relevant info. ' +
                'If they don\'t fully cover it, be honest but encouraging — suggest they ask the community or raise a question. ' +
                'Keep answers clear, helpful, and under 3-4 sentences. Use a friendly tone with occasional emojis. ' +
                'Never be robotic or overly formal.',
            },
            {
              role: 'user',
              content: `User query: "${userQuery}"\n\nRelevant FAQs:\n${context}`,
            },
          ],
        });
        answer = chatCompletion.choices[0].message.content.trim();
      } catch (llmErr) {
        console.error('LLM call failed, falling back to short_answer:', llmErr.message);
        answer = matchedFaq.short_answer || matchedFaq.answer;
        source = 'db';
      }
    } else {
      // Tier 3 — Low confidence / no match: still try to give the best DB answer
      source = 'db';
      answer = matchedFaq
        ? (matchedFaq.short_answer || matchedFaq.answer)
        : 'I could not find a matching FAQ. Please try rephrasing your question or raise a ticket for human support.';
    }

    // Step 3: Log the search event
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