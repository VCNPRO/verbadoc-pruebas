/**
 * Script simple para aplicar migraciones SQL completas sin dividir
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Try production env first, fallback to .env.local
if (fs.existsSync('.env.production')) {
  console.log('📦 Usando variables de producción (.env.production)');
  dotenv.config({ path: '.env.production' });
} else {
  console.log('📦 Usando variables locales (.env.local)');
  dotenv.config({ path: '.env.local' });
}

async function applyMigration(filePath: string, name: string) {
  console.log(`\n📋 Aplicando: ${name}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
    return;
  }

  const migrationSQL = fs.readFileSync(filePath, 'utf-8');

  try {
    await sql.query(migrationSQL);
    console.log(`✅ ${name} completada`);
  } catch (error: any) {
    // Si es un error de "ya existe", está bien
    if (error.message.includes('already exists') || error.message.includes('does not exist')) {
      console.log(`⚠️  ${name} - Ya existe o no necesario, continuando...`);
    } else {
      console.error(`❌ Error en ${name}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log('\n🚀 Aplicando Migraciones a Base de Datos de Producción\n');

  const migrations = [
    { file: 'database/003_create_reference_data.sql', name: 'Reference Data' },
    { file: 'database/004_add_pdf_storage.sql', name: 'PDF Storage' },
    { file: 'database/005_create_batch_processing.sql', name: 'Batch Processing' },
    { file: 'database/006_add_pdf_type_detection.sql', name: 'PDF Type Detection' },
    { file: 'database/007_create_column_mappings.sql', name: 'Column Mappings' }
  ];

  for (const migration of migrations) {
    const fullPath = path.join(process.cwd(), migration.file);
    await applyMigration(fullPath, migration.name);
  }

  console.log('\n✅ Todas las migraciones completadas!\n');
  process.exit(0);
}

main().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});
