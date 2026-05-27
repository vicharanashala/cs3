import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../db/schema.sql');

async function applySchema() {
  try {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Applying database schema...');
    await pool.query(schemaSql);
    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Error applying schema:', err);
  } finally {
    await pool.end();
  }
}

applySchema();
