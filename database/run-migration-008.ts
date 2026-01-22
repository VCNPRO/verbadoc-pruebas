import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function runMigration008() {
  const migrationFile = '008_create_master_excel_output.sql';
  console.log(`
🚀 Ejecutando migración: ${migrationFile}`);

  try {
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log(`⏳ Ejecutando SQL...`);
    await sql.query(migrationSQL);
    console.log(`✅ Migración 008 ejecutada exitosamente`);

  } catch (error: any) {
    console.error(`❌ Error en migración 008:`, error.message);
    process.exit(1);
  }
}

runMigration008();
