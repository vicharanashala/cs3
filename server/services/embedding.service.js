import { query } from '../db/neon.js';

// Primary search: PostgreSQL full-text search
// ALWAYS returns exactly `limit` FAQs with a confidence score (pads if needed)
export async function searchWithFullText(userQuery, limit = 3) {
  const normalizedQuery = userQuery.trim();
  if (!normalizedQuery) return [];

  // Step 1: Full-text + substring match
  const matchSql = `
    SELECT
      id, question, answer, short_answer, category, updated_at,
      GREATEST(
        ts_rank(
          to_tsvector('english', question || ' ' || COALESCE(short_answer, '')),
          plainto_tsquery('english', $1)
        ),
        ts_rank(
          to_tsvector('english', COALESCE(answer, '')),
          plainto_tsquery('english', $1)
        ) * 0.5
      ) AS rank_score
    FROM faqs
    WHERE status = 'published'
      AND (
        to_tsvector('english', question || ' ' || COALESCE(short_answer, '') || ' ' || COALESCE(answer, ''))
          @@ plainto_tsquery('english', $1)
        OR LOWER(question) LIKE '%' || LOWER($1) || '%'
        OR LOWER(COALESCE(short_answer, '')) LIKE '%' || LOWER($1) || '%'
      )
    ORDER BY rank_score DESC
    LIMIT $2
  `;

  const matchResult = await query(matchSql, [normalizedQuery, limit]);
  let rows = matchResult.rows;

  // Step 2: Pad with top-ranked FAQs if fewer than limit
  if (rows.length < limit) {
    const matchedIds = rows.length > 0
      ? rows.map(r => `'${r.id}'`).join(',')
      : "'__none__'";
    const padSql = `
      SELECT id, question, answer, short_answer, category, updated_at,
             ts_rank(
               to_tsvector('english', question || ' ' || COALESCE(short_answer, '')),
               plainto_tsquery('english', $1)
             ) * 0.3 AS rank_score
      FROM faqs
      WHERE status = 'published'
        AND id NOT IN (${matchedIds})
      ORDER BY rank_score DESC
      LIMIT $2
    `;
    const padResult = await query(padSql, [normalizedQuery, limit - rows.length]);
    rows = [...rows, ...padResult.rows];
  }

  return rows;
}

// Backward compatibility — no-op
export async function generateEmbedding(text) {
  throw new Error('Embedding generation is no longer used');
}

export default { searchWithFullText, generateEmbedding };