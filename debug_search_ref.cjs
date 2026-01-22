require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function searchReference() {
  try {
    console.log('\n🔍 Buscando Acción=2032 y Grupo=7048 en TODA la base de datos...\n');

    // Buscar ambos juntos
    const result = await sql`
      SELECT id,
             data->>'numero_expediente' as expediente,
             data->>'d_cod_accion_formativa' as cod_accion,
             data->>'id_accion_formativa' as id_accion,
             data->>'num_grupo' as num_grupo,
             data->>'codigo_grupo_detalle' as codigo_grupo
      FROM reference_data
      WHERE is_active = true
      AND (
        data->>'d_cod_accion_formativa' LIKE '%2032%'
        OR data->>'id_accion_formativa' LIKE '%2032%'
        OR data->>'d_cod_accion_formativa' = '2032'
        OR data->>'id_accion_formativa' = '2032'
      )
      AND (
        data->>'num_grupo' LIKE '%7048%'
        OR data->>'codigo_grupo_detalle' LIKE '%7048%'
        OR data->>'num_grupo' = '7048'
        OR data->>'codigo_grupo_detalle' = '7048'
      )
    `;

    console.log(`✅ Filas con AMBOS (Acción 2032 Y Grupo 7048): ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log('❌ NO SE ENCONTRÓ ninguna fila con esos valores');
      console.log('\nEsto significa que:');
      console.log('  1. Los valores extraídos del PDF NO están en el Excel de referencia');
      console.log('  2. O los valores extraídos del PDF son incorrectos');
      console.log('  3. O el Excel de referencia no tiene esa combinación\n');
    } else {
      result.rows.forEach((row, idx) => {
        console.log(`━━━ COINCIDENCIA ${idx + 1} ━━━`);
        console.log(`  Expediente: ${row.expediente}`);
        console.log(`  Acción (cod): ${row.cod_accion}`);
        console.log(`  Acción (id): ${row.id_accion}`);
        console.log(`  Grupo (num): ${row.num_grupo}`);
        console.log(`  Grupo (codigo): ${row.codigo_grupo}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

searchReference();
