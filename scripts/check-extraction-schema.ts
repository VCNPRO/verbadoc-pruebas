import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function checkSchema() {
  console.log('🔍 Verificando esquema de extraction_results...');
  try {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'extraction_results';
    `;
    
    console.log('Columnas encontradas:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });

    const hasReason = result.rows.some(r => r.column_name === 'rejection_reason');
    if (!hasReason) {
        console.error('❌ Falta columna rejection_reason!');
    } else {
        console.log('✅ Columna rejection_reason existe.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
