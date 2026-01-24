// verbadoc-pruebas/scripts/apply-all-migrations.ts

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // Carga .env.local por si se ejecuta localmente

async function applyMigration(filePath: string, name: string) {
  console.log(`
📋 Aplicando: ${name}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}. Saltando.`);
    return;
  }

  const migrationSQL = fs.readFileSync(filePath, 'utf-8');

  try {
    await sql.query(migrationSQL);
    console.log(`✅ ${name} completada`);
  } catch (error: any) {
    // Si es un error de "ya existe", "duplicado" o "no existe" (para DROP IF EXISTS), generalmente está bien
    if (error.message.includes('already exists') || error.message.includes('duplicate') || error.message.includes('does not exist')) {
      console.log(`⚠️  ${name} - Elemento ya existe o no necesario, continuando...`);
    } else {
      console.error(`❌ Error fatal en ${name}:`, error.message);
      throw error; // Relanzar para detener el proceso si es un error real
    }
  }
}

async function main() {
  console.log(`
🚀 Aplicando TODAS las Migraciones a la Base de Datos de Prueba
`);

  const migrations = [
    { file: 'database/migrations/001_create_extraction_tables.sql', name: '001 - Extraction Tables' },
    { file: 'database/003_create_reference_data.sql', name: '003 - Reference Data' },
    { file: 'database/004_add_pdf_storage.sql', name: '004 - PDF Storage' },
    { file: 'database/005_create_batch_processing.sql', name: '005 - Batch Processing' },
    { file: 'database/006_add_pdf_type_detection.sql', name: '006 - PDF Type Detection' },
    { file: 'database/007_create_column_mappings.sql', name: '007 - Column Mappings' },
    { file: 'database/migrations/008_create_master_excel_output.sql', name: '008 - Master Excel Output' },
    { file: 'database/migrations/009_create_unprocessable_documents.sql', name: '009 - Unprocessable Documents' },
    { file: 'database/migrations/010_add_reviewer_role.sql', name: '010 - Add Reviewer Role' },
    { file: 'database/migrations/010_disable_rls_reference_data.sql', name: '010 - Disable RLS Reference Data' },
    { file: 'database/migrations/011_create_access_logs.sql', name: '011 - Create Access Logs' },
    { file: 'database/migrations/011_disable_rls_extraction_results.sql', name: '011 - Disable RLS Extraction Results' },
    { file: 'database/migrations/012_add_pdf_url_to_unprocessable.sql', name: '012 - Add PDF URL to Unprocessable' },
    { file: 'database/migrations/013_add_client_id_to_users.sql', name: '013 - Add Client ID to Users' },
  ];

  for (const migration of migrations) {
    const fullPath = path.join(process.cwd(), migration.file);
    await applyMigration(fullPath, migration.name);
  }

  console.log(`
✅ Todas las migraciones completadas!
`);
  process.exit(0);
}

main().catch(error => {
  console.error(`
❌ Error fatal al aplicar migraciones:`, error);
  process.exit(1);
});
