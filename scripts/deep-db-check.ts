import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function deepCheck() {
  console.log('🕵️ Iniciando inspección profunda de la base de datos...');
  
  try {
    // 1. ¿Hay algo en la tabla de extracciones hoy?
    const today = new Date().toISOString().split('T')[0];
    const exToday = await sql`
      SELECT count(*) as total FROM extraction_results 
      WHERE created_at >= ${today};
    `;
    console.log(`Total extracciones hoy (${today}):`, exToday.rows[0].total);

    // 2. ¿Hay algo en no procesables hoy?
    const unToday = await sql`
      SELECT count(*) as total FROM unprocessable_documents 
      WHERE created_at >= ${today};
    `;
    console.log(`Total no procesables hoy (${today}):`, unToday.rows[0].total);

    // 3. Ver los últimos 3 registros de cada tabla con TODO el detalle
    console.log('\n--- ÚLTIMAS 3 EXTRACCIONES ---');
    const lastEx = await sql`SELECT * FROM extraction_results ORDER BY created_at DESC LIMIT 3`;
    lastEx.rows.forEach(r => console.log(`- ${r.filename} | Status: ${r.validation_status} | User: ${r.user_id}`));

    console.log('\n--- ÚLTIMOS 3 NO PROCESABLES ---');
    const lastUn = await sql`SELECT * FROM unprocessable_documents ORDER BY created_at DESC LIMIT 3`;
    lastUn.rows.forEach(r => console.log(`- ${r.filename} | Category: ${r.rejection_category} | Reason: ${r.rejection_reason}`));

    console.log('\n--- ÚLTIMOS 3 EXCEL MASTER ---');
    const lastMaster = await sql`SELECT * FROM master_excel_output ORDER BY created_at DESC LIMIT 3`;
    lastMaster.rows.forEach(r => console.log(`- ${r.filename} | ID: ${r.id}`));

  } catch (err) {
    console.error('❌ Error en inspección:', err);
  }
}

deepCheck();
