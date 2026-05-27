import express from 'express';
import { query } from '../db/neon.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// Apply adminAuth middleware to ALL routes in this file
router.use(adminAuth);

// GET /api/admin/gaps - Identify queries without matching FAQs
router.get('/gaps', async (req, res, next) => {
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

// GET /api/admin/heatmap - Heatmap analysis of categories, confidence, and volume
router.get('/heatmap', async (req, res, next) => {
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

// GET /api/admin/rage-sessions - Detect users attempting the same query repeatedly
router.get('/rage-sessions', async (req, res, next) => {
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
