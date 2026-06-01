import express from 'express';
import { query } from '../db/neon.js';
import { evaluateAnswer, generateHashId } from '../services/yaksha.service.js';

const router = express.Router();

router.post('/suggest', async (req, res, next) => {
  try {
    const { faq_id, answer_text, contributor_name } = req.body;
    
    if (!faq_id || !answer_text) {
      return res.status(400).json({ error: 'faq_id and answer_text are required' });
    }

    // 1. Get original FAQ
    const faqRes = await query('SELECT question, answer FROM faqs WHERE id = $1', [faq_id]);
    if (faqRes.rows.length === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    
    const officialAnswer = faqRes.rows[0].answer;
    const faqQuestion = faqRes.rows[0].question;

    // 2. Yaksha Gatekeeper Evaluation
    const evaluation = await evaluateAnswer(answer_text, officialAnswer, faqQuestion);
    
    const hashId = generateHashId();

    // 3. Store in community_answers
    const insertRes = await query(
      `INSERT INTO community_answers 
      (faq_id, contributor_name, answer_text, hash_id, yaksha_decision, yaksha_confidence, yaksha_reasoning) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [faq_id, contributor_name || 'Anonymous', answer_text, hashId, evaluation.decision, evaluation.confidence, evaluation.reasoning]
    );

    // 4. Direct-Write Logic if Approved
    if (evaluation.decision === 'approved') {
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
    }

    res.status(201).json({
      success: true,
      decision: evaluation.decision,
      hash_id: hashId,
      reasoning: evaluation.reasoning
    });

  } catch (error) {
    next(error);
  }
});

// Endpoint to get all approved community contributions for the frontend showcase
router.get('/contributions', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.id, c.hash_id, c.answer_text, c.contributor_name, c.yaksha_confidence, c.created_at, f.question 
       FROM community_answers c
       JOIN faqs f ON c.faq_id = f.id
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

export default router;
