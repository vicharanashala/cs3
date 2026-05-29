/**
 * Community Routes - Community-Driven Yaksha + UGC (v1 Simplified)
 *
 * No user registration required. Uses anonymous visitor_id from client.
 * Core flow: Disagree → Submit better answer → Yaksha evaluates → Admin queue
 */

import express from 'express';
import { query } from '../db/neon.js';
import { evaluateAnswer } from '../services/yaksha.service.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * Get or create an anonymous user from a visitor_id.
 * No registration required - auto-creates on first submission.
 */
async function getOrCreateVisitor(visitorId, displayName) {
  const username = visitorId || `anon-${Date.now()}`;
  const name = displayName || 'Anonymous';

  const sql = `
    INSERT INTO users (username, display_name)
    VALUES ($1, $2)
    ON CONFLICT (username) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, users.display_name)
    RETURNING id, username, display_name, reputation
  `;
  const result = await query(sql, [username, name]);
  return result.rows[0];
}

// ─────────────────────────────────────────────
// POST /api/community/answers - Submit a better answer (Yaksha evaluates)
// Core v1 flow: User disagrees → submits their answer → Yaksha gates it
// ─────────────────────────────────────────────
router.post('/answers', async (req, res, next) => {
  try {
    const { faq_id, answer_text, visitor_id, display_name, comment } = req.body;

    if (!faq_id || !answer_text) {
      throw new ValidationError('faq_id and answer_text are required');
    }

    if (answer_text.trim().length < 10) {
      throw new ValidationError('Answer must be at least 10 characters');
    }

    // 1. Get or create anonymous visitor
    const user = await getOrCreateVisitor(visitor_id, display_name);

    // 2. Get the official FAQ
    const faqResult = await query(
      'SELECT id, question, answer, short_answer FROM faqs WHERE id = $1 AND status = $2',
      [faq_id, 'published']
    );
    if (faqResult.rows.length === 0) {
      throw new NotFoundError('FAQ not found');
    }
    const faq = faqResult.rows[0];

    // 3. Get previously approved community answers for context
    const historyResult = await query(
      `SELECT ca.answer_text, u.username
       FROM community_answers ca
       JOIN users u ON ca.user_id = u.id
       WHERE ca.faq_id = $1 AND ca.status = 'approved'
       ORDER BY ca.created_at DESC
       LIMIT 10`,
      [faq_id]
    );

    // 4. Yaksha evaluates the submission
    const evaluation = await evaluateAnswer(
      answer_text.trim(),
      faq.answer || faq.short_answer,
      faq.question,
      historyResult.rows
    );

    // 5. Map decision to status
    let status;
    if (evaluation.decision === 'approved' && evaluation.confidence >= 0.80) {
      status = 'approved';
    } else if (evaluation.decision === 'spam' && evaluation.confidence >= 0.85) {
      status = 'spam';
    } else {
      status = 'unclear';
    }

    // 6. Store the submission
    const contextUsed = JSON.stringify({
      official_answer_length: (faq.answer || '').length,
      approved_history_count: historyResult.rows.length,
      user_comment: comment || null,
    });

    const insertSql = `
      INSERT INTO community_answers (faq_id, user_id, answer_text, yaksha_decision, yaksha_confidence, yaksha_reasoning, context_used, status)
      VALUES ($1, $2, $3, $4::yaksha_decision, $5, $6, $7, $8)
      RETURNING id, faq_id, answer_text, yaksha_decision, yaksha_confidence, yaksha_reasoning, status, created_at
    `;
    const insertResult = await query(insertSql, [
      faq_id,
      user.id,
      answer_text.trim(),
      evaluation.decision,
      evaluation.confidence,
      evaluation.reasoning,
      contextUsed,
      status,
    ]);

    // 7. Bump reputation if approved
    if (status === 'approved') {
      await query('UPDATE users SET reputation = reputation + 1 WHERE id = $1', [user.id]);
    }

    res.status(201).json({
      success: true,
      data: {
        ...insertResult.rows[0],
        display_name: user.display_name,
      },
      evaluation: {
        decision: evaluation.decision,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/community/faq/:id/answers - Get approved answers for a FAQ
// ─────────────────────────────────────────────
router.get('/faq/:id/answers', async (req, res, next) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT ca.id, ca.answer_text, ca.yaksha_confidence, ca.yaksha_decision,
             ca.disagree_count, ca.created_at,
             u.username, u.display_name, u.reputation
      FROM community_answers ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.faq_id = $1 AND ca.status = 'approved'
      ORDER BY ca.created_at DESC
    `;
    const result = await query(sql, [id]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/community/answers/:id/disagree - 1-click disagree escalation
// ─────────────────────────────────────────────
router.post('/answers/:id/disagree', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, visitor_id } = req.body;

    if (!reason || reason.trim().length < 3) {
      throw new ValidationError('Reason is required (at least 3 characters)');
    }

    // Check answer exists
    const answerResult = await query(
      'SELECT id, faq_id FROM community_answers WHERE id = $1',
      [id]
    );
    if (answerResult.rows.length === 0) {
      throw new NotFoundError('Community answer not found');
    }
    const answer = answerResult.rows[0];

    // Increment disagree count
    await query(
      'UPDATE community_answers SET disagree_count = disagree_count + 1, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Create issue (auto-escalation)
    const issueSql = `
      INSERT INTO issues (community_answer_id, faq_id, reporter_username, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING id, status, created_at
    `;
    const issueResult = await query(issueSql, [
      id,
      answer.faq_id,
      visitor_id || 'anonymous',
      reason.trim(),
    ]);

    res.status(201).json({
      success: true,
      message: 'Flagged for admin review.',
      data: issueResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/community/issues - Create standalone issue / suggest new FAQ
// ─────────────────────────────────────────────
router.post('/issues', async (req, res, next) => {
  try {
    const { faq_id, reason, visitor_id, suggested_question } = req.body;

    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('Reason must be at least 5 characters');
    }

    const sql = `
      INSERT INTO issues (faq_id, reporter_username, reason, suggested_question)
      VALUES ($1, $2, $3, $4)
      RETURNING id, status, created_at
    `;
    const result = await query(sql, [
      faq_id || null,
      visitor_id || 'anonymous',
      reason.trim(),
      suggested_question || null,
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/community/issues - List open issues (searchable)
// ─────────────────────────────────────────────
router.get('/issues', async (req, res, next) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT i.id, i.faq_id, i.community_answer_id, i.reporter_username,
             i.reason, i.status, i.created_at, i.suggested_question,
             f.question as faq_question
      FROM issues i
      LEFT JOIN faqs f ON i.faq_id = f.id
      WHERE i.status = 'open'
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ` AND (i.reason ILIKE $1 OR f.question ILIKE $1)`;
      params.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY i.created_at DESC LIMIT 50`;

    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
