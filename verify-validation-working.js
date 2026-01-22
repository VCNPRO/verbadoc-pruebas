/**
 * VERIFICACIÓN CRÍTICA: ¿La validación está funcionando?
 * Verificar si hay documentos en extraction_results que NO existen en reference_data
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function verifyValidation() {
  console.log('==========================================');
  console.log('🚨 VERIFICACIÓN CRÍTICA DE VALIDACIÓN');
  console.log('==========================================\n');

  try {
    // 1. Ver TODOS los extraction_results
    console.log('1️⃣  TODOS LOS DOCUMENTOS EN EXTRACTION_RESULTS:\n');

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
      ORDER BY created_at DESC
    `;

    console.log(`Total: ${extractions.rows.length} documentos procesados\n`);

    if (extractions.rows.length === 0) {
      console.log('✅ No hay documentos en extraction_results');
      console.log('   Esto significa que todos fueron rechazados correctamente\n');
    } else {
      console.log('⚠️  HAY DOCUMENTOS PROCESADOS. Verificando si son válidos...\n');

      // Verificar cada uno contra reference_data
      for (const ext of extractions.rows) {
        console.log(`📄 ${ext.filename}`);
        console.log(`   ID: ${ext.id}`);
        console.log(`   Expediente: ${ext.expediente}`);
        console.log(`   Acción: ${ext.accion || ext.num_accion}`);
        console.log(`   Grupo: ${ext.grupo || ext.num_grupo}`);
        console.log(`   Status: ${ext.validation_status}`);

        // Buscar en reference_data
        const numero_expediente = ext.expediente;
        const numero_accion = ext.accion || ext.num_accion;
        const numero_grupo = ext.grupo || ext.num_grupo;

        if (!numero_expediente) {
          console.log(`   ❌ ERROR: Sin número de expediente\n`);
          continue;
        }

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
          console.log(`   ✅ VÁLIDO: Existe en Excel de referencia\n`);
        } else {
          console.log(`   ❌ GRAVE: NO existe en Excel de referencia`);
          console.log(`   🚨 Este documento NO debería estar en extraction_results\n`);
        }
      }
    }

    // 2. Ver documentos en unprocessable_documents
    console.log('2️⃣  DOCUMENTOS RECHAZADOS (unprocessable_documents):\n');

    const unprocessable = await sql`
      SELECT
        filename,
        rejection_category,
        numero_expediente,
        numero_accion,
        numero_grupo,
        created_at
      FROM unprocessable_documents
      ORDER BY created_at DESC
    `;

    console.log(`Total: ${unprocessable.rows.length} documentos rechazados\n`);

    if (unprocessable.rows.length > 0) {
      unprocessable.rows.forEach((doc, i) => {
        console.log(`${i + 1}. ${doc.filename}`);
        console.log(`   Categoría: ${doc.rejection_category}`);
        console.log(`   Exp: ${doc.numero_expediente}, Acc: ${doc.numero_accion}, Grp: ${doc.numero_grupo}`);
        console.log('');
      });
    }

    // 3. CONCLUSIÓN
    console.log('==========================================');
    console.log('🎯 CONCLUSIÓN');
    console.log('==========================================\n');

    const totalProcesados = extractions.rows.length;
    const totalRechazados = unprocessable.rows.length;

    console.log(`Documentos procesados (extraction_results): ${totalProcesados}`);
    console.log(`Documentos rechazados (unprocessable_documents): ${totalRechazados}`);
    console.log('');

    if (totalProcesados === 0 && totalRechazados === 0) {
      console.log('ℹ️  No se ha procesado ningún documento aún');
      console.log('   Procesa DOC_002 y vuelve a ejecutar este script\n');
    } else if (totalProcesados > 0) {
      console.log('⚠️  REVISAR: Hay documentos procesados');
      console.log('   Verifica arriba si alguno NO debería estar ahí\n');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

verifyValidation();
