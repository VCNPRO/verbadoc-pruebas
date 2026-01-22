/**
 * SCRIPT PARA VERIFICAR LAS TABLAS CREADAS
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

import { sql } from '@vercel/postgres';

async function verify() {
  console.log('🔍 VERIFICANDO ESTRUCTURA DE BASE DE DATOS\n');

  // 1. Ver columnas de extraction_results
  console.log('📋 Tabla: extraction_results');
  const extractionColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    ORDER BY ordinal_position
  `;
  console.log(`   Columnas: ${extractionColumns.rows.length}`);
  extractionColumns.rows.forEach(col => {
    console.log(`   - ${col.column_name} (${col.data_type})`);
  });

  // 2. Ver columnas de validation_errors
  console.log('\n📋 Tabla: validation_errors');
  const errorColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'validation_errors'
    ORDER BY ordinal_position
  `;
  console.log(`   Columnas: ${errorColumns.rows.length}`);
  errorColumns.rows.forEach(col => {
    console.log(`   - ${col.column_name} (${col.data_type})`);
  });

  // 3. Ver columnas de email_notifications
  console.log('\n📋 Tabla: email_notifications');
  const emailColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'email_notifications'
    ORDER BY ordinal_position
  `;
  console.log(`   Columnas: ${emailColumns.rows.length}`);
  emailColumns.rows.forEach(col => {
    console.log(`   - ${col.column_name} (${col.data_type})`);
  });

  // 4. Ver índices
  console.log('\n🔗 Índices creados:');
  const indexes = await sql`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('extraction_results', 'validation_errors', 'email_notifications')
    ORDER BY tablename, indexname
  `;
  console.log(`   Total: ${indexes.rows.length}`);
  indexes.rows.forEach(idx => {
    console.log(`   - ${idx.tablename}.${idx.indexname}`);
  });

  // 5. Ver triggers
  console.log('\n⚡ Triggers creados:');
  const triggers = await sql`
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE event_object_table IN ('extraction_results', 'validation_errors')
    ORDER BY event_object_table, trigger_name
  `;
  console.log(`   Total: ${triggers.rows.length}`);
  triggers.rows.forEach(trg => {
    console.log(`   - ${trg.event_object_table}.${trg.trigger_name}`);
  });

  console.log('\n✅ Verificación completada!\n');
}

verify()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
