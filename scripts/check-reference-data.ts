import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function checkReferenceData() {
  console.log('🔍 Muestreando reference_data...');
  try {
    const result = await sql`
      SELECT data 
      FROM reference_data 
      WHERE is_active = true 
      LIMIT 5;
    `;
    
    console.log('Registros de referencia encontrados:');
    result.rows.forEach((row, i) => {
      console.log(`
Registro ${i+1}:`);
      console.log(JSON.stringify(row.data, null, 2));
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkReferenceData();
