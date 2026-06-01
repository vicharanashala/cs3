import express from 'express';
import { query, pool } from '../db/neon.js';
import { get, set, del } from '../services/cache.service.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

// GET /api/faq - Retrieve all published FAQs (cached)
router.get('/', async (req, res, next) => {
  try {
    const cachedData = get('all_faqs');
    if (cachedData) {
      return res.status(200).json({ success: true, data: cachedData });
    }

    const sql = `
      SELECT id, question, answer, short_answer, category, risk_level, is_onboarding_faq, updated_at 
      FROM faqs 
      WHERE status = 'published' 
      ORDER BY created_at DESC
    `;
    const result = await query(sql);
    const rows = result.rows;

    set('all_faqs', rows);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/faq/onboarding - Retrieve first 5 onboarding FAQs
router.get('/onboarding', async (req, res, next) => {
  try {
    const sql = `
      SELECT id, question, answer, short_answer, category 
      FROM faqs 
      WHERE is_onboarding_faq = true AND status = 'published' 
      LIMIT 5
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/faq/:id - Retrieve specific FAQ detail
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT id, question, answer, short_answer, category, risk_level, is_onboarding_faq, status, created_at, updated_at 
      FROM faqs 
      WHERE id = $1
    `;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('FAQ not found');
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/faq/:id/history - Retrieve update history for an FAQ
router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT previous_answer, changed_at 
      FROM faq_history 
      WHERE faq_id = $1 
      ORDER BY changed_at DESC
    `;
    const result = await query(sql, [id]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/faq - Create new FAQ (generates embedding and invalidates cache)
router.post('/', async (req, res, next) => {
  try {
    const { question, answer, short_answer, category, risk_level, is_onboarding_faq } = req.body;

    if (!question || !answer) {
      throw new ValidationError('Question and Answer are required');
    }

    const sql = `
      INSERT INTO faqs (question, answer, short_answer, category, risk_level, is_onboarding_faq)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, question, answer, short_answer, category, risk_level, is_onboarding_faq, status, created_at, updated_at
    `;
    const params = [
      question,
      answer,
      short_answer || null,
      category || 'General',
      risk_level || 'low',
      is_onboarding_faq === true || is_onboarding_faq === 'true'
    ];

    const result = await query(sql, params);
    
    // Invalidate Cache
    del('all_faqs');

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/faq/:id - Update FAQ (records history, regenerates embedding, invalidates cache)
router.put('/:id', async (req, res, next) => {
  const client = await pool().connect();
  try {
    const { id } = req.params;
    const { question, answer, short_answer, category, risk_level, is_onboarding_faq } = req.body;

    if (!question || !answer) {
      throw new ValidationError('Question and Answer are required');
    }

    await client.query('BEGIN');

    // Get current answer to insert into history
    const currentFaqRes = await client.query('SELECT answer FROM faqs WHERE id = $1', [id]);
    if (currentFaqRes.rows.length === 0) {
      throw new NotFoundError('FAQ not found');
    }
    const currentAnswer = currentFaqRes.rows[0].answer;

    // Record history
    await client.query(
      'INSERT INTO faq_history (faq_id, previous_answer) VALUES ($1, $2)',
      [id, currentAnswer]
    );

    const updateSql = `
      UPDATE faqs 
      SET question = $1, answer = $2, short_answer = $3, 
          category = $4, risk_level = $5, is_onboarding_faq = $6, updated_at = NOW() 
      WHERE id = $7
      RETURNING id, question, answer, short_answer, category, risk_level, is_onboarding_faq, status, created_at, updated_at
    `;
    const params = [
      question,
      answer,
      short_answer || null,
      category || 'General',
      risk_level || 'low',
      is_onboarding_faq === true || is_onboarding_faq === 'true',
      id
    ];

    const result = await client.query(updateSql, params);
    
    await client.query('COMMIT');

    // Invalidate Cache
    del('all_faqs');

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/faq/:id/vote - Upvote/Downvote FAQ (logs to search_logs)
router.post('/:id/vote', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { helpful, reason } = req.body;

    const confidenceScore = helpful ? 1.0 : 0.0;
    const logQueryText = helpful ? 'Helpful Upvote' : `Downvote: ${reason || 'unspecified'}`;

    const sql = `
      INSERT INTO search_logs (query_text, matched_faq_id, confidence_score, source)
      VALUES ($1, $2, $3, $4)
    `;
    await query(sql, [logQueryText, id, confidenceScore, 'vote']);

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
