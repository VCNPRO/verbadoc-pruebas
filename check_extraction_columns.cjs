require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkColumns() {
  try {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'extraction_results'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 COLUMNAS DE extraction_results:\n');
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`);
    });
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkColumns();
