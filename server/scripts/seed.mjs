import dotenv from 'dotenv';
dotenv.config({ path: 'D:/c-files/my-project/samagama faq project/server/.env' });
import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

// Zero vector for text-embedding-3-small (1536 dims) — placeholder until real embeddings are generated
const ZERO_VECTOR = '[' + new Array(1536).fill(0).join(',') + ']';

async function seed() {
  const raw = readFileSync('D:/c-files/my-project/samagama faq project/faq-data.json', 'utf-8');
  const faqs = JSON.parse(raw);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let inserted = 0;
  let skipped = 0;

  for (const faq of faqs) {
    if (!faq.isPublished) { skipped++; continue; }

    const shortAnswer = faq.answer.length > 280
      ? faq.answer.substring(0, 277) + '...'
      : faq.answer;

    const riskLevel = faq.answer.length > 800 ? 'high'
      : faq.answer.length > 400 ? 'medium'
      : 'low';

    try {
      await client.query(
        `INSERT INTO faqs (question, answer, short_answer, embedding, category, risk_level, is_onboarding_faq, status)
         VALUES ($1, $2, $3, $4::vector, $5, $6, $7, 'published')
         ON CONFLICT DO NOTHING`,
        [faq.question, faq.answer, shortAnswer, ZERO_VECTOR, faq.category, riskLevel, false]
      );
      inserted++;
    } catch (err) {
      console.error(`Failed: ${faq.question.substring(0, 40)} — ${err.message}`);
    }
  }

  console.log(`Done: ${inserted} inserted, ${skipped} skipped`);
  await client.end();
}

seed().catch(e => { console.error(e); process.exit(1); });