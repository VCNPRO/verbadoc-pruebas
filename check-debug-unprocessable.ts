
import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkUnprocessable() {
  try {
    const result = await sql`
      SELECT category, reason, extracted_data, created_at 
      FROM unprocessable_documents 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    console.log('--- ÚLTIMOS DOCUMENTOS NO PROCESABLES ---');
    result.rows.forEach((row, i) => {
      console.log(`
[${i+1}] Categoría: ${row.category}`);
      console.log(`Motivo: ${row.reason}`);
      console.log(`Datos IA:`, JSON.stringify(row.extracted_data, null, 2));
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUnprocessable();

