
import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkReference() {
  try {
    const expediente = 'B241889AC';
    console.log(`Buscando datos de referencia para expediente: ${expediente}...`);
    
    const result = await sql`
      SELECT * FROM reference_data 
      WHERE UPPER(data->>'numero_expediente') = UPPER(${expediente})
    `;
    
    console.log(`Encontrados: ${result.rows.length} registros.`);
    result.rows.forEach((row, i) => {
      console.log(`\n[${i+1}] Datos:`, JSON.stringify(row.data, null, 2));
    });
  } catch (error) {
    console.error(error);
  }
}
checkReference();
