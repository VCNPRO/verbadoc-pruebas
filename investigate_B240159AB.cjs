require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function investigateExpediente() {
  try {
    console.log('\n🔍 INVESTIGANDO EXPEDIENTE B240159AB\n');
    console.log('Archivo: DOC_001_Pags_1-2_load_test_1.pdf');
    console.log('Reportado: a-465 y g-0424\n');

    const userId = (await sql`SELECT id FROM users WHERE email = 'test@test.eu'`).rows[0].id;

    // 1. Buscar en reference_data el expediente B240159AB
    console.log('━━━ 1. DATOS EN EXCEL DE REFERENCIA (reference_data) ━━━');
    const refData = await sql`
      SELECT
        id,
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'id_accion_formativa' as accion2,
        data->>'id_cod_grupo' as grupo,
        data->>'nif_empresa' as cif,
        data->>'razon_social' as empresa,
        is_active,
        data
      FROM reference_data
      WHERE data->>'numero_expediente' = 'B240159AB'
    `;

    if (refData.rows.length === 0) {
      console.log('❌ NO EXISTE el expediente B240159AB en reference_data\n');
      console.log('   ESTO SIGNIFICA: El Excel de referencia NO tiene este expediente');
      console.log('   Por lo tanto, el formulario NO debería haber pasado la validación\n');
    } else {
      console.log(`✅ Encontradas ${refData.rows.length} filas con expediente B240159AB:\n`);
      refData.rows.forEach((row, idx) => {
        console.log(`  FILA ${idx + 1}:`);
        console.log(`     Expediente: ${row.expediente}`);
        console.log(`     Acción (d_cod_accion_formativa): ${row.accion}`);
        console.log(`     Acción (id_accion_formativa): ${row.accion2}`);
        console.log(`     Grupo (id_cod_grupo): ${row.grupo}`);
        console.log(`     CIF: ${row.cif}`);
        console.log(`     Empresa: ${row.empresa}`);
        console.log(`     Activa: ${row.is_active}\n`);
      });

      // Mostrar todos los campos del JSON para análisis completo
      console.log('━━━ DATOS COMPLETOS EN JSON ━━━');
      console.log(JSON.stringify(refData.rows[0].data, null, 2));
      console.log('\n');
    }

    // 2. Buscar el formulario procesado
    console.log('━━━ 2. FORMULARIO PROCESADO ━━━');
    const processed = await sql`
      SELECT
        id,
        filename,
        extracted_data->>'numero_expediente' as expediente,
        extracted_data->>'expediente' as expediente2,
        extracted_data->>'num_accion' as accion,
        extracted_data->>'numero_accion' as accion2,
        extracted_data->>'num_grupo' as grupo,
        extracted_data->>'numero_grupo' as grupo2,
        extracted_data->>'cif' as cif,
        validation_status,
        created_at
      FROM extraction_results
      WHERE user_id = ${userId}
      AND (
        filename ILIKE '%DOC_001%'
        OR extracted_data->>'numero_expediente' = 'B240159AB'
      )
      ORDER BY created_at DESC
    `;

    if (processed.rows.length === 0) {
      console.log('❌ NO se encontró el formulario DOC_001 procesado\n');
    } else {
      console.log(`✅ Encontrados ${processed.rows.length} formularios:\n`);
      processed.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.filename}`);
        console.log(`     Expediente: ${row.expediente || row.expediente2}`);
        console.log(`     Acción: ${row.accion || row.accion2}`);
        console.log(`     Grupo: ${row.grupo || row.grupo2}`);
        console.log(`     CIF: ${row.cif}`);
        console.log(`     Estado: ${row.validation_status}`);
        console.log(`     Fecha: ${row.created_at}\n`);
      });
    }

    // 3. Buscar en master_excel_output
    console.log('━━━ 3. EN EXCEL MASTER (master_excel_output) ━━━');
    const masterExcel = await sql`
      SELECT
        id,
        filename,
        row_number,
        row_data->>'numero_expediente' as expediente,
        row_data->>'num_accion' as accion,
        row_data->>'num_grupo' as grupo,
        validation_status
      FROM master_excel_output
      WHERE user_id = ${userId}
      AND (
        filename ILIKE '%DOC_001%'
        OR row_data->>'numero_expediente' = 'B240159AB'
      )
      ORDER BY row_number
    `;

    if (masterExcel.rows.length === 0) {
      console.log('❌ NO está en master_excel_output\n');
    } else {
      console.log(`✅ Encontradas ${masterExcel.rows.length} filas:\n`);
      masterExcel.rows.forEach((row, idx) => {
        console.log(`  Línea ${row.row_number}: ${row.filename}`);
        console.log(`     Expediente: ${row.expediente}`);
        console.log(`     Acción: ${row.accion}`);
        console.log(`     Grupo: ${row.grupo}`);
        console.log(`     Estado: ${row.validation_status}\n`);
      });
    }

    // CONCLUSIONES
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CONCLUSIONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (refData.rows.length === 0) {
      console.log('🚨 PROBLEMA CONFIRMADO:');
      console.log('   - El expediente B240159AB NO existe en reference_data');
      console.log('   - El formulario dice tener a-465 y g-0424');
      console.log('   - Pero NO debería haber pasado la validación\n');
      console.log('   CAUSA: Error en la lógica de matching que permite');
      console.log('          coincidencias parciales con .includes()\n');
    } else {
      const ref = refData.rows[0];
      const refAccion = ref.accion || ref.accion2 || '';
      const refGrupo = ref.grupo || '';

      console.log('📊 COMPARACIÓN:');
      console.log(`   Excel dice:       Acción "${refAccion}" / Grupo "${refGrupo}"`);
      console.log(`   Formulario dice:  Acción "a-465" / Grupo "g-0424"\n`);

      if (refAccion.includes('465') && !refAccion.match(/^a\s*-\s*465$/i)) {
        console.log('🚨 MATCHING INCORRECTO DETECTADO:');
        console.log('   El Excel tiene una acción que CONTIENE "465" pero NO ES "a-465"');
        console.log(`   Acción real: "${refAccion}"`);
        console.log('   Esto confirma que el .includes() es demasiado permisivo\n');
      }

      if (refGrupo && refGrupo.includes('424') && !refGrupo.match(/^g\s*-\s*0?424$/i)) {
        console.log('🚨 MATCHING INCORRECTO DETECTADO (Grupo):');
        console.log('   El Excel tiene un grupo que CONTIENE "424" pero NO ES "g-0424"');
        console.log(`   Grupo real: "${refGrupo}"`);
        console.log('   Esto confirma que el .includes() es demasiado permisivo\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

investigateExpediente();
