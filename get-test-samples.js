/**
 * Obtener 5 registros de ejemplo del Excel para testing
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function getTestSamples() {
  console.log('==========================================');
  console.log('REGISTROS DE EJEMPLO PARA TESTING');
  console.log('==========================================\n');

  try {
    // Obtener 5 registros aleatorios del Excel
    const samples = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'num_grupo' as grupo,
        data->>'razon_social' as razon_social,
        data->>'nif_empresa' as nif
      FROM reference_data
      WHERE is_active = true
      ORDER BY RANDOM()
      LIMIT 5
    `;

    console.log('📋 5 REGISTROS VÁLIDOS DEL EXCEL:\n');
    console.log('Puedes crear PDFs de prueba con estos datos:\n');

    samples.rows.forEach((row, i) => {
      console.log(`${i + 1}. DOCUMENTO VÁLIDO #${i + 1}`);
      console.log(`   Expediente: ${row.expediente}`);
      console.log(`   Acción: ${row.accion}`);
      console.log(`   Grupo: ${row.grupo}`);
      console.log(`   Razón Social: ${row.razon_social}`);
      console.log(`   NIF: ${row.nif}`);
      console.log('');
    });

    console.log('==========================================');
    console.log('DOCUMENTO INVÁLIDO (para testing)');
    console.log('==========================================\n');

    console.log('Para probar rechazo, usa estos datos que NO existen:\n');
    console.log('DOCUMENTO INVÁLIDO #1:');
    console.log('   Expediente: NOEXISTE999');
    console.log('   Acción: 999');
    console.log('   Grupo: 999');
    console.log('');

    console.log('DOCUMENTO INVÁLIDO #2 (DOC_001 - ya lo tienes):');
    console.log('   Expediente: B211801AA');
    console.log('   Acción: 40');
    console.log('   Grupo: 4');
    console.log('   (Ya verificamos que NO existe en Excel)\n');

    console.log('==========================================');
    console.log('INSTRUCCIONES');
    console.log('==========================================\n');

    console.log('1. Crea PDFs de prueba con estos datos (o edita DOC_001)');
    console.log('2. Procesa primero UN documento VÁLIDO');
    console.log('3. Procesa UN documento INVÁLIDO');
    console.log('4. Verifica que el VÁLIDO va a /review y /master-excel');
    console.log('5. Verifica que el INVÁLIDO va a /unprocessable\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

getTestSamples();
