require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkFullStatus() {
  try {
    console.log('\n🚨 DIAGNÓSTICO COMPLETO DEL SISTEMA\n');

    const userId = (await sql`SELECT id FROM users WHERE email = 'test@test.eu'`).rows[0].id;

    // 1. Extracciones por estado
    const extractions = await sql`
      SELECT
        validation_status,
        COUNT(*) as total
      FROM extraction_results
      WHERE user_id = ${userId}
      GROUP BY validation_status
    `;

    console.log('━━━ 1. EXTRACCIONES (extraction_results) ━━━');
    if (extractions.rows.length === 0) {
      console.log('❌ NO HAY EXTRACCIONES\n');
    } else {
      let total = 0;
      extractions.rows.forEach(row => {
        console.log(`  ${row.validation_status}: ${row.total}`);
        total += parseInt(row.total);
      });
      console.log(`  TOTAL: ${total}\n`);
    }

    // 2. Master Excel
    const masterExcel = await sql`
      SELECT COUNT(*) as total
      FROM master_excel_output
      WHERE user_id = ${userId}
    `;

    console.log('━━━ 2. EXCEL MASTER (master_excel_output) ━━━');
    console.log(`  Total de filas: ${masterExcel.rows[0].total}\n`);

    // 3. Errores de validación
    const errors = await sql`
      SELECT
        er.filename,
        er.validation_status,
        COUNT(ve.id) as error_count
      FROM extraction_results er
      LEFT JOIN validation_errors ve ON ve.extraction_id = er.id AND ve.status = 'pending'
      WHERE er.user_id = ${userId}
      GROUP BY er.id, er.filename, er.validation_status
      ORDER BY er.created_at DESC
    `;

    console.log('━━━ 3. DETALLE DE EXTRACCIONES ━━━');
    errors.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.filename}`);
      console.log(`   Estado: ${row.validation_status}`);
      console.log(`   Errores pendientes: ${row.error_count}\n`);
    });

    // 4. Documentos no procesables
    const unproc = await sql`
      SELECT
        category,
        COUNT(*) as total
      FROM unprocessable_documents
      WHERE user_id = ${userId}
      GROUP BY category
    `;

    console.log('━━━ 4. DOCUMENTOS NO PROCESABLES ━━━');
    if (unproc.rows.length === 0) {
      console.log('✅ No hay documentos no procesables\n');
    } else {
      unproc.rows.forEach(row => {
        console.log(`  ${row.category}: ${row.total}`);
      });
      console.log('');
    }

    // DIAGNÓSTICO
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const totalExtractions = extractions.rows.reduce((sum, r) => sum + parseInt(r.total), 0);
    const totalMasterExcel = parseInt(masterExcel.rows[0].total);

    if (totalExtractions === 0) {
      console.log('🚨 CRÍTICO: No hay extracciones en la BD');
      console.log('   Los formularios NO se están guardando\n');
    } else {
      console.log(`✅ Hay ${totalExtractions} extracciones en la BD\n`);
    }

    if (totalMasterExcel === 0) {
      console.log('🚨 PROBLEMA: Excel Master VACÍO (0 filas)');
      console.log('   Los formularios aprobados NO se añaden al Excel\n');
    } else {
      console.log(`✅ Excel Master tiene ${totalMasterExcel} filas\n`);
    }

    const validCount = extractions.rows.find(r => r.validation_status === 'valid');
    const approvedCount = extractions.rows.find(r => r.validation_status === 'approved');

    if ((validCount || approvedCount) && totalMasterExcel === 0) {
      console.log('🚨 INCONSISTENCIA DETECTADA:');
      if (validCount) console.log(`   - ${validCount.total} formularios VALID`);
      if (approvedCount) console.log(`   - ${approvedCount.total} formularios APPROVED`);
      console.log('   - Pero 0 en Excel Master');
      console.log('\n   CAUSA PROBABLE: Los formularios VALID no se aprueban automáticamente');
      console.log('   SOLUCIÓN: Ir a /review y aprobar manualmente\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkFullStatus();
