require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function migratePdfUrls() {
  try {
    console.log('\n🔄 MIGRANDO URLs DE PDF AL CAMPO CORRECTO...\n');

    // Verificar si hay registros con file_url pero sin pdf_blob_url
    const checkResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE file_url IS NOT NULL AND pdf_blob_url IS NULL) as needs_migration,
        COUNT(*) FILTER (WHERE pdf_blob_url IS NOT NULL) as already_migrated,
        COUNT(*) as total
      FROM extraction_results
    `;

    const stats = checkResult.rows[0];
    console.log('📊 ESTADO ACTUAL:');
    console.log(`   Total extracciones: ${stats.total}`);
    console.log(`   Con pdf_blob_url: ${stats.already_migrated}`);
    console.log(`   Necesitan migración: ${stats.needs_migration}\n`);

    if (stats.needs_migration === '0') {
      console.log('✅ No hay registros que necesiten migración\n');
      return;
    }

    // Migrar: copiar file_url a pdf_blob_url
    console.log(`🔧 Migrando ${stats.needs_migration} registros...\n`);

    const migrateResult = await sql`
      UPDATE extraction_results
      SET pdf_blob_url = file_url,
          pdf_stored_at = CURRENT_TIMESTAMP
      WHERE file_url IS NOT NULL
      AND pdf_blob_url IS NULL
    `;

    console.log(`✅ ${migrateResult.rowCount} registros migrados correctamente\n`);

    // Verificar resultado final
    const finalCheck = await sql`
      SELECT
        COUNT(*) FILTER (WHERE pdf_blob_url IS NOT NULL) as with_pdf,
        COUNT(*) as total
      FROM extraction_results
    `;

    const finalStats = finalCheck.rows[0];
    console.log('📊 RESULTADO FINAL:');
    console.log(`   Total: ${finalStats.total}`);
    console.log(`   Con PDF guardado: ${finalStats.with_pdf}\n`);

    console.log('✅ Migración completada exitosamente!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

migratePdfUrls();
