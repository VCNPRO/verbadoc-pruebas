/**
 * Verificar último documento procesado
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkLastProcessed() {
  console.log('==========================================');
  console.log('ÚLTIMO DOCUMENTO PROCESADO');
  console.log('==========================================\n');

  try {
    // 1. Último en extraction_results
    console.log('1️⃣  ÚLTIMO EN EXTRACTION_RESULTS:\n');

    const lastExtraction = await sql`
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
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (lastExtraction.rows.length > 0) {
      const doc = lastExtraction.rows[0];
      console.log(`✅ Encontrado:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Filename: ${doc.filename}`);
      console.log(`   Expediente: ${doc.expediente}`);
      console.log(`   Acción: ${doc.accion || doc.num_accion}`);
      console.log(`   Grupo: ${doc.grupo || doc.num_grupo}`);
      console.log(`   Status: ${doc.validation_status}`);
      console.log(`   Fecha: ${doc.created_at}\n`);

      // Verificar si existe en master_excel_output
      console.log('2️⃣  VERIFICANDO EN MASTER_EXCEL_OUTPUT:\n');

      const inMaster = await sql`
        SELECT
          id,
          extraction_id,
          row_number,
          validation_status,
          created_at
        FROM master_excel_output
        WHERE extraction_id = ${doc.id}
        LIMIT 1
      `;

      if (inMaster.rows.length > 0) {
        console.log(`✅ SÍ está en master_excel_output:`);
        console.log(`   Row ID: ${inMaster.rows[0].id}`);
        console.log(`   Row Number: ${inMaster.rows[0].row_number}`);
        console.log(`   Status: ${inMaster.rows[0].validation_status}`);
        console.log(`   Fecha: ${inMaster.rows[0].created_at}\n`);
      } else {
        console.log(`❌ NO está en master_excel_output\n`);
        console.log(`🚨 PROBLEMA: El documento válido NO se guardó en Excel Master\n`);
      }

      // Verificar si el documento es válido según reference_data
      console.log('3️⃣  VALIDACIÓN CONTRA EXCEL DE REFERENCIA:\n');

      const numero_expediente = doc.expediente;
      const numero_accion = doc.accion || doc.num_accion;
      const numero_grupo = doc.grupo || doc.num_grupo;

      const exists = await sql`
        SELECT * FROM reference_data
        WHERE is_active = true
        AND data->>'numero_expediente' = ${numero_expediente}
        AND (
          data->>'d_cod_accion_formativa' = ${numero_accion}
          OR data->>'d_cod_accion_formativa' = ${'a - ' + numero_accion}
          OR data->>'id_accion_formativa' = ${numero_accion}
        )
        AND (
          data->>'num_grupo' = ${numero_grupo}
          OR data->>'codigo_grupo_detalle' LIKE ${'%' + numero_grupo + '%'}
        )
        LIMIT 1
      `;

      if (exists.rows.length > 0) {
        console.log(`✅ VÁLIDO: Existe en Excel de referencia\n`);
      } else {
        console.log(`❌ INVÁLIDO: NO existe en Excel de referencia\n`);
      }

    } else {
      console.log('ℹ️  No hay documentos en extraction_results\n');
    }

    // 4. Últimos en unprocessable_documents
    console.log('4️⃣  ÚLTIMOS EN UNPROCESSABLE_DOCUMENTS:\n');

    const unproc = await sql`
      SELECT
        filename,
        rejection_category,
        numero_expediente,
        created_at
      FROM unprocessable_documents
      ORDER BY created_at DESC
      LIMIT 3
    `;

    if (unproc.rows.length > 0) {
      unproc.rows.forEach((doc, i) => {
        console.log(`${i + 1}. ${doc.filename}`);
        console.log(`   Categoría: ${doc.rejection_category}`);
        console.log(`   Expediente: ${doc.numero_expediente}`);
        console.log(`   Fecha: ${doc.created_at}\n`);
      });
    } else {
      console.log('(ninguno)\n');
    }

    // 5. Total en master_excel_output
    console.log('5️⃣  TOTAL EN MASTER_EXCEL_OUTPUT:\n');

    const masterCount = await sql`
      SELECT COUNT(*) as total
      FROM master_excel_output
    `;

    console.log(`Total filas: ${masterCount.rows[0].total}\n`);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

checkLastProcessed();
