require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function searchExact() {
  try {
    console.log('\n🔍 Buscando EXACTAMENTE "a - 2032" y "g - 7048"...\n');

    // Buscar con los valores exactos que debe tener
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
        data->>'d_cod_accion_formativa' = 'a - 2032'
        OR data->>'id_accion_formativa' = 'a - 2032'
      )
      AND (
        data->>'num_grupo' = 'g - 7048'
        OR data->>'codigo_grupo_detalle' = 'g - 7048'
      )
    `;

    console.log(`✅ Filas encontradas: ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log('❌ NO SE ENCONTRÓ con valores exactos "a - 2032" y "g - 7048"');

      // Buscar solo por Acción
      console.log('\n🔍 Buscando solo "a - 2032"...\n');
      const resultAccion = await sql`
        SELECT id,
               data->>'numero_expediente' as expediente,
               data->>'d_cod_accion_formativa' as cod_accion,
               data->>'id_accion_formativa' as id_accion,
               data->>'num_grupo' as num_grupo,
               data->>'codigo_grupo_detalle' as codigo_grupo
        FROM reference_data
        WHERE is_active = true
        AND (
          data->>'d_cod_accion_formativa' = 'a - 2032'
          OR data->>'id_accion_formativa' = 'a - 2032'
        )
        LIMIT 5
      `;

      console.log(`Filas con "a - 2032": ${resultAccion.rows.length}`);
      resultAccion.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Exp: ${row.expediente}, Grupo: ${row.codigo_grupo || row.num_grupo}`);
      });

      // Buscar solo por Grupo
      console.log('\n🔍 Buscando solo "g - 7048"...\n');
      const resultGrupo = await sql`
        SELECT id,
               data->>'numero_expediente' as expediente,
               data->>'d_cod_accion_formativa' as cod_accion,
               data->>'id_accion_formativa' as id_accion,
               data->>'num_grupo' as num_grupo,
               data->>'codigo_grupo_detalle' as codigo_grupo
        FROM reference_data
        WHERE is_active = true
        AND (
          data->>'num_grupo' = 'g - 7048'
          OR data->>'codigo_grupo_detalle' = 'g - 7048'
        )
        LIMIT 5
      `;

      console.log(`Filas con "g - 7048": ${resultGrupo.rows.length}`);
      resultGrupo.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Exp: ${row.expediente}, Acción: ${row.cod_accion || row.id_accion}`);
      });

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

    // Ver qué campos tiene la tabla reference_data
    console.log('\n📋 Veamos una muestra de cómo se almacenan los datos...\n');
    const sample = await sql`
      SELECT data
      FROM reference_data
      WHERE is_active = true
      LIMIT 1
    `;

    if (sample.rows.length > 0) {
      const keys = Object.keys(sample.rows[0].data);
      console.log('Campos disponibles en data:', keys.slice(0, 20).join(', '));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

searchExact();
