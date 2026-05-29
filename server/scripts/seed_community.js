/**
 * Community Schema Migration Script
 * Run: node --env-file=.env scripts/seed_community.js
 * 
 * Creates the community-driven UGC tables on NeonDB.
 * Safe to re-run (uses IF NOT EXISTS / exception handling).
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log('[Migration] Connected to NeonDB');

    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'db', 'community_schema.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute the migration
    await client.query(sql);
    console.log('[Migration] ✅ Community schema created successfully');

    // Verify tables exist
    const verifyResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'community_answers', 'answer_history', 'issues')
      ORDER BY table_name;
    `);

    console.log('[Migration] Verified tables:');
    verifyResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    if (verifyResult.rows.length === 4) {
      console.log('[Migration] ✅ All 4 community tables confirmed');
    } else {
      console.warn(`[Migration] ⚠️ Expected 4 tables, found ${verifyResult.rows.length}`);
    }

  } catch (err) {
    console.error('[Migration] ❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('[Migration] Connection closed');
  }
}

runMigration();
