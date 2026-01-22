require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkStructure() {
  try {
    console.log('\n🔍 VERIFICANDO ESTRUCTURA DE TABLAS...\n');

    // Ver columnas de extraction_results
    const erCols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'extraction_results'
      ORDER BY ordinal_position
    `;

    console.log('━━━ extraction_results ━━━');
    erCols.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    console.log('');

    // Contar extracciones
    const count = await sql`
      SELECT COUNT(*) as total FROM extraction_results
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
    `;

    console.log(`Total extracciones: ${count.rows[0].total}\n`);

    // Ver últimas extracciones
    const recent = await sql`
      SELECT
        id,
        filename,
        validation_status,
        created_at
      FROM extraction_results
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log('━━━ ÚLTIMAS EXTRACCIONES ━━━');
    recent.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.filename}`);
      console.log(`   Estado: ${row.validation_status}`);
      console.log(`   Fecha: ${row.created_at}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkStructure();
