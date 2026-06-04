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
      WHERE s.source != 'vote'
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
      SELECT f.id, f.question, f.answer, f.short_answer, f.category,
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
      AND source != 'vote'
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

// GET /api/admin/queue - View community answers awaiting review
router.get('/queue', adminAuth, async (req, res, next) => {
  try {
    const { hash } = req.query;
    let sql = `
      SELECT c.*, f.question, f.answer as current_answer
      FROM community_answers c
      JOIN faqs f ON c.faq_id = f.id
      WHERE c.yaksha_decision IN ('admin_review', 'rejected', 'spam')
    `;
    const params = [];
    
    if (hash) {
      sql += ` AND c.hash_id = $1`;
      params.push(hash);
    }
    
    sql += ` ORDER BY c.created_at DESC`;
    
    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/queue/:id - Approve or reject community answer
router.put('/queue/:id', adminAuth, async (req, res, next) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const answerId = req.params.id;

    if (action === 'approve') {
      const getRes = await query('SELECT faq_id, answer_text FROM community_answers WHERE id = $1', [answerId]);
      if (getRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      
      const { faq_id, answer_text } = getRes.rows[0];
      const faqRes = await query('SELECT answer FROM faqs WHERE id = $1', [faq_id]);
      const officialAnswer = faqRes.rows[0].answer;
      
      await query(`INSERT INTO faq_history (faq_id, previous_answer) VALUES ($1, $2)`, [faq_id, officialAnswer]);
      
      // Update FAQ (only full answer to avoid breaking short_answer char limits with markdown)
      await query(`UPDATE faqs SET answer = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [answer_text, faq_id]);
      
      await query(`UPDATE community_answers SET yaksha_decision = 'approved' WHERE id = $1`, [answerId]);
      
      // Invalidate Cache
      import('../services/cache.service.js').then(m => m.del('all_faqs')).catch(e => console.error(e));
    } else {
      await query(`UPDATE community_answers SET yaksha_decision = 'spam' WHERE id = $1`, [answerId]);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/community/:hash - Delete/revert by hash
router.delete('/community/:hash', adminAuth, async (req, res, next) => {
  try {
    await query(`DELETE FROM community_answers WHERE hash_id = $1`, [req.params.hash]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
// GET /api/admin/queries - Get all support queries
router.get('/queries', adminAuth, async (req, res, next) => {
  try {
    const sql = `SELECT * FROM queries ORDER BY created_at DESC`;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/queries/:id/public - Toggle public visibility for a query
router.patch('/queries/:id/public', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_public } = req.body;
    const sql = `UPDATE queries SET is_public = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const result = await query(sql, [is_public, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;