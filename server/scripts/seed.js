import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, query } from '../db/neon.js';
import { generateEmbedding } from '../services/embedding.service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const faqDataPath = path.resolve(__dirname, '../../faq-data.json');

async function seed() {
  try {
    console.log('Reading faq-data.json...');
    const rawData = fs.readFileSync(faqDataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    // Filter out unpublished
    const publishedFaqs = data.filter(faq => faq.isPublished);
    console.log(`Found ${publishedFaqs.length} published FAQs to seed.`);

    for (let i = 0; i < publishedFaqs.length; i++) {
      const faq = publishedFaqs[i];

      const textToEmbed = `Question: ${faq.question}\nAnswer: ${faq.answer}`;
      console.log(`[${i + 1}/${publishedFaqs.length}] Generating embedding for: ${faq.question}`);
      
      const embedding = await generateEmbedding(textToEmbed);
      // pgvector format requires '[val1,val2,...]'
      const embeddingString = `[${embedding.join(',')}]`;

      await query(
        `INSERT INTO faqs (question, answer, category, embedding) VALUES ($1, $2, $3, $4)`,
        [faq.question, faq.answer, faq.category || 'General', embeddingString]
      );
    }
    
    console.log('Database seeding complete!');
  } catch (err) {
    console.error('Error seeding FAQs:', err);
  } finally {
    await pool.end();
  }
}

seed();
