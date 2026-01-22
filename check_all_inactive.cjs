require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkAllInactive() {
  try {
    console.log('\n🔍 Verificando estado de TODAS las filas del 13 de enero...\n');

    // Contar filas de la última carga (13 enero)
    const countResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as activas,
        COUNT(*) FILTER (WHERE is_active = false) as inactivas,
        COUNT(*) as total
      FROM reference_data
      WHERE created_at >= '2026-01-13 00:00:00'
      AND created_at < '2026-01-14 00:00:00'
    `;

    const stats = countResult.rows[0];

    console.log('📊 ESTADÍSTICAS DE LA CARGA DEL 13 ENERO:');
    console.log(`   Total de filas: ${stats.total}`);
    console.log(`   ✅ Activas: ${stats.activas}`);
    console.log(`   ❌ Inactivas: ${stats.inactivas}`);
    console.log('');

    if (stats.inactivas > 0) {
      console.log(`⚠️  HAY ${stats.inactivas} FILAS INACTIVAS QUE DEBEN ACTIVARSE\n`);

      // Mostrar muestra de las inactivas
      const sample = await sql`
        SELECT
          id,
          data->>'numero_expediente' as expediente,
          data->>'d_cod_accion_formativa' as accion,
          data->>'codigo_grupo_detalle' as grupo
        FROM reference_data
        WHERE created_at >= '2026-01-13 00:00:00'
        AND created_at < '2026-01-14 00:00:00'
        AND is_active = false
        LIMIT 10
      `;

      console.log('Muestra de filas inactivas (primeras 10):');
      sample.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.expediente} - ${row.accion} / ${row.grupo}`);
      });
      console.log('');
    } else {
      console.log('✅ TODAS LAS FILAS ESTÁN ACTIVAS\n');
    }

    // Verificar total de filas activas en toda la BD
    const totalActive = await sql`
      SELECT COUNT(*) as total
      FROM reference_data
      WHERE is_active = true
    `;

    console.log(`📊 Total de filas activas en toda la BD: ${totalActive.rows[0].total}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAllInactive();
