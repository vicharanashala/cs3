import { query } from '../db/neon.js';

// Minimum edit distance (Levenshtein) between two short strings.
// Used for fuzzy FAQ title matching.
function editDistance(a, b) {
  const m = a.length, n2 = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n2 + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n2; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n2; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n2];
}

// Returns true if `needle` fuzzy-matches the first few words of `haystack`.
// Each word in `needle` must be within edit-distance threshold of a word in `haystack`.
// E.g. "what is rosseta" matches "What is Rosetta?" — "rosseta" matches "rosetta" (dist=1).
function fuzzyMatchWords(needle, haystack) {
  const nWords = needle.toLowerCase().split(/\s+/);
  const hWords = haystack.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  return nWords.every(nWord =>
    nWord.length < 3 ||  // short words always pass (don't fuzzy-match "is", "of", "a", "the")
    hWords.some(hWord => editDistance(nWord, hWord) <= Math.max(1, Math.floor(hWord.length / 3)))
  );
}

// PostgreSQL full-text search — no external embedding APIs
// ALWAYS returns exactly `limit` FAQs with a rank_score (pads if needed)
export async function searchWithFullText(userQuery, limit = 3) {
  const normalizedQuery = userQuery.trim();
  if (!normalizedQuery) return [];

  // Step 1: Full-text search (ts_rank)
  const ftsSql = `
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
      AND to_tsvector('english', question || ' ' || COALESCE(short_answer, '') || ' ' || COALESCE(answer, ''))
          @@ plainto_tsquery('english', $1)
    ORDER BY rank_score DESC
    LIMIT $2
  `;
  const ftsResult = await query(ftsSql, [normalizedQuery, limit]);
  let rows = ftsResult.rows;

  // Step 2: Substring/ILIKE fallback — only for rows NOT already found by FTS
  if (rows.length < limit) {
    const matchedIds = rows.length > 0
      ? rows.map(r => `'${r.id}'`).join(',')
      : "'__none__'";
    const ilikeSql = `
      SELECT id, question, answer, short_answer, category, updated_at,
             0.15 AS rank_score
      FROM faqs
      WHERE status = 'published'
        AND id NOT IN (${matchedIds})
        AND (
          LOWER(question) LIKE '%' || LOWER($1) || '%'
          OR LOWER(COALESCE(short_answer, '')) LIKE '%' || LOWER($1) || '%'
          OR LOWER(COALESCE(answer, '')) LIKE '%' || LOWER($1) || '%'
        )
      ORDER BY rank_score DESC
      LIMIT $2
    `;
    const ilikeResult = await query(ilikeSql, [normalizedQuery, limit - rows.length]);
    rows = [...rows, ...ilikeResult.rows];
  }

  // Step 3: Fuzzy word-match fallback — catches typos like "rosseta" → "Rosetta"
  // Handles transposed/misspelled letters that FTS and ILIKE miss
  if (rows.length < limit) {
    const matchedIds = new Set(rows.map(r => r.id));
    console.log('[search] Step3 fuzzy: query=', normalizedQuery, 'rows.length=', rows.length);
    const allFaqsResult = await query(
      `SELECT id, question, answer, short_answer, category, updated_at
       FROM faqs WHERE status = 'published'`
    );
    const fs = await import('fs');
    fs.appendFileSync('D:/c-files/my-project/samagama faq project/debug.log', 
      `[search] Step3 fuzzy: query=${normalizedQuery} rows.length=${rows.length} totalFaqs=${allFaqsResult.rows.length}\n`);
    const fuzzyRows = allFaqsResult.rows
      .filter(f => {
        const matched = !matchedIds.has(f.id) && fuzzyMatchWords(normalizedQuery, f.question);
        if (matched) fs.appendFileSync('D:/c-files/my-project/samagama faq project/debug.log', 
          `[search] Fuzzy match: ${f.question}\n`);
        return matched;
      })
      .slice(0, limit - rows.length)
      .map(f => ({ ...f, rank_score: 0.10 }));
    fs.appendFileSync('D:/c-files/my-project/samagama faq project/debug.log', 
      `[search] Fuzzy rows found: ${fuzzyRows.length}\n`);
    rows = [...rows, ...fuzzyRows];
  }

  // Step 4: Pad with top FAQs by updated_at if still fewer than limit
  if (rows.length < limit) {
    const matchedIds = rows.length > 0
      ? rows.map(r => `'${r.id}'`).join(',')
      : "'__none__'";
    const padSql = `
      SELECT id, question, answer, short_answer, category, updated_at,
             0.0 AS rank_score
      FROM faqs
      WHERE status = 'published'
        AND id NOT IN (${matchedIds})
      ORDER BY updated_at DESC
      LIMIT $2
    `;
    const padResult = await query(padSql, [normalizedQuery, limit - rows.length]);
    rows = [...rows, ...padResult.rows];
  }

  return rows;
}

export default { searchWithFullText };