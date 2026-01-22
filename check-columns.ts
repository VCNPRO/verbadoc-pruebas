
import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkColumns() {
  try {
    const result = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'unprocessable_documents'
    `;
    console.log('Columnas:', result.rows.map(r => r.column_name));

    const samples = await sql`SELECT * FROM unprocessable_documents LIMIT 1`;
    console.log('Muestra:', JSON.stringify(samples.rows[0], null, 2));
  } catch (error) {
    console.error(error);
  }
}
checkColumns();
