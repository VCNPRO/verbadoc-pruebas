require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkAllStatus() {
  try {
    console.log('\n🚨 VERIFICACIÓN URGENTE DE ESTADO DEL SISTEMA\n');

    // 1. Extracciones totales
    const extractions = await sql`
      SELECT
        status,
        COUNT(*) as total
      FROM extraction_results
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      GROUP BY status
    `;

    console.log('━━━ 1. EXTRACCIONES EN extraction_results ━━━');
    if (extractions.rows.length === 0) {
      console.log('❌ NO HAY EXTRACCIONES EN LA BASE DE DATOS\n');
    } else {
      extractions.rows.forEach(row => {
        console.log(`  ${row.status}: ${row.total}`);
      });
      console.log('');
    }

    // 2. Master Excel Output
    const masterExcel = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_latest = true) as latest_version
      FROM master_excel_output
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
    `;

    console.log('━━━ 2. FILAS EN master_excel_output ━━━');
    const mexcel = masterExcel.rows[0];
    console.log(`  Total de filas: ${mexcel.total}`);
    console.log(`  Versión actual (is_latest=true): ${mexcel.latest_version}\n`);

    // 3. Últimas 5 extracciones con detalle
    const recent = await sql`
      SELECT
        id,
        filename,
        status,
        created_at
      FROM extraction_results
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log('━━━ 3. ÚLTIMAS 5 EXTRACCIONES ━━━');
    if (recent.rows.length === 0) {
      console.log('❌ NO HAY EXTRACCIONES\n');
    } else {
      recent.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.filename}`);
        console.log(`     Estado: ${row.status}`);
        console.log(`     Fecha: ${row.created_at}`);
        console.log('');
      });
    }

    // 4. Verificar errores de validación
    const errors = await sql`
      SELECT
        er.filename,
        COUNT(ve.*) as error_count
      FROM extraction_results er
      LEFT JOIN validation_errors ve ON ve.extraction_id = er.id AND ve.status = 'pending'
      WHERE er.user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      GROUP BY er.id, er.filename
      HAVING COUNT(ve.*) > 0
      ORDER BY er.created_at DESC
      LIMIT 5
    `;

    console.log('━━━ 4. EXTRACCIONES CON ERRORES PENDIENTES ━━━');
    if (errors.rows.length === 0) {
      console.log('✅ No hay extracciones con errores pendientes\n');
    } else {
      errors.rows.forEach(row => {
        console.log(`  ${row.filename}: ${row.error_count} errores`);
      });
      console.log('');
    }

    // 5. Documentos no procesables
    const unprocessable = await sql`
      SELECT
        category,
        COUNT(*) as total
      FROM unprocessable_documents
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      GROUP BY category
    `;

    console.log('━━━ 5. DOCUMENTOS NO PROCESABLES ━━━');
    if (unprocessable.rows.length === 0) {
      console.log('✅ No hay documentos marcados como no procesables\n');
    } else {
      unprocessable.rows.forEach(row => {
        console.log(`  ${row.category}: ${row.total}`);
      });
      console.log('');
    }

    // RESUMEN
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNÓSTICO RÁPIDO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (extractions.rows.length === 0) {
      console.log('🚨 PROBLEMA: No se están creando extracciones en la BD');
      console.log('   Revisar: App.tsx línea 220 (createExtraction)\n');
    }

    if (mexcel.total === 0) {
      console.log('🚨 PROBLEMA: No hay filas en master_excel_output');
      console.log('   Los formularios aprobados no se están añadiendo');
      console.log('   Revisar: ReviewPanel.tsx línea 289 (handleApprove)\n');
    }

    const approvedCount = extractions.rows.find(r => r.status === 'approved');
    if (approvedCount && approvedCount.total > 0 && mexcel.total === 0) {
      console.log('🚨 PROBLEMA CRÍTICO: Hay formularios APPROVED pero no en Excel Master');
      console.log(`   ${approvedCount.total} formularios aprobados NO están en el Excel\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkAllStatus();
