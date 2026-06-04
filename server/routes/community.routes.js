import express from 'express';
import { query } from '../db/neon.js';
import { evaluateAnswer, generateHashId } from '../services/yaksha.service.js';

const router = express.Router();

router.post('/suggest', async (req, res, next) => {
  try {
    const { faq_id, query_id, answer_text, contributor_email } = req.body;
    
    if ((!faq_id && !query_id) || !answer_text || !contributor_email) {
      return res.status(400).json({ error: 'faq_id or query_id, answer_text, and contributor_email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contributor_email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    let officialAnswer = null;
    let targetQuestion = null;
    let isQuery = false;

    if (faq_id) {
      const faqRes = await query('SELECT question, answer FROM faqs WHERE id = $1', [faq_id]);
      if (faqRes.rows.length === 0) return res.status(404).json({ error: 'FAQ not found' });
      officialAnswer = faqRes.rows[0].answer;
      targetQuestion = faqRes.rows[0].question;
    } else if (query_id) {
      const queryRes = await query('SELECT subject, description FROM queries WHERE id = $1', [query_id]);
      if (queryRes.rows.length === 0) return res.status(404).json({ error: 'Query not found' });
      officialAnswer = queryRes.rows[0].description; // Give context to AI
      targetQuestion = queryRes.rows[0].subject;
      isQuery = true;
    }

    // 2. Yaksha Gatekeeper Evaluation
    const evaluation = await evaluateAnswer(answer_text, officialAnswer, targetQuestion, isQuery);
    
    // Trust System (Tier 2 Privileges)
    const trustRes = await query(
      `SELECT COUNT(*) as approved_count FROM community_answers WHERE contributor_email = $1 AND yaksha_decision = 'approved'`, 
      [contributor_email]
    );
    const approvedCount = parseInt(trustRes.rows[0].approved_count, 10);

    let finalDecision = evaluation.decision;
    let finalReasoning = evaluation.reasoning;

    if (finalDecision === 'admin_review' && approvedCount >= 5) {
      finalDecision = 'approved';
      finalReasoning = `[Tier 2 Auto-Publish Privilege] Overrode Yaksha's 'admin_review' due to user trust level. Original reasoning: ${evaluation.reasoning}`;
    }

    const hashId = generateHashId();

    // Generate a display name from email (e.g. john@example.com -> john)
    const displayName = contributor_email.split('@')[0];

    // 3. Store in community_answers
    const insertRes = await query(
      `INSERT INTO community_answers 
      (faq_id, query_id, contributor_name, contributor_email, answer_text, hash_id, yaksha_decision, yaksha_confidence, yaksha_reasoning) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [faq_id || null, query_id || null, displayName, contributor_email, answer_text, hashId, finalDecision, evaluation.confidence, finalReasoning]
    );

    // 4. Direct-Write Logic if Approved
    if (finalDecision === 'approved') {
      if (faq_id) {
        // Store old in history
        await query(
          `INSERT INTO faq_history (faq_id, previous_answer) VALUES ($1, $2)`,
          [faq_id, officialAnswer]
        );
        
        // Update FAQ
        await query(
          `UPDATE faqs SET answer = $1, short_answer = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [answer_text, faq_id]
        );
      } else if (query_id) {
        // If it's a query, we could auto-convert it to an FAQ or just mark it closed.
        // Let's close the query since it was successfully answered by the community.
        await query(
          `UPDATE queries SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [query_id]
        );
      }
    }

    res.status(201).json({
      success: true,
      decision: finalDecision,
      hash_id: hashId,
      reasoning: finalReasoning
    });

  } catch (error) {
    next(error);
  }
});

// Endpoint to get all approved community contributions for the frontend showcase
router.get('/contributions', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.id, c.hash_id, c.answer_text, c.contributor_name, c.yaksha_confidence, c.created_at, COALESCE(f.question, q.subject) as question 
       FROM community_answers c
       LEFT JOIN faqs f ON c.faq_id = f.id
       LEFT JOIN queries q ON c.query_id = q.id
       WHERE c.yaksha_decision = 'approved'
       ORDER BY c.created_at DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/community/stats — community activity stats for the portal
router.get('/stats', async (req, res, next) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT contributor_name) as total_contributors,
        COUNT(*) FILTER (WHERE yaksha_decision = 'approved') as total_approved,
        COUNT(*) as total_submissions
      FROM community_answers
    `);
    
    const stats = statsResult.rows[0];
    res.json({
      success: true,
      data: {
        total_contributors: parseInt(stats.total_contributors) || 0,
        total_approved: parseInt(stats.total_approved) || 0,
        total_submissions: parseInt(stats.total_submissions) || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/community/leaderboard — top contributors by approved answers
router.get('/leaderboard', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        contributor_name,
        COUNT(*) as approved_count,
        MAX(created_at) as last_contribution
      FROM community_answers
      WHERE yaksha_decision = 'approved'
      GROUP BY contributor_name
      ORDER BY approved_count DESC, last_contribution DESC
      LIMIT 10
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/community/status/:hash - Check status of a submitted suggestion
router.get('/status/:hash', async (req, res, next) => {
  try {
    const { hash } = req.params;
    const sql = `
      SELECT c.yaksha_decision, c.yaksha_reasoning, c.created_at, COALESCE(f.question, q.subject) as question
      FROM community_answers c
      LEFT JOIN faqs f ON c.faq_id = f.id
      LEFT JOIN queries q ON c.query_id = q.id
      WHERE c.hash_id = $1
    `;
    const result = await query(sql, [hash]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Suggestion not found.' });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/community/bounties - MVP Feature: Returns top unanswered queries for the community to solve
router.get('/bounties', async (req, res, next) => {
  try {
    const sql = `
      SELECT query_text, COUNT(*) as frequency
      FROM search_logs
      WHERE matched_faq_id IS NULL
      GROUP BY query_text
      ORDER BY frequency DESC
      LIMIT 10;
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/community/feed - MVP Feature: Returns Yaksha's live moderation decisions and pending queue
router.get('/feed', async (req, res, next) => {
  try {
    const sql = `
      SELECT c.id, c.faq_id, c.contributor_name, c.yaksha_decision, c.yaksha_reasoning, c.created_at, COALESCE(f.question, q.subject) as question
      FROM community_answers c
      LEFT JOIN faqs f ON c.faq_id = f.id
      LEFT JOIN queries q ON c.query_id = q.id
      ORDER BY c.created_at DESC
      LIMIT 15;
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/community/queries - Returns public open queries for the community to solve
router.get('/queries', async (req, res, next) => {
  try {
    const sql = `
      SELECT id, subject, description, created_at
      FROM queries
      WHERE is_public = true AND status != 'closed'
      ORDER BY created_at DESC;
    `;
    const result = await query(sql);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
