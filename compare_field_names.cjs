require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function compareFields() {
  try {
    console.log('\n🔍 COMPARANDO NOMBRES DE CAMPOS\n');

    // 1. Obtener campos configurados en column_mappings
    const mappingConfig = await sql`
      SELECT mappings FROM column_mappings
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      AND is_active = true
      LIMIT 1
    `;

    if (mappingConfig.rows.length === 0) {
      console.log('❌ No hay configuración activa');
      return;
    }

    const configuredFields = mappingConfig.rows[0].mappings.map(m => m.fundaeField);
    console.log(`📋 Campos configurados en column_mappings: ${configuredFields.length}\n`);

    // 2. Obtener campos reales del último formulario procesado
    const lastRow = await sql`
      SELECT row_data
      FROM master_excel_output
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      AND is_latest = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (lastRow.rows.length === 0) {
      console.log('❌ No hay formularios en master_excel_output');
      return;
    }

    const actualFields = Object.keys(lastRow.rows[0].row_data);
    console.log(`📄 Campos reales en formulario procesado: ${actualFields.length}\n`);

    // 3. Comparar
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ANÁLISIS DE COINCIDENCIAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let matched = 0;
    let notFound = [];

    configuredFields.forEach(configField => {
      if (actualFields.includes(configField)) {
        console.log(`✅ "${configField}" - EXISTE en datos`);
        matched++;
      } else {
        console.log(`❌ "${configField}" - NO EXISTE en datos`);
        notFound.push(configField);
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RESUMEN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Campos que COINCIDEN: ${matched} / ${configuredFields.length}`);
    console.log(`❌ Campos que NO EXISTEN: ${notFound.length}\n`);

    if (notFound.length > 0) {
      console.log('❌ Campos configurados que NO existen en datos:\n');
      notFound.forEach(field => console.log(`   - ${field}`));
      console.log('');
    }

    // 4. Mostrar campos disponibles en datos
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CAMPOS DISPONIBLES EN DATOS EXTRAÍDOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    actualFields.sort().forEach(field => {
      const value = lastRow.rows[0].row_data[field];
      const preview = value ? String(value).substring(0, 30) : '(vacío)';
      console.log(`  ${field}: ${preview}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

compareFields();
