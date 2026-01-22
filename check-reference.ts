import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

if (fs.existsSync('.env.production')) {
  console.log('Using production env');
  dotenv.config({ path: '.env.production' });
}

async function checkReference() {
  try {
    console.log('\n🔍 Buscando expediente B211801AA en reference_data...\n');

    const result = await sql`
      SELECT
        id,
        form_identifier,
        data,
        source_file,
        is_active,
        uploaded_at
      FROM reference_data
      WHERE form_identifier = 'B211801AA'
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      console.log('❌ Expediente B211801AA NO encontrado en reference_data\n');

      // Contar total de registros
      const count = await sql`SELECT COUNT(*) as total FROM reference_data WHERE is_active = TRUE`;
      console.log(`Total registros activos en reference_data: ${count.rows[0].total}`);

      // Mostrar algunos ejemplos
      const samples = await sql`SELECT form_identifier FROM reference_data WHERE is_active = TRUE LIMIT 10`;
      console.log('\nEjemplos de expedientes en la BD:');
      samples.rows.forEach(row => console.log('  -', row.form_identifier));

    } else {
      const ref = result.rows[0];
      console.log('✅ EXPEDIENTE ENCONTRADO\n');
      console.log('ID:', ref.id);
      console.log('Archivo Excel:', ref.source_file);
      console.log('Activo:', ref.is_active);
      console.log('Fecha carga:', new Date(ref.uploaded_at).toLocaleString('es-ES'));
      console.log('\nDatos de referencia:');
      console.log(JSON.stringify(ref.data, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkReference();
