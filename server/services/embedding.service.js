import { query } from '../db/neon.js';

let _groq = null;

async function getGroq() {
  if (!_groq) {
    const OpenAI = (await import('openai')).default;
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groq;
}

// Generate a 1536-dim embedding via Groq (OpenAI-compatible endpoint)
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }
  const groq = await getGroq();
  const response = await groq.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim().slice(0, 8000),
  });
  return response.data[0].embedding;
}

// Pure vector similarity search against pgvector with temporal decay
export async function searchWithVectors(userQuery, limit = 3) {
  const embedding = await generateEmbedding(userQuery);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Temporal decay: penalise FAQs older than 60 days
  // freshness_weight = 1 - 0.01 × max(0, days_since_update - 60)
  // For a 90-day-old FAQ: max(0,90-60)=30 → 1-(0.01×30) = 0.70
  // For a 10-day-old FAQ: freshness_weight = 1.0
  const sql = `
    SELECT
      id,
      question,
      answer,
      short_answer,
      category,
      updated_at,
      (1 - (embedding <=> $1::vector))
      * (1 - (0.01 * GREATEST(0, DATE_PART('day', NOW() - updated_at) - 60)))
      AS confidence_score
    FROM faqs
    WHERE status = 'published'
    ORDER BY
      (1 - (embedding <=> $1::vector))
      * (1 - (0.01 * GREATEST(0, DATE_PART('day', NOW() - updated_at) - 60)))
      DESC
    LIMIT $2
  `;

  const result = await query(sql, [embeddingStr, limit]);
  return result.rows;
}

// Backward-compatible alias (full-text is no longer used)
export async function searchWithFullText(userQuery, limit = 3) {
  return searchWithVectors(userQuery, limit);
}

export default { generateEmbedding, searchWithVectors, searchWithFullText };