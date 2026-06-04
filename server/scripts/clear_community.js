// Clear approved community answers and restore original FAQ answers from history
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clearApprovedAnswers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Restore original FAQ answers from faq_history where community answers overwrote them
    const historyRows = await client.query(`
      SELECT DISTINCT ON (fh.faq_id) fh.faq_id, fh.previous_answer
      FROM faq_history fh
      INNER JOIN community_answers ca ON ca.faq_id = fh.faq_id AND ca.yaksha_decision = 'approved'
      ORDER BY fh.faq_id, fh.changed_at DESC
    `);

    for (const row of historyRows.rows) {
      await client.query(
        `UPDATE faqs SET answer = $1::text, short_answer = $1::text, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [row.previous_answer, row.faq_id]
      );
      console.log(`  Restored FAQ #${row.faq_id} to its previous answer.`);
    }

    // 2. Delete all community_answers records
    const deleteResult = await client.query('DELETE FROM community_answers');
    console.log(`  Deleted ${deleteResult.rowCount} community answer record(s).`);

    // 3. Clear related faq_history entries from community overwrites
    const historyDelete = await client.query('DELETE FROM faq_history');
    console.log(`  Cleared ${historyDelete.rowCount} faq_history record(s).`);

    await client.query('COMMIT');
    console.log('\n✓ Database cleaned successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during cleanup:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

clearApprovedAnswers();
