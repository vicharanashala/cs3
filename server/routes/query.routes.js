import express from 'express';
import OpenAI from 'openai';
import { query as dbQuery, pool } from '../db/neon.js';
import { del } from '../services/cache.service.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// POST /api/query - Submit a new support query
router.post('/', async (req, res, next) => {
  try {
    const { email, subject, description } = req.body;

    if (!subject || !description) {
      throw new ValidationError('Subject and Description are required');
    }

    if (description.length < 20) {
      throw new ValidationError('Description must be at least 20 characters long.');
    }

    const sql = `
      INSERT INTO queries (email, subject, description)
      VALUES ($1, $2, $3)
      RETURNING id, email, subject, description, status, created_at, updated_at
    `;
    const result = await dbQuery(sql, [email || null, subject, description]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/query/:id - Get a query by its ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const sql = `SELECT * FROM queries WHERE id = $1`;
    const result = await dbQuery(sql, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Query not found');
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/query/:id - Update status (triggers auto-FAQ creation upon 'closed')
router.patch('/:id', async (req, res, next) => {
  const client = await pool().connect();
  let updatedRow = null;
  let currentQuery = null;

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'review', 'closed'].includes(status)) {
      throw new ValidationError('Invalid status value. Must be open, review, or closed.');
    }

    await client.query('BEGIN');

    // Retrieve the existing query first
    const selectRes = await client.query('SELECT * FROM queries WHERE id = $1', [id]);
    if (selectRes.rows.length === 0) {
      throw new NotFoundError('Query not found');
    }
    currentQuery = selectRes.rows[0];

    // Update status
    const updateSql = `
      UPDATE queries 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2
      RETURNING *
    `;
    const updateRes = await client.query(updateSql, [status, id]);
    updatedRow = updateRes.rows[0];

    // COMMIT the transaction BEFORE any external API calls
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    return next(error);
  } finally {
    client.release();
  }

  // Send response immediately — don't block on FAQ generation
  res.status(200).json({ success: true, data: updatedRow });

  // Fire-and-forget: Generate FAQ from closed ticket via Groq (outside transaction)
  if (req.body.status === 'closed' && currentQuery && currentQuery.status !== 'closed') {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a technical FAQ generator. Return only valid JSON.' },
          {
            role: 'user',
            content: `Convert this support complaint into a clean FAQ entry.
            Subject: ${currentQuery.subject}
            Description: ${currentQuery.description}
            Return JSON: { "question": string, "answer": string }`
          }
        ]
      });

      const faqData = JSON.parse(response.choices[0].message.content.trim());
      if (faqData && faqData.question && faqData.answer) {
        await dbQuery(
          `INSERT INTO faqs (question, answer, status, is_onboarding_faq) VALUES ($1, $2, 'pending_review', false)`,
          [faqData.question, faqData.answer]
        );
        del('all_faqs');
      }
    } catch (gptErr) {
      console.error('Failed to auto-generate FAQ during query closure:', gptErr.message);
      // Non-blocking — ticket was already closed successfully
    }
  }
});

export default router;
