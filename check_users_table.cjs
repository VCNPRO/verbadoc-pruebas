require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkUsersTable() {
  try {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 ESTRUCTURA DE LA TABLA users:\n');
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
    });
    console.log('');

    // Ver un usuario existente
    const sample = await sql`SELECT * FROM users LIMIT 1`;
    if (sample.rows.length > 0) {
      console.log('📌 EJEMPLO DE USUARIO EXISTENTE:');
      console.log(JSON.stringify(sample.rows[0], null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUsersTable();
