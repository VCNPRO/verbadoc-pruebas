require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function findValues() {
  try {
    console.log('\n🔍 Buscando variaciones de 2032 y 7048...\n');

    // Buscar cualquier cosa con 2032 en acción
    const result2032 = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'codigo_grupo_detalle' as grupo,
        data->>'num_grupo' as num_grupo
      FROM reference_data
      WHERE is_active = true
      AND (
        data->>'d_cod_accion_formativa' LIKE '%2032%'
        OR data->>'id_accion_formativa' LIKE '%2032%'
      )
      LIMIT 10
    `;

    console.log(`Filas con 2032 en acción: ${result2032.rows.length}`);
    result2032.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. Exp: ${row.expediente}, Acción: ${row.accion}, Grupo: ${row.grupo || row.num_grupo}`);
    });

    // Buscar cualquier cosa con 7048 en grupo
    const result7048 = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'codigo_grupo_detalle' as grupo,
        data->>'num_grupo' as num_grupo
      FROM reference_data
      WHERE is_active = true
      AND (
        data->>'codigo_grupo_detalle' LIKE '%7048%'
        OR data->>'num_grupo' LIKE '%7048%'
      )
      LIMIT 10
    `;

    console.log(`\nFilas con 7048 en grupo: ${result7048.rows.length}`);
    result7048.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. Exp: ${row.expediente}, Acción: ${row.accion}, Grupo: ${row.grupo || row.num_grupo}`);
    });

    // Contar total de filas en reference_data
    const count = await sql`
      SELECT COUNT(*) as total
      FROM reference_data
      WHERE is_active = true
    `;

    console.log(`\n📊 Total de filas activas en reference_data: ${count.rows[0].total}`);

    // Ver si hay filas con expediente B241579AC
    const resultExp = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'codigo_grupo_detalle' as grupo
      FROM reference_data
      WHERE is_active = true
      AND data->>'numero_expediente' = 'B241579AC'
    `;

    console.log(`\n🔍 Filas con expediente B241579AC: ${resultExp.rows.length}`);
    resultExp.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. Acción: ${row.accion}, Grupo: ${row.grupo}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

findValues();
