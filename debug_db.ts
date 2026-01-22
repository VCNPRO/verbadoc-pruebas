
import { sql } from '@vercel/postgres';
import 'dotenv/config';

async function main() {
  try {
    const total = await sql`SELECT count(*) FROM master_excel_output`;
    const active = await sql`SELECT count(*) FROM master_excel_output WHERE is_latest = true`;
    const extractions = await sql`SELECT id, status, validation_status FROM extraction_results ORDER BY created_at DESC LIMIT 5`;
    
    console.log('--- REPORTE DB ---');
    console.log('Total en master_excel_output:', total.rows[0].count);
    console.log('Activos en master_excel_output:', active.rows[0].count);
    console.log('\nÚltimas extracciones en extraction_results:');
    extractions.rows.forEach(ex => {
      console.log(`ID: ${ex.id} | Status: ${ex.status} | Validation: ${ex.validation_status}`);
    });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}
main();
