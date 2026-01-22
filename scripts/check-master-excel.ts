import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function checkMasterExcel() {
  console.log('🔍 Verificando tabla master_excel_rows...');
  try {
    const tableCheck = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'master_excel_rows';
    `;
    console.log('Tabla existe:', tableCheck.rows.length > 0);

    if (tableCheck.rows.length > 0) {
        const rows = await sql`SELECT count(*) as total FROM master_excel_rows;`;
        console.log('Total filas en master_excel_rows:', rows.rows[0].total);
        
        const lastRows = await sql`SELECT id, filename, created_at FROM master_excel_rows ORDER BY created_at DESC LIMIT 5;`;
        console.log('Últimas filas:');
        lastRows.rows.forEach(r => console.log(`- ${r.filename} (${r.created_at})`));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkMasterExcel();
