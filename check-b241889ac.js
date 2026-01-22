/**
 * Verificar B241889AC específicamente
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkSpecific() {
  console.log('==========================================');
  console.log('VERIFICACIÓN: B241889AC');
  console.log('==========================================\n');

  try {
    // Buscar en reference_data
    console.log('1️⃣  Buscando B241889AC en Excel de referencia:\n');

    const record = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'id_accion_formativa' as id_accion,
        data->>'num_grupo' as num_grupo,
        data->>'codigo_grupo' as codigo_grupo,
        data->>'codigo_grupo_detalle' as codigo_grupo_detalle,
        data
      FROM reference_data
      WHERE is_active = true
      AND data->>'numero_expediente' = 'B241889AC'
      LIMIT 1
    `;

    if (record.rows.length === 0) {
      console.log('❌ NO ENCONTRADO en reference_data\n');
      process.exit(0);
    }

    const r = record.rows[0];
    console.log('✅ ENCONTRADO:');
    console.log(`   Expediente: ${r.expediente}`);
    console.log(`   d_cod_accion_formativa: "${r.accion}"`);
    console.log(`   id_accion_formativa: "${r.id_accion}"`);
    console.log(`   num_grupo: "${r.num_grupo}"`);
    console.log(`   codigo_grupo: "${r.codigo_grupo}"`);
    console.log(`   codigo_grupo_detalle: "${r.codigo_grupo_detalle}"`);
    console.log('');

    // Probar las queries que hace el código
    console.log('2️⃣  Probando QUERY DE VALIDACIÓN del código:\n');

    const numero_expediente = 'B241889AC';
    const numero_accion = '4';
    const numero_grupo = '5';

    console.log('Extracción dice:');
    console.log(`   Expediente: "${numero_expediente}"`);
    console.log(`   Acción: "${numero_accion}"`);
    console.log(`   Grupo: "${numero_grupo}"`);
    console.log('');

    // Query exacta del código
    const validation = await sql`
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

    console.log('Resultado de la query:');
    if (validation.rows.length > 0) {
      console.log('   ✅ ENCONTRADO (debería validar)\n');
    } else {
      console.log('   ❌ NO ENCONTRADO (por eso rechaza)\n');
    }

    // Probar queries individuales
    console.log('3️⃣  Probando COMPONENTES de la query:\n');

    const test1 = await sql`
      SELECT COUNT(*) as count FROM reference_data
      WHERE is_active = true
      AND data->>'numero_expediente' = ${numero_expediente}
    `;
    console.log(`   Expediente match: ${test1.rows[0].count}`);

    const test2 = await sql`
      SELECT COUNT(*) as count FROM reference_data
      WHERE is_active = true
      AND data->>'numero_expediente' = ${numero_expediente}
      AND (
        data->>'d_cod_accion_formativa' = ${numero_accion}
        OR data->>'d_cod_accion_formativa' = ${'a - ' + numero_accion}
        OR data->>'id_accion_formativa' = ${numero_accion}
      )
    `;
    console.log(`   + Acción match: ${test2.rows[0].count}`);

    const test3 = await sql`
      SELECT COUNT(*) as count FROM reference_data
      WHERE is_active = true
      AND data->>'numero_expediente' = ${numero_expediente}
      AND (
        data->>'num_grupo' = ${numero_grupo}
        OR data->>'codigo_grupo_detalle' LIKE ${'%' + numero_grupo + '%'}
      )
    `;
    console.log(`   + Grupo match: ${test3.rows[0].count}`);
    console.log('');

    // Ver qué pasa con el grupo específicamente
    console.log('4️⃣  ANÁLISIS DEL GRUPO:\n');

    console.log(`El Excel tiene:`);
    console.log(`   num_grupo: "${r.num_grupo}"`);
    console.log(`   codigo_grupo_detalle: "${r.codigo_grupo_detalle}"`);
    console.log('');

    console.log(`El código busca:`);
    console.log(`   num_grupo = "5" → Match: ${r.num_grupo === '5' ? 'SÍ' : 'NO'}`);
    console.log(`   codigo_grupo_detalle LIKE "%5%" → Match: ${r.codigo_grupo_detalle && r.codigo_grupo_detalle.includes('5') ? 'SÍ' : 'NO'}`);
    console.log('');

    if (r.num_grupo !== '5' && (!r.codigo_grupo_detalle || !r.codigo_grupo_detalle.includes('5'))) {
      console.log('🚨 PROBLEMA ENCONTRADO:');
      console.log('   El grupo NO coincide con ninguna de las condiciones');
      console.log('');
      console.log('SOLUCIÓN:');
      console.log('   Agregar más variantes de búsqueda para el grupo');
      console.log('   O normalizar el formato del grupo extraído');
      console.log('');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

checkSpecific();
