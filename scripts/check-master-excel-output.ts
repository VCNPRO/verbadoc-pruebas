import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function checkMasterExcelOutput() {
  console.log('🔍 Consultando master_excel_output...');
  try {
    const result = await sql`
      SELECT id, filename, validation_status, created_at 
      FROM master_excel_output 
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    
    console.log('Resultados (10 últimos):');
    if (result.rows.length === 0) {
        console.log('⚠️ No hay registros en master_excel_output.');
    }
    result.rows.forEach(row => {
      console.log(`- [${row.created_at}] ${row.filename}: ${row.validation_status}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkMasterExcelOutput();
