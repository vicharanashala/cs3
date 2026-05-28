import { query } from '../db/neon.js';

// Primary search: PostgreSQL full-text search (no external API needed)
// Works 100% offline — no API keys required for matching
export async function searchWithFullText(userQuery, limit = 1) {
  const normalizedQuery = userQuery.trim().toLowerCase();

  const sql = `
    SELECT 
      id, question, answer, short_answer, category, updated_at,
      ts_rank(to_tsvector('english', question || ' ' || COALESCE(short_answer, '')), plainto_tsquery('english', $1)) +
      ts_rank(to_tsvector('english', COALESCE(answer, '')), plainto_tsquery('english', $1)) * 0.5
      AS rank_score
    FROM faqs
    WHERE status = 'published'
      AND (
        to_tsvector('english', question || ' ' || COALESCE(short_answer, '')) @@ plainto_tsquery('english', $1)
        OR LOWER(question) LIKE '%' || $2 || '%'
        OR LOWER(COALESCE(short_answer, '')) LIKE '%' || $2 || '%'
      )
    ORDER BY rank_score DESC
    LIMIT $3
  `;

  const result = await query(sql, [normalizedQuery, normalizedQuery, limit]);
  return limit === 1 ? (result.rows[0] || null) : result.rows;
}

// Keep generateEmbedding for backward compatibility (now a no-op)
export async function generateEmbedding(text) {
  throw new Error('Embedding generation is no longer used — switched to PostgreSQL full-text search');
}

export default { searchWithFullText, generateEmbedding };