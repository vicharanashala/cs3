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

// ─────────────────────────────────────────────
// COMMUNITY MODERATION QUEUE
// ─────────────────────────────────────────────

// GET /api/admin/queue - Moderation queue: spam + unclear community answers (admin-only)
router.get('/queue', adminAuth, async (req, res, next) => {
  try {
    const { tab } = req.query; // 'spam', 'unclear', or 'all'

    let statusFilter = `ca.status IN ('spam', 'unclear')`;
    if (tab === 'spam') statusFilter = `ca.status = 'spam'`;
    else if (tab === 'unclear') statusFilter = `ca.status = 'unclear'`;

    const sql = `
      SELECT ca.id, ca.faq_id, ca.answer_text, ca.yaksha_decision, ca.yaksha_confidence,
             ca.yaksha_reasoning, ca.disagree_count, ca.status, ca.created_at,
             u.username, u.display_name,
             f.question as faq_question, f.short_answer as faq_short_answer
      FROM community_answers ca
      JOIN users u ON ca.user_id = u.id
      JOIN faqs f ON ca.faq_id = f.id
      WHERE ${statusFilter}
      ORDER BY ca.created_at DESC
      LIMIT 50
    `;
    const result = await query(sql);

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/answers/:id - Approve or reject a community answer (admin-only)
router.put('/answers/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject"' });
    }

    if (action === 'approve') {
      await query(
        `UPDATE community_answers SET status = 'approved', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      // Bump user reputation
      const answer = await query('SELECT user_id FROM community_answers WHERE id = $1', [id]);
      if (answer.rows.length > 0) {
        await query('UPDATE users SET reputation = reputation + 1 WHERE id = $1', [answer.rows[0].user_id]);
      }
    } else {
      // Reject = delete the answer entirely (clean archive model)
      await query('DELETE FROM community_answers WHERE id = $1', [id]);
    }

    // Close any related issues
    await query(
      `UPDATE issues SET status = 'resolved' WHERE community_answer_id = $1 AND status = 'open'`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: action === 'approve' ? 'Answer approved and visible to users.' : 'Answer rejected and deleted.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/issues - View all escalated issues (admin-only)
router.get('/issues', adminAuth, async (req, res, next) => {
  try {
    const sql = `
      SELECT i.id, i.faq_id, i.community_answer_id, i.reporter_username,
             i.reason, i.status, i.created_at,
             f.question as faq_question,
             ca.answer_text as community_answer_text,
             u.username as answer_author
      FROM issues i
      LEFT JOIN faqs f ON i.faq_id = f.id
      LEFT JOIN community_answers ca ON i.community_answer_id = ca.id
      LEFT JOIN users u ON ca.user_id = u.id
      ORDER BY i.created_at DESC
      LIMIT 50
    `;
    const result = await query(sql);

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/issues/:id - Resolve an issue (admin-only)
router.put('/issues/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'resolved' or 'dismissed'

    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be "resolved" or "dismissed"' });
    }

    await query('UPDATE issues SET status = $1 WHERE id = $2', [status, id]);

    res.status(200).json({
      success: true,
      message: `Issue marked as ${status}.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;