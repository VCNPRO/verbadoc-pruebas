require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function investigateLine2269() {
  try {
    console.log('\n🚨 INVESTIGANDO ERROR GRAVE EN LÍNEA 2269\n');
    console.log('Formulario que coincide con a-465 y g-0424\n');

    const userId = (await sql`SELECT id FROM users WHERE email = 'test@test.eu'`).rows[0].id;

    // 1. Buscar en reference_data filas con a-465
    console.log('━━━ 1. BUSCANDO a-465 EN reference_data ━━━');
    const accion465 = await sql`
      SELECT
        id,
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'id_cod_grupo' as grupo,
        is_active
      FROM reference_data
      WHERE is_active = true
      AND (
        data->>'d_cod_accion_formativa' ILIKE '%465%'
        OR data->>'id_accion_formativa' ILIKE '%465%'
      )
      ORDER BY data->>'numero_expediente'
    `;

    if (accion465.rows.length === 0) {
      console.log('❌ No se encontró a-465 en reference_data\n');
    } else {
      console.log(`✅ Encontradas ${accion465.rows.length} filas con a-465:\n`);
      accion465.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Expediente: ${row.expediente}`);
        console.log(`     Acción: ${row.accion}`);
        console.log(`     Grupo: ${row.grupo}`);
        console.log(`     Activa: ${row.is_active}\n`);
      });
    }

    // 2. Buscar específicamente a-465 + g-0424
    console.log('━━━ 2. BUSCANDO COMBINACIÓN a-465 + g-0424 ━━━');
    const combo = await sql`
      SELECT
        id,
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'id_cod_grupo' as grupo,
        data->>'nif_empresa' as cif,
        data->>'razon_social' as razon_social
      FROM reference_data
      WHERE is_active = true
      AND (
        data->>'d_cod_accion_formativa' ILIKE '%465%'
        OR data->>'id_accion_formativa' ILIKE '%465%'
      )
      AND (
        data->>'id_cod_grupo' ILIKE '%424%'
        OR data->>'id_cod_grupo' ILIKE '%0424%'
      )
    `;

    if (combo.rows.length === 0) {
      console.log('❌ NO EXISTE la combinación a-465 + g-0424 en reference_data');
      console.log('   ESTO ES EL PROBLEMA: El formulario procesado coincidió con algo que no existe\n');
    } else {
      console.log(`✅ Encontradas ${combo.rows.length} filas con a-465 + g-0424:\n`);
      combo.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Expediente: ${row.expediente}`);
        console.log(`     Acción: ${row.accion}`);
        console.log(`     Grupo: ${row.grupo}`);
        console.log(`     CIF: ${row.cif}`);
        console.log(`     Empresa: ${row.razon_social}\n`);
      });
    }

    // 3. Buscar formularios procesados que coincidan con 465 y 424
    console.log('━━━ 3. FORMULARIOS PROCESADOS CON 465/424 ━━━');
    const processed = await sql`
      SELECT
        id,
        filename,
        extracted_data->>'numero_expediente' as expediente,
        extracted_data->>'num_accion' as accion,
        extracted_data->>'num_grupo' as grupo,
        validation_status,
        created_at
      FROM extraction_results
      WHERE user_id = ${userId}
      AND (
        extracted_data->>'num_accion' ILIKE '%465%'
        OR extracted_data->>'numero_accion' ILIKE '%465%'
      )
    `;

    if (processed.rows.length === 0) {
      console.log('❌ No hay formularios procesados con acción 465\n');
    } else {
      console.log(`✅ Encontrados ${processed.rows.length} formularios con acción 465:\n`);
      processed.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.filename}`);
        console.log(`     Expediente: ${row.expediente}`);
        console.log(`     Acción: ${row.accion}`);
        console.log(`     Grupo: ${row.grupo}`);
        console.log(`     Estado: ${row.validation_status}`);
        console.log(`     Fecha: ${row.created_at}\n`);
      });
    }

    // 4. Buscar en master_excel_output en línea 2269
    console.log('━━━ 4. BUSCANDO LÍNEA 2269 EN master_excel_output ━━━');
    const line2269 = await sql`
      SELECT
        id,
        filename,
        row_number,
        row_data->>'numero_expediente' as expediente,
        row_data->>'num_accion' as accion,
        row_data->>'num_grupo' as grupo,
        row_data->>'cif' as cif,
        validation_status
      FROM master_excel_output
      WHERE user_id = ${userId}
      AND row_number = 2269
    `;

    if (line2269.rows.length === 0) {
      console.log('❌ No hay línea 2269 en master_excel_output');
      console.log('   Nota: Puede que la numeración haya cambiado\n');

      // Buscar por rango cercano
      const nearby = await sql`
        SELECT
          row_number,
          filename,
          row_data->>'num_accion' as accion,
          row_data->>'num_grupo' as grupo
        FROM master_excel_output
        WHERE user_id = ${userId}
        AND row_number BETWEEN 2265 AND 2275
        ORDER BY row_number
      `;

      if (nearby.rows.length > 0) {
        console.log('📊 Líneas cercanas a 2269:');
        nearby.rows.forEach(row => {
          console.log(`  Línea ${row.row_number}: ${row.filename} - a-${row.accion} / g-${row.grupo}`);
        });
        console.log('');
      }
    } else {
      console.log('✅ Línea 2269 encontrada:\n');
      const row = line2269.rows[0];
      console.log(`  Archivo: ${row.filename}`);
      console.log(`  Expediente: ${row.expediente}`);
      console.log(`  Acción: ${row.accion}`);
      console.log(`  Grupo: ${row.grupo}`);
      console.log(`  CIF: ${row.cif}`);
      console.log(`  Estado: ${row.validation_status}\n`);
    }

    // DIAGNÓSTICO
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNÓSTICO DEL ERROR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (combo.rows.length === 0) {
      console.log('🚨 CAUSA RAÍZ: La combinación a-465 + g-0424 NO EXISTE en reference_data');
      console.log('\n   POSIBLES EXPLICACIONES:');
      console.log('   1. Error de OCR: Leyó mal el código (ej: 465 en vez de 466)');
      console.log('   2. Excel de referencia incorrecto o incompleto');
      console.log('   3. El formulario es de otro expediente que no está cargado');
      console.log('   4. Error en la lógica de matching (demasiado permisiva)\n');

      console.log('   SOLUCIONES:');
      console.log('   1. Verificar el PDF original para confirmar códigos');
      console.log('   2. Revisar el Excel de referencia (¿falta esta combinación?)');
      console.log('   3. Ajustar lógica de matching para ser más estricta\n');
    } else {
      console.log('✅ La combinación a-465 + g-0424 SÍ EXISTE en reference_data');
      console.log('   El error puede ser en la validación posterior o en otra línea\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

investigateLine2269();
