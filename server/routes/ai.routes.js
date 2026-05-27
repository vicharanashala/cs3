import express from 'express';
import OpenAI from 'openai';
import { query as dbQuery } from '../db/neon.js';
import { generateEmbedding } from '../services/embedding.service.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder-key-for-now',
});

// POST /api/ai/ask - Ask Yaksha AI (handles semantic vector search & OpenAI answering)
router.post('/ask', async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Query is required');
    }

    // Step 1: Generate query embedding
    const embedding = await generateEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;

    // Step 2: Execute exact SQL with temporal decay applied
    const sql = `
      SELECT 
        id, question, answer, short_answer, category, updated_at,
        (1 - (embedding <=> $1::vector)) * 
        (1 - (0.01 * GREATEST(0, DATE_PART('day', NOW() - updated_at) - 60))) 
        AS confidence_score
      FROM faqs
      WHERE status = 'published'
      ORDER BY confidence_score DESC
      LIMIT 1
    `;
    
    const result = await dbQuery(sql, [embeddingStr]);
    const matchedFaq = result.rows.length > 0 ? result.rows[0] : null;
    let score = matchedFaq ? parseFloat(matchedFaq.confidence_score) : 0.0;

    if (isNaN(score)) {
      score = 0.0;
    }

    let answer = null;
    let source = 'escalation';
    let matchedFaqId = null;

    // Step 3: Apply score thresholds
    if (matchedFaq && score >= 0.96) {
      answer = matchedFaq.answer;
      source = 'db';
      matchedFaqId = matchedFaq.id;
    } else if (matchedFaq && score >= 0.70 && score < 0.96) {
      matchedFaqId = matchedFaq.id;
      source = 'llm';

      try {
        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          max_tokens: 30,
          messages: [
            { role: 'system', content: 'You are a concise FAQ assistant. Answer in one sentence.' },
            { 
              role: 'user', 
              content: `User query: "${query}"\nMatched FAQ context:\nQuestion: "${matchedFaq.question}"\nAnswer: "${matchedFaq.answer}"` 
            }
          ]
        });
        answer = chatCompletion.choices[0].message.content.trim();
      } catch (err) {
        console.error('OpenAI Chat Completion failed, falling back to database short_answer:', err);
        answer = matchedFaq.short_answer || matchedFaq.answer;
      }
    } else {
      // score < 0.70
      source = 'escalation';
      matchedFaqId = null;
      answer = null;
    }

    // Always insert search log
    const logSql = `
      INSERT INTO search_logs (query_text, matched_faq_id, confidence_score, source)
      VALUES ($1, $2, $3, $4)
    `;
    await dbQuery(logSql, [query, matchedFaqId, score, source]);

    res.status(200).json({
      success: true,
      answer,
      source,
      confidence: score
    });
  } catch (error) {
    next(error);
  }
});

export default router;
