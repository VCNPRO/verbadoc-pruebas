require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function findDoc002() {
  try {
    console.log('\n🔍 BUSCANDO DOCUMENTO .DOC_002 EN TODAS LAS TABLAS...\n');

    const userId = (await sql`SELECT id FROM users WHERE email = 'test@test.eu'`).rows[0].id;

    // 1. Buscar en extraction_results
    console.log('━━━ 1. BUSCANDO EN extraction_results ━━━');
    const extractions = await sql`
      SELECT
        id,
        filename,
        validation_status,
        validation_errors_count,
        created_at
      FROM extraction_results
      WHERE user_id = ${userId}
      AND (
        filename ILIKE '%DOC_002%'
        OR filename ILIKE '%doc_002%'
        OR filename ILIKE '%.doc_002%'
      )
      ORDER BY created_at DESC
    `;

    if (extractions.rows.length === 0) {
      console.log('❌ NO ENCONTRADO en extraction_results\n');
    } else {
      extractions.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.filename}`);
        console.log(`     ID: ${row.id}`);
        console.log(`     Estado: ${row.validation_status}`);
        console.log(`     Errores: ${row.validation_errors_count}`);
        console.log(`     Fecha: ${row.created_at}\n`);
      });
    }

    // 2. Buscar en master_excel_output
    console.log('━━━ 2. BUSCANDO EN master_excel_output ━━━');
    const masterExcel = await sql`
      SELECT
        id,
        filename,
        validation_status,
        created_at
      FROM master_excel_output
      WHERE user_id = ${userId}
      AND (
        filename ILIKE '%DOC_002%'
        OR filename ILIKE '%doc_002%'
        OR filename ILIKE '%.doc_002%'
      )
      ORDER BY created_at DESC
    `;

    if (masterExcel.rows.length === 0) {
      console.log('❌ NO ENCONTRADO en master_excel_output\n');
    } else {
      masterExcel.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.filename}`);
        console.log(`     ID: ${row.id}`);
        console.log(`     Estado: ${row.validation_status}`);
        console.log(`     Fecha: ${row.created_at}\n`);
      });
    }

    // 3. Buscar en unprocessable_documents
    console.log('━━━ 3. BUSCANDO EN unprocessable_documents ━━━');
    const unprocessable = await sql`
      SELECT
        id,
        filename,
        rejection_category,
        rejection_reason,
        created_at
      FROM unprocessable_documents
      WHERE user_id = ${userId}
      AND (
        filename ILIKE '%DOC_002%'
        OR filename ILIKE '%doc_002%'
        OR filename ILIKE '%.doc_002%'
      )
      ORDER BY created_at DESC
    `;

    if (unprocessable.rows.length === 0) {
      console.log('❌ NO ENCONTRADO en unprocessable_documents\n');
    } else {
      unprocessable.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.filename}`);
        console.log(`     ID: ${row.id}`);
        console.log(`     Categoría: ${row.rejection_category}`);
        console.log(`     Motivo: ${row.rejection_reason}`);
        console.log(`     Fecha: ${row.created_at}\n`);
      });
    }

    // 4. Buscar todos los archivos recientes (por si el nombre es diferente)
    console.log('━━━ 4. ÚLTIMOS 10 ARCHIVOS PROCESADOS (cualquier nombre) ━━━');
    const recent = await sql`
      SELECT
        id,
        filename,
        validation_status,
        created_at
      FROM extraction_results
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    recent.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.filename}`);
      console.log(`     Estado: ${row.validation_status}`);
      console.log(`     Fecha: ${row.created_at}\n`);
    });

    // DIAGNÓSTICO
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (extractions.rows.length === 0 && masterExcel.rows.length === 0 && unprocessable.rows.length === 0) {
      console.log('🚨 PROBLEMA CRÍTICO: El documento .DOC_002 NO EXISTE en ninguna tabla');
      console.log('\n   POSIBLES CAUSAS:');
      console.log('   1. El procesamiento falló y no se guardó');
      console.log('   2. Hay un error en el frontend que impide enviar a la API');
      console.log('   3. La API rechazó el documento antes de guardarlo');
      console.log('\n   SOLUCIÓN: Revisar logs del navegador (F12) para ver errores\n');
    } else if (unprocessable.rows.length > 0) {
      console.log('⚠️  El documento fue marcado como NO PROCESABLE');
      console.log(`   Motivo: ${unprocessable.rows[0].rejection_reason}\n`);
    } else if (extractions.rows.length > 0) {
      console.log(`✅ El documento SÍ se procesó y está en extraction_results`);
      console.log(`   Estado: ${extractions.rows[0].validation_status}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

findDoc002();
