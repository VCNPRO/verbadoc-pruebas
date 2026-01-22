require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function showSample() {
  try {
    console.log('\n🔍 Mostrando muestra completa de datos...\n');

    const result = await sql`
      SELECT data
      FROM reference_data
      WHERE is_active = true
      LIMIT 3
    `;

    result.rows.forEach((row, idx) => {
      console.log(`\n━━━━━ FILA ${idx + 1} ━━━━━`);
      const data = row.data;

      // Mostrar todos los campos
      Object.keys(data).sort().forEach(key => {
        const value = data[key];
        if (value && String(value).length < 100) {
          console.log(`  ${key}: ${value}`);
        }
      });
    });

    // Buscar campos que contengan "accion" o "grupo"
    console.log('\n\n📋 Campos relacionados con ACCIÓN o GRUPO:\n');
    const sample = result.rows[0].data;
    const keys = Object.keys(sample);

    const accionKeys = keys.filter(k => k.toLowerCase().includes('acci'));
    const grupoKeys = keys.filter(k => k.toLowerCase().includes('grup'));

    console.log('Campos con "acción":', accionKeys.join(', '));
    console.log('Campos con "grupo":', grupoKeys.join(', '));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

showSample();
