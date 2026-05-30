import { query } from '../db/neon.js';

async function run() {
  try {
    console.log('Dropping old tables...');
    await query('DROP TABLE IF EXISTS issues CASCADE');
    await query('DROP TABLE IF EXISTS community_answers CASCADE');
    await query('DROP TABLE IF EXISTS faq_history CASCADE');

    console.log('Creating tables...');
    await query(`
      CREATE TABLE faq_history (
          id SERIAL PRIMARY KEY,
          faq_id UUID REFERENCES faqs(id) ON DELETE CASCADE,
          previous_answer TEXT NOT NULL,
          changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await query(`
      CREATE TABLE community_answers (
          id SERIAL PRIMARY KEY,
          faq_id UUID REFERENCES faqs(id) ON DELETE CASCADE,
          contributor_name VARCHAR(255),
          answer_text TEXT NOT NULL,
          hash_id VARCHAR(50) UNIQUE NOT NULL,
          yaksha_decision yaksha_decision_enum NOT NULL,
          yaksha_confidence DECIMAL(3,2),
          yaksha_reasoning TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE issues (
          id SERIAL PRIMARY KEY,
          community_answer_id INTEGER REFERENCES community_answers(id) ON DELETE SET NULL,
          faq_id UUID REFERENCES faqs(id) ON DELETE CASCADE,
          reporter_name VARCHAR(255),
          reason TEXT,
          status VARCHAR(50) DEFAULT 'open',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
