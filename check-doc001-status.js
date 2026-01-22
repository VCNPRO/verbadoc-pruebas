/**
 * Verificar dónde se guardó DOC_001
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkDoc001() {
  console.log('==========================================');
  console.log('VERIFICANDO ESTADO DE DOC_001');
  console.log('==========================================\n');

  try {
    // 1. Buscar en extraction_results
    console.log('1️⃣  Buscando en extraction_results...\n');
    const extractions = await sql`
      SELECT
        id,
        filename,
        extracted_data->>'numero_expediente' as expediente,
        extracted_data->>'numero_accion' as accion,
        extracted_data->>'num_accion' as num_accion,
        extracted_data->>'numero_grupo' as grupo,
        extracted_data->>'num_grupo' as num_grupo,
        validation_status,
        created_at
      FROM extraction_results
      WHERE filename LIKE '%DOC_001%'
      ORDER BY created_at DESC
    `;

    if (extractions.rows.length > 0) {
      console.log(`❌ PROBLEMA: DOC_001 SÍ está en extraction_results (${extractions.rows.length} registros)`);
      console.log('\nRegistros encontrados:');
      extractions.rows.forEach((row, i) => {
        console.log(`\n  ${i + 1}. ID: ${row.id}`);
        console.log(`     Filename: ${row.filename}`);
        console.log(`     Expediente: ${row.expediente}`);
        console.log(`     Acción: ${row.accion || row.num_accion}`);
        console.log(`     Grupo: ${row.grupo || row.num_grupo}`);
        console.log(`     Status: ${row.validation_status}`);
        console.log(`     Created: ${row.created_at}`);
      });
      console.log('\n');
    } else {
      console.log('✅ DOC_001 NO está en extraction_results (correcto)\n');
    }

    // 2. Buscar en unprocessable_documents
    console.log('2️⃣  Buscando en unprocessable_documents...\n');
    const unprocessable = await sql`
      SELECT
        id,
        filename,
        rejection_category,
        rejection_reason,
        numero_expediente,
        numero_accion,
        numero_grupo,
        created_at
      FROM unprocessable_documents
      WHERE filename LIKE '%DOC_001%'
      ORDER BY created_at DESC
    `;

    if (unprocessable.rows.length > 0) {
      console.log(`✅ DOC_001 está en unprocessable_documents (${unprocessable.rows.length} registros)`);
      console.log('\nRegistros encontrados:');
      unprocessable.rows.forEach((row, i) => {
        console.log(`\n  ${i + 1}. ID: ${row.id}`);
        console.log(`     Filename: ${row.filename}`);
        console.log(`     Category: ${row.rejection_category}`);
        console.log(`     Reason: ${row.rejection_reason}`);
        console.log(`     Expediente: ${row.numero_expediente}`);
        console.log(`     Acción: ${row.numero_accion}`);
        console.log(`     Grupo: ${row.numero_grupo}`);
        console.log(`     Created: ${row.created_at}`);
      });
      console.log('\n');
    } else {
      console.log('❌ DOC_001 NO está en unprocessable_documents\n');
    }

    // 3. Buscar en master_excel_output
    console.log('3️⃣  Buscando en master_excel_output...\n');
    const masterExcel = await sql`
      SELECT
        id,
        filename,
        row_data->>'numero_expediente' as expediente,
        validation_status,
        created_at
      FROM master_excel_output
      WHERE filename LIKE '%DOC_001%'
      ORDER BY created_at DESC
    `;

    if (masterExcel.rows.length > 0) {
      console.log(`❌ PROBLEMA: DOC_001 SÍ está en master_excel_output (${masterExcel.rows.length} registros)`);
      console.log('\nRegistros encontrados:');
      masterExcel.rows.forEach((row, i) => {
        console.log(`\n  ${i + 1}. ID: ${row.id}`);
        console.log(`     Filename: ${row.filename}`);
        console.log(`     Expediente: ${row.expediente}`);
        console.log(`     Status: ${row.validation_status}`);
        console.log(`     Created: ${row.created_at}`);
      });
      console.log('\n');
    } else {
      console.log('✅ DOC_001 NO está en master_excel_output (correcto)\n');
    }

    // 4. Verificar si B211801AA existe en reference_data
    console.log('4️⃣  Verificando si B211801AA existe en Excel de referencia...\n');
    const refCheck = await sql`
      SELECT
        form_identifier,
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'num_grupo' as grupo
      FROM reference_data
      WHERE is_active = true
      AND data->>'numero_expediente' = 'B211801AA'
      LIMIT 1
    `;

    if (refCheck.rows.length > 0) {
      console.log('✅ B211801AA SÍ existe en reference_data');
      console.log(`   Form Identifier: ${refCheck.rows[0].form_identifier}`);
      console.log(`   Expediente: ${refCheck.rows[0].expediente}`);
      console.log(`   Acción: ${refCheck.rows[0].accion}`);
      console.log(`   Grupo: ${refCheck.rows[0].grupo}\n`);
    } else {
      console.log('❌ B211801AA NO existe en reference_data (correcto si debe rechazarse)\n');
    }

    console.log('==========================================');
    console.log('RESUMEN');
    console.log('==========================================\n');

    const enExtractions = extractions.rows.length > 0;
    const enUnprocessable = unprocessable.rows.length > 0;
    const enMasterExcel = masterExcel.rows.length > 0;

    if (!enExtractions && enUnprocessable && !enMasterExcel) {
      console.log('✅ TODO CORRECTO:');
      console.log('   - NO está en extraction_results ✅');
      console.log('   - SÍ está en unprocessable_documents ✅');
      console.log('   - NO está en master_excel_output ✅\n');
    } else {
      console.log('❌ HAY UN PROBLEMA:');
      console.log(`   - Está en extraction_results: ${enExtractions ? 'SÍ ❌' : 'NO ✅'}`);
      console.log(`   - Está en unprocessable_documents: ${enUnprocessable ? 'SÍ ✅' : 'NO ❌'}`);
      console.log(`   - Está en master_excel_output: ${enMasterExcel ? 'SÍ ❌' : 'NO ✅'}\n`);
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

checkDoc001();
