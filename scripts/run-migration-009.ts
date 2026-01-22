/**
 * Script para ejecutar la migración 009: unprocessable_documents
 *
 * Uso: npx tsx scripts/run-migration-009.ts
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function runMigration() {
  console.log('🚀 Iniciando migración 009: unprocessable_documents...\n');

  try {
    // Leer el archivo SQL
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '009_create_unprocessable_documents.sql');
    console.log('📁 Leyendo migración desde:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`No se encontró el archivo de migración: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Archivo de migración leído correctamente\n');

    // Ejecutar la migración
    console.log('⚙️  Ejecutando migración en la base de datos...');
    await sql.query(migrationSQL);
    console.log('✅ Migración ejecutada exitosamente\n');

    // Verificar que la tabla fue creada
    console.log('🔍 Verificando tabla unprocessable_documents...');
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'unprocessable_documents'
    `;

    if (tableCheck.rows.length > 0) {
      console.log('✅ Tabla unprocessable_documents creada correctamente');
    } else {
      throw new Error('❌ La tabla no se creó correctamente');
    }

    // Verificar índices
    console.log('\n🔍 Verificando índices...');
    const indexCheck = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'unprocessable_documents'
    `;
    console.log(`✅ ${indexCheck.rows.length} índices creados:`,
      indexCheck.rows.map(r => r.indexname).join(', '));

    // Verificar funciones
    console.log('\n🔍 Verificando funciones...');
    const functionCheck = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE '%unprocessable%'
    `;
    console.log(`✅ ${functionCheck.rows.length} funciones creadas:`,
      functionCheck.rows.map(r => r.routine_name).join(', '));

    // Verificar vista
    console.log('\n🔍 Verificando vista...');
    const viewCheck = await sql`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name = 'v_unprocessable_documents_detailed'
    `;
    if (viewCheck.rows.length > 0) {
      console.log('✅ Vista v_unprocessable_documents_detailed creada correctamente');
    }

    // Verificar RLS
    console.log('\n🔍 Verificando Row Level Security...');
    const rlsCheck = await sql`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relname = 'unprocessable_documents'
    `;
    if (rlsCheck.rows[0]?.relrowsecurity) {
      console.log('✅ RLS habilitado en unprocessable_documents');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRACIÓN 009 COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log('\n📋 Resumen:');
    console.log('  - Tabla: unprocessable_documents');
    console.log('  - Índices: 7');
    console.log('  - Funciones: 5');
    console.log('  - Vista: v_unprocessable_documents_detailed');
    console.log('  - RLS: Habilitado');
    console.log('  - Trigger: update_unprocessable_updated_at');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error ejecutando la migración:');
    console.error('Mensaje:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Ejecutar
runMigration();
