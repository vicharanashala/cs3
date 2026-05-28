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

    // Step 1: Full-text search in PostgreSQL
    const matchedFaq = await searchWithFullText(userQuery);

    let score = matchedFaq ? parseFloat(matchedFaq.rank_score) : 0.0;
    if (isNaN(score)) score = 0.0;

    let answer = null;
    let source = 'escalation';
    let matchedFaqId = null;

    if (matchedFaq && score >= 0.7) {
      // Strong match — refine with Groq LLM
      matchedFaqId = matchedFaq.id;
      source = 'llm';

      try {
        const groq = await getGroq();
        const chatCompletion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 200,
          messages: [
            { role: 'system', content: 'You are a concise FAQ assistant. Answer in one sentence. Be friendly and helpful.' },
            {
              role: 'user',
              content: `User query: "${userQuery}"\nMatched FAQ context:\nQuestion: "${matchedFaq.question}"\nAnswer: "${matchedFaq.answer}"`
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
      matchedFaqId = matchedFaq.id;
      source = 'db';
      answer = matchedFaq.short_answer || matchedFaq.answer;
    } else {
      // No useful match — escalate to Yaksha chat
      source = 'escalation';
      matchedFaqId = null;
      answer = null;
    }

    // Log search
    await dbQuery(
      `INSERT INTO search_logs (query_text, matched_faq_id, confidence_score, source) VALUES ($1, $2, $3, $4)`,
      [userQuery, matchedFaqId, score, source]
    );

    res.status(200).json({ success: true, answer, source, confidence: score, matched_faq_id: matchedFaqId });
  } catch (error) {
    next(error);
  }
});

export default router;