require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function activateRows() {
  try {
    console.log('\n🔧 Activando las 5 filas inactivas del expediente B241579AC...\n');

    // IDs de las 5 filas que deben activarse (de la carga del 13 enero)
    const idsToActivate = [
      '67715d27-6dcf-42df-8741-ec0ad66f73a7', // a - 2133 / g - 6941
      'e135fb56-1fbf-43c8-a2e3-1e43e9327613', // a - 2109 / g - 7007
      'e2b248e6-31e8-4a61-92d7-7c913206bfc5', // a - 1957 / g - 6656
      '34f85d85-bf59-4c92-89cf-7511019bfe49', // a - 1961 / g - 6829
      '9a7e41c5-d94a-4ef5-8ac5-a23013e14e64'  // a - 2032 / g - 7048 ← LA CRÍTICA
    ];

    let count = 0;
    for (const id of idsToActivate) {
      await sql`
        UPDATE reference_data
        SET is_active = true,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
      count++;
      console.log(`✅ Activada fila ${count}/5 (ID: ${id})`);
    }

    console.log(`\n✅ ${count} filas activadas correctamente\n`);

    // Verificar el resultado
    console.log('📊 Verificando resultado...\n');
    const result = await sql`
      SELECT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'codigo_grupo_detalle' as grupo,
        is_active
      FROM reference_data
      WHERE UPPER(TRIM(data->>'numero_expediente')) = UPPER(TRIM('B241579AC'))
      AND created_at > '2026-01-13'
      ORDER BY data->>'d_cod_accion_formativa'
    `;

    console.log('Filas del expediente B241579AC (carga del 13 enero):');
    result.rows.forEach((row, idx) => {
      const status = row.is_active ? '✅ ACTIVA' : '❌ INACTIVA';
      console.log(`  ${idx + 1}. ${row.accion} / ${row.grupo} - ${status}`);
    });

    console.log('\n✅ Proceso completado\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

activateRows();
