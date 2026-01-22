/**
 * Script para encontrar la columna correcta de "acción"
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function findAccionColumn() {
  try {
    // Ver todas las columnas que contienen "accion" o "cod"
    const result = await sql`
      SELECT DISTINCT jsonb_object_keys(data) as columna
      FROM reference_data
      WHERE is_active = true
        AND (
          jsonb_object_keys(data) ILIKE '%accion%'
          OR jsonb_object_keys(data) ILIKE '%cod%'
        )
    `;

    console.log('Columnas relacionadas con "accion" o "cod":');
    result.rows.forEach(row => {
      console.log(`  - ${row.columna}`);
    });

    // Ver un registro completo
    console.log('\n📄 Registro completo de ejemplo:\n');
    const example = await sql`
      SELECT data
      FROM reference_data
      WHERE is_active = true
      LIMIT 1
    `;

    const data = example.rows[0].data;
    console.log('Todas las claves del JSONB:');
    Object.keys(data).sort().forEach(key => {
      console.log(`  ${key}: ${data[key]}`);
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

findAccionColumn();
