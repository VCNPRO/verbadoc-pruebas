/**
 * Mostrar registro completo para ver todas las columnas
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function showFullRecord() {
  try {
    // Ver 3 registros completos
    const result = await sql`
      SELECT
        form_identifier,
        data
      FROM reference_data
      WHERE is_active = true
      LIMIT 3
    `;

    result.rows.forEach((row, i) => {
      console.log(`\n========== REGISTRO ${i + 1} ==========`);
      console.log(`Form Identifier: ${row.form_identifier}\n`);

      const data = row.data;
      const keys = Object.keys(data).sort();

      console.log('Todas las columnas:');
      keys.forEach(key => {
        const value = data[key];
        if (value !== null && value !== '') {
          console.log(`  ${key}: ${value}`);
        }
      });
    });

    // Buscar columnas que contengan expediente o accion
    console.log('\n\n========== COLUMNAS CLAVE ==========\n');
    const example = result.rows[0].data;
    const keys = Object.keys(example).sort();

    console.log('Columnas con "expediente":');
    keys.filter(k => k.toLowerCase().includes('expediente')).forEach(k => {
      console.log(`  - ${k}: ${example[k]}`);
    });

    console.log('\nColumnas con "accion":');
    keys.filter(k => k.toLowerCase().includes('accion')).forEach(k => {
      console.log(`  - ${k}: ${example[k]}`);
    });

    console.log('\nColumnas con "grupo":');
    keys.filter(k => k.toLowerCase().includes('grupo')).forEach(k => {
      console.log(`  - ${k}: ${example[k]}`);
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

showFullRecord();
