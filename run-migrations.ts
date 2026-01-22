/**
 * Script temporal para ejecutar todas las migraciones
 */

import { migrateReferenceData } from './scripts/migrate-reference-data.js';
import { migratePDFStorage } from './scripts/migrate-pdf-storage.js';
import { migrateBatchProcessing } from './scripts/migrate-batch-processing.js';

async function runAllMigrations() {
  console.log('\n🚀 Ejecutando todas las migraciones...\n');

  try {
    console.log('1️⃣ Migración: Reference Data');
    console.log('='.repeat(60));
    await migrateReferenceData();

    console.log('\n2️⃣ Migración: PDF Storage');
    console.log('='.repeat(60));
    await migratePDFStorage();

    console.log('\n3️⃣ Migración: Batch Processing');
    console.log('='.repeat(60));
    await migrateBatchProcessing();

    console.log('\n✅ Todas las migraciones completadas exitosamente!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error ejecutando migraciones:', error);
    process.exit(1);
  }
}

runAllMigrations();
