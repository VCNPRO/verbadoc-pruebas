require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function activateAll() {
  try {
    console.log('\n🚀 ACTIVANDO TODAS LAS FILAS DEL 13 DE ENERO...\n');

    // Activar TODAS las filas del 13 de enero en una sola query
    const result = await sql`
      UPDATE reference_data
      SET is_active = true,
          updated_at = NOW()
      WHERE created_at >= '2026-01-13 00:00:00'
      AND created_at < '2026-01-14 00:00:00'
      AND is_active = false
    `;

    console.log(`✅ ${result.rowCount} filas activadas correctamente\n`);

    // Verificar resultado
    console.log('📊 Verificando resultado final...\n');

    const verification = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as activas,
        COUNT(*) FILTER (WHERE is_active = false) as inactivas,
        COUNT(*) as total
      FROM reference_data
      WHERE created_at >= '2026-01-13 00:00:00'
      AND created_at < '2026-01-14 00:00:00'
    `;

    const stats = verification.rows[0];

    console.log('📊 RESULTADO FINAL - CARGA DEL 13 ENERO:');
    console.log(`   Total de filas: ${stats.total}`);
    console.log(`   ✅ Activas: ${stats.activas}`);
    console.log(`   ❌ Inactivas: ${stats.inactivas}`);
    console.log('');

    if (stats.inactivas === 0 && stats.activas === stats.total) {
      console.log('🎉 ¡TODAS LAS FILAS ESTÁN ACTIVAS!\n');
    } else {
      console.log('⚠️  Aún hay filas inactivas\n');
    }

    // Total en toda la BD
    const totalActive = await sql`
      SELECT COUNT(*) as total
      FROM reference_data
      WHERE is_active = true
    `;

    console.log(`📊 Total de filas activas en toda la BD: ${totalActive.rows[0].total}`);
    console.log(`   (Debería ser 2397 si todo está correcto)\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

activateAll();
