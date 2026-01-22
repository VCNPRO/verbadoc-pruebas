require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkPdfStatus() {
  try {
    console.log('\n🔍 VERIFICANDO ESTADO DE PDFs EN EXTRACCIONES...\n');

    const result = await sql`
      SELECT
        id,
        filename,
        pdf_blob_url,
        created_at
      FROM extraction_results
      ORDER BY created_at DESC
      LIMIT 10
    `;

    console.log(`📊 Últimas ${result.rows.length} extracciones:\n`);

    result.rows.forEach((row, idx) => {
      console.log(`━━━ EXTRACCIÓN ${idx + 1} ━━━`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Archivo: ${row.filename}`);
      console.log(`  PDF URL: ${row.pdf_blob_url || '❌ NO DISPONIBLE'}`);
      console.log(`  Fecha: ${row.created_at}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPdfStatus();
