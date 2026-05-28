import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('First 60 chars:', process.env.DATABASE_URL?.substring(0, 60));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const res = await pool.query('SELECT 1 as test');
  console.log('DB connection OK:', res.rows[0]);
  await pool.end();
} catch(e) {
  console.error('DB error:', e.message);
}