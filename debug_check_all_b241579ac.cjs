require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkAllRows() {
  try {
    console.log('\n🔍 Buscando TODAS las filas con expediente B241579AC...\n');

    // Buscar TODAS las filas (activas e inactivas)
    const resultAll = await sql`
      SELECT
        id,
        is_active,
        created_at,
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'codigo_grupo_detalle' as grupo
      FROM reference_data
      WHERE UPPER(TRIM(data->>'numero_expediente')) = UPPER(TRIM('B241579AC'))
      ORDER BY created_at DESC
    `;

    console.log(`Total de filas encontradas: ${resultAll.rows.length}\n`);

    if (resultAll.rows.length === 0) {
      console.log('❌ NO HAY NINGUNA FILA con ese expediente en la BD');
    } else {
      resultAll.rows.forEach((row, idx) => {
        console.log(`━━━ FILA ${idx + 1} ━━━`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Activa: ${row.is_active ? 'SÍ' : 'NO'}`);
        console.log(`  Expediente: ${row.expediente}`);
        console.log(`  Acción: ${row.accion}`);
        console.log(`  Grupo: ${row.grupo}`);
        console.log(`  Fecha carga: ${row.created_at}`);
        console.log('');
      });

      // Contar activas vs inactivas
      const activas = resultAll.rows.filter(r => r.is_active).length;
      const inactivas = resultAll.rows.filter(r => !r.is_active).length;

      console.log(`📊 Resumen:`);
      console.log(`   Activas: ${activas}`);
      console.log(`   Inactivas: ${inactivas}`);
      console.log(`   Total: ${resultAll.rows.length}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAllRows();
