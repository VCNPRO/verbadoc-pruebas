/**
 * Ejecutar migración 008: Excel Master
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.production', override: true });

async function runMigration() {
  console.log('🚀 EJECUTANDO MIGRACIÓN 008: Excel Master\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Leer archivo SQL
    const sqlFile = path.join(process.cwd(), 'database', 'migrations', '008_create_master_excel_output.sql');
    const migrationSQL = fs.readFileSync(sqlFile, 'utf-8');

    console.log('📄 Archivo de migración cargado');
    console.log(`   Tamaño: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);

    // Ejecutar migración
    console.log('⏳ Ejecutando migración...\n');

    await sql.query(migrationSQL);

    console.log('═══════════════════════════════════════════════');
    console.log('✅ MIGRACIÓN 008 COMPLETADA');
    console.log('═══════════════════════════════════════════════\n');

    // Verificar que se creó la tabla
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'master_excel_output'
    `;

    if (tableCheck.rows.length > 0) {
      console.log('✅ Tabla master_excel_output creada exitosamente');
    } else {
      console.log('❌ Error: Tabla no encontrada');
    }

    // Verificar columnas
    const columnsCheck = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'master_excel_output'
      ORDER BY ordinal_position
      LIMIT 10
    `;

    console.log(`\n📊 Columnas creadas (${columnsCheck.rows.length} total):`);
    columnsCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✅ Sistema listo para almacenar Excel master en BD');
    console.log();

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error('\n   Stack:', error.stack);
  }
}

runMigration();
