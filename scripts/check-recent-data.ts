import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function checkLastExtractions() {
  console.log('🔍 Consultando últimas extracciones...');
  try {
    const result = await sql`
      SELECT id, filename, validation_status, created_at 
      FROM extraction_results 
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    
    console.log('Resultados (10 últimos):');
    if (result.rows.length === 0) {
        console.log('⚠️ No hay extracciones en la tabla.');
    }
    result.rows.forEach(row => {
      console.log(`- [${row.created_at}] ${row.filename}: ${row.validation_status} (ID: ${row.id})`);
    });

    const unproc = await sql`
      SELECT id, filename, rejection_category, created_at 
      FROM unprocessable_documents 
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    console.log('\n🔍 Consultando últimos no procesables...');
    unproc.rows.forEach(row => {
      console.log(`- [${row.created_at}] ${row.filename}: ${row.rejection_category} (ID: ${row.id})`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkLastExtractions();
