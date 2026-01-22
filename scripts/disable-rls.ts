import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function fixRLS() {
  console.log('🔧 Deshabilitando RLS temporalmente en tablas críticas para asegurar visibilidad...');
  try {
    await sql`ALTER TABLE extraction_results DISABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE validation_errors DISABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE master_excel_output DISABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE unprocessable_documents DISABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE reference_data DISABLE ROW LEVEL SECURITY;`;
    
    console.log('✅ RLS deshabilitado en 5 tablas.');

  } catch (error) {
    console.error('Error:', error);
  }
}

fixRLS();
