/**
 * SCRIPT PARA EJECUTAR MIGRACIONES EN VERCEL POSTGRES
 * database/runMigration.ts
 *
 * Uso desde terminal:
 * npx tsx database/runMigration.ts
 */

// Cargar variables de entorno desde .env.local
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

import { sql } from '@vercel/postgres';
import fs from 'fs';

async function runMigration(migrationFile: string) {
  console.log(`\n🚀 Ejecutando migración: ${migrationFile}`);

  try {
    // Leer el archivo SQL
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log(`📝 Ejecutando migración completa...`);

    // Ejecutar todo el SQL de una vez
    try {
      await sql.query(migrationSQL);
      console.log(`✅ Migración ejecutada exitosamente`);
    } catch (error: any) {
      // Ignorar errores de "ya existe" (para re-ejecutar migraciones)
      if (error.message.includes('already exists') || error.code === '42P07') {
        console.log(`⚠️  Algunas tablas ya existen, saltando...`);
      } else {
        throw error;
      }
    }

    console.log(`✅ Migración ${migrationFile} completada\n`);
  } catch (error) {
    console.error(`❌ Error en migración ${migrationFile}:`, error);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  VERBADOCPRO - Sistema de Migraciones de Base de Datos    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Test de conexión
    console.log('\n🔌 Probando conexión a Vercel Postgres...');
    const result = await sql`SELECT NOW() as current_time`;
    console.log(`✅ Conexión exitosa! Hora del servidor: ${result.rows[0].current_time}`);

    // Ejecutar migración 001
    await runMigration('001_create_extraction_tables.sql');

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ TODAS LAS MIGRACIONES COMPLETADAS                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Verificar que las tablas se crearon
    console.log('\n🔍 Verificando tablas creadas...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('extraction_results', 'validation_errors', 'email_notifications')
      ORDER BY table_name
    `;

    console.log('\n📊 Tablas encontradas:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    console.log('\n✅ Base de datos lista para usar!\n');

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  }
}

// Ejecutar migración
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
