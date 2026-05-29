import express from 'express';
import { query as dbQuery } from '../db/neon.js';
import { searchWithFullText } from '../services/embedding.service.js';
import { ValidationError } from '../middleware/errorHandler.js';
import OpenAI from 'openai';

const router = express.Router();

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/ai/ask - Ask Yaksha AI (PG full-text search + OpenAI LLM)
router.post('/ask', async (req, res, next) => {
  try {
    const { query: userQuery } = req.body;
    if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
      throw new ValidationError('Query is required');
    }

    // Step 1: Full-text search in PostgreSQL — always returns up to 3 FAQs
    const topFaqs = await searchWithFullText(userQuery.trim(), 3);
    const matchedFaq = topFaqs[0] || null;

    let score = matchedFaq ? parseFloat(matchedFaq.rank_score) : 0.0;
    if (isNaN(score) || score < 0) score = 0.0;

    // Yaksha ALWAYS gives an answer — use the best available match
    let answer = matchedFaq ? (matchedFaq.short_answer || matchedFaq.answer) : null;
    let source = matchedFaq ? 'db' : 'escalation';

    if (matchedFaq) {
      if (score >= 0.7) {
        // Strong match — refine with OpenAI LLM using all top 3 as context
        source = 'llm';
        try {
          const context = topFaqs
            .map((f, i) => `FAQ #${i + 1}: "${f.question}" → "${f.short_answer || f.answer}"`)
            .join('\n');
          const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 250,
            messages: [
              {
                role: 'system',
                content:
                  'You are a concise FAQ assistant. Answer in 1-2 sentences based strictly on the provided FAQs. ' +
                  'Combine info from multiple FAQs if needed. If the FAQs don\'t cover the query, say so honestly.',
              },
              {
                role: 'user',
                content: `User query: "${userQuery}"\n\nRelevant FAQs:\n${context}`,
              },
            ],
          });
          answer = chatCompletion.choices[0].message.content.trim();
        } catch (err) {
          console.error('OpenAI LLM call failed, using short_answer:', err);
          answer = matchedFaq.short_answer || matchedFaq.answer;
          source = 'db';
        }
      } else {
        // Weak or padded match — return short_answer directly
        source = 'db';
        answer = matchedFaq.short_answer || matchedFaq.answer;
      }
    }

    // Always log the search event
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
        confidence: Math.round(parseFloat(f.rank_score || 0) * 1000) / 1000,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;