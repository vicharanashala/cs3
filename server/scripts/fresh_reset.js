import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/neon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const faqDataPath = path.resolve(__dirname, '../../faq-data.json');

async function freshReset() {
  try {
    console.log('=== FRESH RESET: Wiping all data ===\n');

    // 1. Drop community tables and clear all data
    console.log('[1/5] Clearing community_answers, faq_history, issues...');
    await query('DELETE FROM issues');
    await query('DELETE FROM community_answers');
    await query('DELETE FROM faq_history');

    // 2. Clear search logs and queries
    console.log('[2/5] Clearing search_logs and queries...');
    await query('DELETE FROM search_logs');
    await query('DELETE FROM queries');

    // 3. Clear all FAQs
    console.log('[3/5] Clearing all existing FAQs...');
    await query('DELETE FROM faqs');

    // 4. Read and seed from faq-data.json
    console.log('[4/5] Reading faq-data.json...');
    const rawData = fs.readFileSync(faqDataPath, 'utf8');
    const data = JSON.parse(rawData);
    const publishedFaqs = data.filter(faq => faq.isPublished);
    console.log(`     Found ${publishedFaqs.length} published FAQs to seed.\n`);

    let inserted = 0;
    for (const faq of publishedFaqs) {
      // Generate a short_answer (first 300 chars of answer)
      const shortAnswer = faq.answer.length > 300 
        ? faq.answer.slice(0, 297) + '...' 
        : faq.answer;

      await query(
        `INSERT INTO faqs (question, answer, short_answer, category, status, is_onboarding_faq)
         VALUES ($1, $2, $3, $4, 'published', $5)`,
        [
          faq.question,
          faq.answer,
          shortAnswer,
          faq.category || 'General',
          false // not onboarding by default
        ]
      );
      inserted++;
      if (inserted % 10 === 0) console.log(`     Inserted ${inserted}/${publishedFaqs.length}...`);
    }

    // 5. Mark first 5 FAQs as onboarding
    console.log('\n[5/5] Marking first 5 FAQs as onboarding...');
    await query(`
      UPDATE faqs SET is_onboarding_faq = true 
      WHERE id IN (SELECT id FROM faqs ORDER BY created_at ASC LIMIT 5)
    `);

    console.log(`\n=== DONE! Seeded ${inserted} FAQs. Database is fresh. ===`);
    process.exit(0);
  } catch (err) {
    console.error('Reset failed:', err);
    process.exit(1);
  }
}

freshReset();
