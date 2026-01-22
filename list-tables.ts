import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

if (fs.existsSync('.env.production')) {
  console.log('Using production env');
  dotenv.config({ path: '.env.production' });
}

async function listTables() {
  try {
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('Tables in database:');
    result.rows.forEach(row => console.log('  -', row.table_name));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

listTables();
