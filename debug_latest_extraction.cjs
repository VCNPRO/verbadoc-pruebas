require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function debugLatest() {
  try {
    console.log('\n🔍 DIAGNÓSTICO DEL ÚLTIMO ARCHIVO PROCESADO\n');

    // Obtener el último registro
    const latest = await sql`
      SELECT
        id,
        filename,
        file_url,
        pdf_blob_url,
        pdf_blob_pathname,
        pdf_stored_at,
        file_type,
        validation_status,
        created_at,
        updated_at
      FROM extraction_results
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (latest.rows.length === 0) {
      console.log('❌ No hay registros en la base de datos');
      process.exit(0);
    }

    const row = latest.rows[0];

    console.log('📄 ÚLTIMO ARCHIVO PROCESADO:');
    console.log('─'.repeat(60));
    console.log(`Nombre: ${row.filename}`);
    console.log(`ID: ${row.id}`);
    console.log(`Tipo: ${row.file_type || 'N/A'}`);
    console.log(`Status: ${row.validation_status}`);
    console.log(`Creado: ${row.created_at}`);
    console.log(`Actualizado: ${row.updated_at}`);
    console.log('');

    console.log('📎 URLs DEL PDF:');
    console.log('─'.repeat(60));

    if (row.file_url) {
      console.log('✅ file_url: SÍ');
      console.log(`   ${row.file_url}`);
    } else {
      console.log('❌ file_url: NULL');
    }

    if (row.pdf_blob_url) {
      console.log('✅ pdf_blob_url: SÍ');
      console.log(`   ${row.pdf_blob_url}`);
    } else {
      console.log('❌ pdf_blob_url: NULL');
    }

    if (row.pdf_blob_pathname) {
      console.log('✅ pdf_blob_pathname: SÍ');
      console.log(`   ${row.pdf_blob_pathname}`);
    } else {
      console.log('❌ pdf_blob_pathname: NULL');
    }

    if (row.pdf_stored_at) {
      console.log(`✅ pdf_stored_at: ${row.pdf_stored_at}`);
    } else {
      console.log('❌ pdf_stored_at: NULL');
    }

    console.log('');

    // Verificar si la URL es accesible
    if (row.file_url || row.pdf_blob_url) {
      const urlToTest = row.file_url || row.pdf_blob_url;
      console.log('🌐 VERIFICANDO ACCESIBILIDAD DE LA URL:');
      console.log('─'.repeat(60));

      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(urlToTest, { method: 'HEAD' });

        if (response.ok) {
          console.log(`✅ URL accesible - Status: ${response.status}`);
          console.log(`   Content-Type: ${response.headers.get('content-type')}`);
          console.log(`   Content-Length: ${response.headers.get('content-length')} bytes`);
        } else {
          console.log(`❌ URL NO accesible - Status: ${response.status}`);
          console.log(`   Error: ${response.statusText}`);
        }
      } catch (fetchError) {
        console.log(`❌ Error al verificar URL: ${fetchError.message}`);
      }
    } else {
      console.log('⚠️ No hay URLs para verificar');
    }

    console.log('');
    console.log('📊 DIAGNÓSTICO:');
    console.log('─'.repeat(60));

    const hasUrl = row.file_url || row.pdf_blob_url;

    if (hasUrl) {
      console.log('✅ El registro TIENE URL de PDF');
      console.log('   → El problema puede estar en el frontend (ReviewPanel)');
      console.log('   → Verifica la consola del navegador');
    } else {
      console.log('❌ El registro NO TIENE URL de PDF');
      console.log('   → El PDF no se subió correctamente a Vercel Blob');
      console.log('   → Verifica los logs del servidor durante el procesamiento');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

debugLatest();
