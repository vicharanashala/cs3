import pg from 'pg';
const { Pool } = pg;

let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await getPool().query(text, params);
    return res;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Database query error:', { text, params, error: err.message, duration: Date.now() - start });
    }
    throw err;
  }
}

export { getPool as pool };
export default { query, pool: getPool };