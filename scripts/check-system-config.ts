import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function checkSystemConfig() {
  console.log('🔍 Auditoría de tablas de configuración...');
  
  try {
    const tables = ['reference_data', 'column_mappings', 'master_excel_output'];
    
    for (const table of tables) {
      console.log(`
--- Estructura de: ${table} ---`);
      const result = await sql.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}';
      `);
      result.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
      
      const count = await sql.query(`SELECT count(*) as total FROM ${table}`);
      console.log(`Total registros: ${count.rows[0].total}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSystemConfig();
