require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function showMappings() {
  try {
    const result = await sql`
      SELECT mappings FROM column_mappings
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      AND is_active = true
      LIMIT 1
    `;

    if (result.rows.length > 0) {
      console.log(JSON.stringify(result.rows[0].mappings, null, 2));
    } else {
      console.log('No active mappings found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

showMappings();
