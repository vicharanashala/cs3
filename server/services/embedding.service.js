import { query } from '../db/neon.js';

/**
 * Pure PostgreSQL full-text search + ILIKE substring fallback.
 * No external embedding APIs needed — works with NeonDB free tier.
 * Always returns exactly `limit` FAQs (pads with top-ranked if fewer found).
 */
export async function searchWithFullText(userQuery, limit = 3) {
  const trimmed = userQuery.trim();

  // Strategy 1: ts_rank full-text search
  const ftsSql = `
    SELECT
      id, question, answer, short_answer, category, updated_at,
      ts_rank(
        to_tsvector('english', question || ' ' || COALESCE(answer, '') || ' ' || COALESCE(short_answer, '')),
        plainto_tsquery('english', $1)
      ) AS confidence_score
    FROM faqs
    WHERE status = 'published'
      AND to_tsvector('english', question || ' ' || COALESCE(answer, '') || ' ' || COALESCE(short_answer, ''))
          @@ plainto_tsquery('english', $1)
    ORDER BY confidence_score DESC
    LIMIT $2
  `;

  let result = await query(ftsSql, [trimmed, limit]);

  // Strategy 2: ILIKE substring fallback if FTS returned nothing
  if (result.rows.length === 0) {
    const ilikeSql = `
      SELECT
        id, question, answer, short_answer, category, updated_at,
        0.4 AS confidence_score
      FROM faqs
      WHERE status = 'published'
        AND (question ILIKE $1 OR answer ILIKE $1 OR short_answer ILIKE $1)
      ORDER BY updated_at DESC
      LIMIT $2
    `;
    result = await query(ilikeSql, [`%${trimmed}%`, limit]);
  }

  // Pad with top-ranked FAQs if we still have fewer than `limit`
  if (result.rows.length < limit) {
    const existingIds = result.rows.map(r => r.id);
    const placeholder = existingIds.length > 0
      ? existingIds.map((_, i) => `$${i + 2}`).join(', ')
      : `'00000000-0000-0000-0000-000000000000'`;
    
    const padSql = `
      SELECT
        id, question, answer, short_answer, category, updated_at,
        0.1 AS confidence_score
      FROM faqs
      WHERE status = 'published'
        AND id NOT IN (${placeholder})
      ORDER BY updated_at DESC
      LIMIT $1
    `;
    const padParams = [limit - result.rows.length, ...existingIds];
    const padResult = await query(padSql, padParams);
    result.rows = [...result.rows, ...padResult.rows];
  }

  return result.rows;
}

// Backward-compatible alias
export async function searchWithVectors(userQuery, limit = 3) {
  return searchWithFullText(userQuery, limit);
}

export default { searchWithFullText, searchWithVectors };