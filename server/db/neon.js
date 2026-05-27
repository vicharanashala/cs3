import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Database query error:', {
        text,
        params,
        error: err.message,
        duration: Date.now() - start
      });
    }
    throw err;
  }
}

export { pool };
export default { query, pool };
