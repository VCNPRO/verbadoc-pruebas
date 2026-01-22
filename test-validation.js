/**
 * Script para probar validación con datos reales del Excel
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testValidation() {
  console.log('==========================================');
  console.log('PRUEBA DE VALIDACIÓN');
  console.log('==========================================\n');

  try {
    // 1. Obtener un registro real del Excel para usar en la prueba
    console.log('1️⃣  Obteniendo un registro de ejemplo del Excel...\n');

    const exampleRecord = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'num_grupo' as grupo,
        data->>'razon_social' as razon_social
      FROM reference_data
      WHERE is_active = true
      LIMIT 1
    `;

    const example = exampleRecord.rows[0];
    console.log('Registro de ejemplo:');
    console.log(`  Expediente: ${example.expediente}`);
    console.log(`  Acción: ${example.accion}`);
    console.log(`  Grupo: ${example.grupo}`);
    console.log(`  Razón Social: ${example.razon_social}\n`);

    // 2. Probar la validación exactamente como lo hace la API
    console.log('2️⃣  Probando validación (como en la API)...\n');

    const numero_expediente = example.expediente;
    const numero_accion = example.accion; // Podría ser "a - 5"
    const numero_grupo = example.grupo;   // Podría ser "3"

    console.log('Buscando con:');
    console.log(`  numero_expediente: "${numero_expediente}"`);
    console.log(`  numero_accion: "${numero_accion}"`);
    console.log(`  numero_grupo: "${numero_grupo}"\n`);

    // Query exacta de la API
    const referenceCheck = await sql`
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

    if (referenceCheck.rows.length > 0) {
      console.log('✅ VALIDACIÓN EXITOSA');
      console.log('   Registro encontrado en Excel de referencia\n');
      console.log('Datos del registro encontrado:');
      console.log(`  Form Identifier: ${referenceCheck.rows[0].form_identifier}`);
      console.log(`  Source File: ${referenceCheck.rows[0].source_file}\n`);
    } else {
      console.log('❌ VALIDACIÓN FALLIDA');
      console.log('   Registro NO encontrado\n');
    }

    // 3. Probar con variantes de la acción
    console.log('3️⃣  Probando variantes de acción...\n');

    // Si la acción es "a - 5", probar con "5"
    let accion_num = numero_accion;
    if (numero_accion && numero_accion.includes('a - ')) {
      accion_num = numero_accion.replace('a - ', '').trim();
      console.log(`  Acción original: "${numero_accion}"`);
      console.log(`  Acción numérica: "${accion_num}"\n`);

      const testVariant = await sql`
        SELECT * FROM reference_data
        WHERE is_active = true
        AND data->>'numero_expediente' = ${numero_expediente}
        AND (
          data->>'d_cod_accion_formativa' = ${accion_num}
          OR data->>'d_cod_accion_formativa' = ${'a - ' + accion_num}
          OR data->>'id_accion_formativa' = ${accion_num}
        )
        AND (
          data->>'num_grupo' = ${numero_grupo}
          OR data->>'codigo_grupo_detalle' LIKE ${'%' + numero_grupo + '%'}
        )
        LIMIT 1
      `;

      if (testVariant.rows.length > 0) {
        console.log('  ✅ Encontrado con variante numérica\n');
      } else {
        console.log('  ❌ No encontrado con variante numérica\n');
      }
    }

    // 4. Prueba con documento que NO existe
    console.log('4️⃣  Prueba negativa (documento que NO existe)...\n');

    const noExiste = await sql`
      SELECT * FROM reference_data
      WHERE is_active = true
      AND data->>'numero_expediente' = 'NOEXISTE999'
      LIMIT 1
    `;

    if (noExiste.rows.length === 0) {
      console.log('  ✅ Correctamente rechazado (no existe en BD)\n');
    } else {
      console.log('  ❌ ERROR: Se encontró un registro que no debería existir\n');
    }

    console.log('==========================================');
    console.log('✅ PRUEBA DE VALIDACIÓN COMPLETADA');
    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testValidation();
