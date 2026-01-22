/**
 * Obtener 10 ejemplos válidos del Excel para testing
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function getExamples() {
  console.log('==========================================');
  console.log('10 EJEMPLOS VÁLIDOS DEL EXCEL');
  console.log('==========================================\n');

  try {
    const examples = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion_completa,
        data->>'num_grupo' as grupo,
        data->>'razon_social' as razon_social
      FROM reference_data
      WHERE is_active = true
      ORDER BY RANDOM()
      LIMIT 10
    `;

    console.log('Si tienes PDFs con estos datos EXACTOS, deberían VALIDAR:\n');

    examples.rows.forEach((row, i) => {
      // Extraer el número de la acción (ej: "a - 28" -> "28")
      const accionNum = row.accion_completa ? row.accion_completa.replace('a - ', '').trim() : '';

      console.log(`${i + 1}. Expediente: ${row.expediente}`);
      console.log(`   Acción: ${accionNum} (en Excel: "${row.accion_completa}")`);
      console.log(`   Grupo: ${row.grupo}`);
      console.log(`   Razón Social: ${row.razon_social}`);
      console.log('');
    });

    console.log('==========================================');
    console.log('INSTRUCCIONES');
    console.log('==========================================\n');
    console.log('Para que un documento VALIDE, el PDF debe tener:');
    console.log('- Nº Expediente EXACTO');
    console.log('- Nº Acción EXACTO (solo el número, ej: 28)');
    console.log('- Nº Grupo EXACTO\n');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

getExamples();
