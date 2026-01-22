import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

if (fs.existsSync('.env.production')) {
  dotenv.config({ path: '.env.production' });
}

async function checkDB() {
  try {
    console.log('🔍 Verificando base de datos...\n');

    // 1. Total registros en reference_data
    const count = await sql`SELECT COUNT(*) as total FROM reference_data WHERE is_active = TRUE`;
    const total = parseInt(count.rows[0].total);

    console.log('📊 Total registros en reference_data:', total);

    if (total > 0) {
      console.log('✅ Excel SÍ se guardó en la BD\n');

      // 2. Mostrar columnas/estructura de un registro
      const sample = await sql`SELECT * FROM reference_data LIMIT 1`;
      if (sample.rows.length > 0) {
        console.log('📋 Estructura de datos:');
        console.log('Columnas:', Object.keys(sample.rows[0]));
        console.log('');
      }

      // 3. Buscar expedientes de los PDFs encontrados en la carpeta
      console.log('🔎 Buscando expedientes de los PDFs en la BD:\n');
      const expedientes = ['B241889AC', 'B241579AC', 'B241669AI', 'B211801AA'];

      for (const exp of expedientes) {
        const result = await sql`
          SELECT form_identifier, data
          FROM reference_data
          WHERE form_identifier = ${exp}
          LIMIT 1
        `;

        if (result.rows.length > 0) {
          const data = result.rows[0].data;
          console.log(`✅ ${exp} - ENCONTRADO`);
          console.log(`   CIF: ${data.CIF || data.cif || 'N/A'}`);
          console.log(`   Razón: ${data.D_RAZON_SOCIAL || data.razon_social || 'N/A'}`);
          console.log('');
        } else {
          console.log(`❌ ${exp} - NO encontrado`);
        }
      }

      // 4. Mostrar primeros 10 expedientes en la BD
      console.log('\n📝 Primeros 10 expedientes en la BD:');
      const first10 = await sql`
        SELECT form_identifier, data->>'CIF' as cif
        FROM reference_data
        WHERE is_active = TRUE
        ORDER BY uploaded_at DESC
        LIMIT 10
      `;
      first10.rows.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.form_identifier} (CIF: ${row.cif})`);
      });

    } else {
      console.log('❌ Excel NO se guardó en la BD (0 registros)');
      console.log('   Necesitas cargar el Excel de validación en la aplicación');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkDB();
