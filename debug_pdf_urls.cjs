require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function debugPdfUrls() {
  try {
    console.log('\n=== DIAGNÓSTICO DE URLs DE PDF ===\n');

    // Obtener los 5 registros más recientes
    const recent = await sql`
      SELECT
        id,
        filename,
        file_url,
        pdf_blob_url,
        pdf_blob_pathname,
        pdf_stored_at,
        created_at
      FROM extraction_results
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log(`📊 Últimos 5 registros:\n`);

    recent.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.filename}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Creado: ${row.created_at}`);
      console.log(`   file_url: ${row.file_url ? (row.file_url.substring(0, 60) + '...') : 'NULL'}`);
      console.log(`   pdf_blob_url: ${row.pdf_blob_url ? (row.pdf_blob_url.substring(0, 60) + '...') : 'NULL'}`);
      console.log(`   pdf_blob_pathname: ${row.pdf_blob_pathname || 'NULL'}`);
      console.log(`   pdf_stored_at: ${row.pdf_stored_at || 'NULL'}`);
      console.log('');
    });

    // Estadísticas
    const stats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(file_url) as con_file_url,
        COUNT(pdf_blob_url) as con_pdf_blob_url,
        COUNT(CASE WHEN file_url IS NOT NULL AND pdf_blob_url IS NOT NULL THEN 1 END) as con_ambos,
        COUNT(CASE WHEN file_url IS NULL AND pdf_blob_url IS NULL THEN 1 END) as sin_ninguno
      FROM extraction_results
    `;

    const s = stats.rows[0];
    console.log('\n📈 ESTADÍSTICAS GLOBALES:');
    console.log(`   Total registros: ${s.total}`);
    console.log(`   Con file_url: ${s.con_file_url} (${Math.round(s.con_file_url/s.total*100)}%)`);
    console.log(`   Con pdf_blob_url: ${s.con_pdf_blob_url} (${Math.round(s.con_pdf_blob_url/s.total*100)}%)`);
    console.log(`   Con ambos: ${s.con_ambos} (${Math.round(s.con_ambos/s.total*100)}%)`);
    console.log(`   Sin ninguno: ${s.sin_ninguno} (${Math.round(s.sin_ninguno/s.total*100)}%)`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

debugPdfUrls();
