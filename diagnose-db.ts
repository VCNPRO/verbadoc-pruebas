
import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function diagnose() {
  try {
    console.log('--- ÚLTIMAS 5 EXTRACCIONES EN BD ---');
    const result = await sql`
      SELECT id, filename, validation_status, created_at, pdf_blob_url
      FROM extraction_results 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    result.rows.forEach((row, i) => {
      console.log(`\n[${i+1}] ID: ${row.id}`);
      console.log(`Archivo: ${row.filename}`);
      console.log(`Estado: ${row.validation_status}`);
      console.log(`PDF URL: ${row.pdf_blob_url ? 'SÍ' : 'NO'}`);
      console.log(`Fecha: ${row.created_at}`);
    });

    console.log('\n--- ÚLTIMAS 5 FILAS EN EXCEL MASTER ---');
    const master = await sql`
      SELECT id, filename, validation_status, created_at
      FROM master_excel_data
      ORDER BY created_at DESC
      LIMIT 5
    `;
    master.rows.forEach((row, i) => {
      console.log(`[${i+1}] Archivo: ${row.filename} | Estado: ${row.validation_status}`);
    });

  } catch (error) {
    console.error('Error en diagnóstico:', error);
  }
}
diagnose();
