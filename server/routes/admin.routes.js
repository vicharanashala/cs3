import express from 'express';
import { query } from '../db/neon.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// GET /api/admin/gaps - Identify queries without matching FAQs (admin-only)
router.get('/gaps', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT query_text, COUNT(*) as frequency
      FROM search_logs
      WHERE matched_faq_id IS NULL
      GROUP BY query_text
      ORDER BY frequency DESC
      LIMIT 20;
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/heatmap - Heatmap analysis of categories, confidence, and volume (admin-only)
router.get('/heatmap', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        f.category,
        ROUND(AVG(s.confidence_score)::numeric, 3) as avg_confidence,
        COUNT(*) as volume
      FROM search_logs s
      JOIN faqs f ON s.matched_faq_id = f.id
      GROUP BY f.category
      ORDER BY avg_confidence ASC;
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/popular - Top FAQs by search+vote frequency (public)
router.get('/popular', async (req, res, next) => {
  try {
    const sql = `
      SELECT f.id, f.question, f.short_answer, f.category,
             COUNT(s.id) AS search_count,
             SUM(CASE WHEN s.confidence_score = 1.0 THEN 1 ELSE 0 END) AS upvotes
      FROM faqs f
      LEFT JOIN search_logs s ON s.matched_faq_id = f.id
      WHERE f.status = 'published'
      GROUP BY f.id
      ORDER BY search_count DESC, upvotes DESC
      LIMIT 8
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/rage-sessions - Detect users attempting the same query repeatedly (admin-only)
router.get('/rage-sessions', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        query_text,
        COUNT(*) as attempts,
        MIN(timestamp) as start_time
      FROM search_logs
      WHERE confidence_score < 0.70
      AND timestamp > NOW() - INTERVAL '2 minutes'
      GROUP BY query_text
      HAVING COUNT(*) >= 4
      ORDER BY attempts DESC;
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;