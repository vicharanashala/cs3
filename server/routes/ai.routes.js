import express from 'express';
import { query as dbQuery } from '../db/neon.js';
import { searchWithFullText } from '../services/embedding.service.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Lazy Groq client — created only when first LLM call is needed
let _groq = null;
async function getGroq() {
  if (!_groq) {
    // Set OPENAI_API_KEY so the openai SDK's import-time check passes
    process.env.OPENAI_API_KEY = process.env.GROQ_API_KEY;
    const OpenAI = (await import('openai')).default;
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groq;
}

// POST /api/ai/ask - Ask Yaksha AI (PG full-text search + Groq LLM)
router.post('/ask', async (req, res, next) => {
  try {
    const { query: userQuery } = req.body;
    if (!userQuery || typeof userQuery !== 'string') {
      throw new ValidationError('Query is required');
    }

    // Step 1: Full-text search in PostgreSQL — get top 3 matches
    const topFaqs = await searchWithFullText(userQuery, 3);
    const matchedFaq = topFaqs[0] || null;

    let score = matchedFaq ? parseFloat(matchedFaq.rank_score) : 0.0;
    if (isNaN(score)) score = 0.0;

    let answer = null;
    let source = 'escalation';

    if (matchedFaq && score >= 0.7) {
      // Strong match — refine with Groq LLM using all top 3 as context
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
            { role: 'system', content: 'You are a concise FAQ assistant. Answer based on the provided FAQs. If the answer is spread across multiple FAQs, combine them. Keep it friendly and helpful. If the FAQs don\'t fully answer the query, say so honestly.' },
            {
              role: 'user',
              content: `User query: "${userQuery}"\n\nRelevant FAQs:\n${context}`
            }
          ]
        });
        answer = chatCompletion.choices[0].message.content.trim();
      } catch (err) {
        console.error('Groq Chat Completion failed, falling back to short_answer:', err);
        answer = matchedFaq.short_answer || matchedFaq.answer;
      }
    } else if (matchedFaq && score >= 0.1) {
      // Weak match — return short_answer directly
      source = 'db';
      answer = matchedFaq.short_answer || matchedFaq.answer;
    } else {
      // No useful match — escalate
      source = 'escalation';
      answer = null;
    }

    // Log search with best match
    await dbQuery(
      `INSERT INTO search_logs (query_text, matched_faq_id, confidence_score, source) VALUES ($1, $2, $3, $4)`,
      [userQuery, matchedFaq?.id || null, score, source]
    );

    res.status(200).json({
      success: true,
      answer,
      source,
      confidence: score,
      matched_faq_id: matchedFaq?.id || null,
      // Always return top 3 FAQs for display in chat
      related_faqs: topFaqs.map(f => ({
        id: f.id,
        question: f.question,
        short_answer: f.short_answer || f.answer,
        category: f.category,
        confidence: parseFloat(f.rank_score) || 0
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;