
import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkMasterRows() {
  try {
    const result = await sql`SELECT count(*) as total, count(*) FILTER (WHERE is_latest = true) as latest FROM master_excel_output`;
    console.log('Filas en Master Excel:', result.rows[0]);
    
    const samples = await sql`SELECT id, filename, is_latest, validation_status FROM master_excel_output LIMIT 5`;
    console.log('Muestras:', samples.rows);
  } catch (error) {
    console.error(error);
  }
}
checkMasterRows();
