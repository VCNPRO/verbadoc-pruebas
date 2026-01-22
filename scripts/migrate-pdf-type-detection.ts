/**
 * Script de Migración: Detección de Tipo de PDF
 *
 * Aplica la migración 006 que añade campos para
 * almacenar información sobre el tipo de PDF
 */

import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

async function applyMigration() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 APLICANDO MIGRACIÓN 006: DETECCIÓN DE TIPO DE PDF');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Verificar conexión
    console.log('🔌 Conectando a PostgreSQL...');
    const connectionTest = await sql`SELECT NOW() as current_time`;
    console.log('✅ Conexión establecida:', connectionTest.rows[0].current_time);

    // Leer archivo de migración
    const migrationPath = path.join(__dirname, '..', 'database', '006_add_pdf_type_detection.sql');
    console.log(`\n📄 Leyendo migración: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Archivo de migración no encontrado: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Migración cargada (${migrationSQL.length} caracteres)`);

    // Ejecutar migración completa
    console.log('\n⚙️  Aplicando migración...');
    await sql.query(migrationSQL);

    console.log('\n✅ Migración aplicada exitosamente');

    // Verificar que las columnas se crearon
    console.log('\n🔍 Verificando columnas creadas...');

    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'extraction_results'
      AND column_name LIKE 'pdf_%'
      ORDER BY column_name
    `;

    console.log(`\n📊 Columnas de PDF en extraction_results: ${columns.rows.length}`);
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // Verificar índices
    console.log('\n🔍 Verificando índices creados...');

    const indices = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'extraction_results'
      AND indexname LIKE '%pdf%'
      ORDER BY indexname
    `;

    console.log(`\n📊 Índices relacionados con PDF: ${indices.rows.length}`);
    indices.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // Verificar funciones
    console.log('\n🔍 Verificando funciones creadas...');

    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('get_pdf_type_statistics', 'get_pdfs_requiring_ocr')
      ORDER BY routine_name
    `;

    console.log(`\n📊 Funciones relacionadas con PDF: ${functions.rows.length}`);
    functions.rows.forEach(func => {
      console.log(`   - ${func.routine_name}()`);
    });

    // Verificar vista
    console.log('\n🔍 Verificando vista creada...');

    const views = await sql`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name = 'v_pdfs_analyzed'
    `;

    if (views.rows.length > 0) {
      console.log('   ✅ Vista v_pdfs_analyzed creada');
    } else {
      console.log('   ⚠️  Vista v_pdfs_analyzed no encontrada');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎉 MIGRACIÓN 006 COMPLETADA EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📋 Resumen:');
    console.log(`   - Columnas añadidas: ${columns.rows.length}`);
    console.log(`   - Índices creados: ${indices.rows.length}`);
    console.log(`   - Funciones creadas: ${functions.rows.length}`);
    console.log(`   - Vistas creadas: ${views.rows.length}`);

    console.log('\n✅ El sistema ahora puede detectar automáticamente');
    console.log('   si un PDF contiene texto (OCR) o solo imágenes.\n');

  } catch (error: any) {
    console.error('\n❌ ERROR AL APLICAR MIGRACIÓN:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  }
}

// Ejecutar si es el módulo principal
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  applyMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error fatal:', error);
      process.exit(1);
    });
}

export { applyMigration };
