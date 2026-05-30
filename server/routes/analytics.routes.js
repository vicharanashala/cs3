/**
 * Analytics Routes — Admin-Only Time-Series Analytics
 * 
 * Provides aggregated data for dashboard charts:
 * - Search volume trends (30-day)
 * - Confidence score trends (30-day)
 * - Category distribution
 * - Low-confidence categories
 */

import express from 'express';
import { query } from '../db/neon.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// GET /api/admin/analytics/search-trends — Daily search volume (last 30 days)
router.get('/search-trends', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT
        DATE(timestamp) AS date,
        COUNT(*) AS searches
      FROM search_logs
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/analytics/confidence-over-time — Avg confidence by day (last 30 days)
router.get('/confidence-over-time', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT
        DATE(timestamp) AS date,
        ROUND(AVG(confidence_score)::numeric, 3) AS avg_confidence,
        COUNT(*) AS total_queries
      FROM search_logs
      WHERE timestamp >= NOW() - INTERVAL '30 days'
        AND confidence_score IS NOT NULL
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/analytics/top-categories — Search volume by category (pie chart)
router.get('/top-categories', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT
        COALESCE(f.category, 'Uncategorised') AS category,
        COUNT(*) AS volume
      FROM search_logs s
      JOIN faqs f ON s.matched_faq_id = f.id
      GROUP BY f.category
      ORDER BY volume DESC
      LIMIT 10
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/analytics/low-confidence — Weakest categories by avg confidence
router.get('/low-confidence', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT
        COALESCE(f.category, 'Uncategorised') AS category,
        ROUND(AVG(s.confidence_score)::numeric, 3) AS avg_confidence,
        COUNT(*) AS volume
      FROM search_logs s
      JOIN faqs f ON s.matched_faq_id = f.id
      GROUP BY f.category
      HAVING COUNT(*) >= 3
      ORDER BY avg_confidence ASC
      LIMIT 8
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
