/**
 * Script para aplicar migración de Batch Processing
 *
 * Uso:
 *   npm run migrate:batch-processing
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateBatchProcessing() {
  console.log('🚀 Aplicando migración: Sistema de Procesamiento Batch...\n');

  try {
    const migrationPath = path.join(process.cwd(), 'database', '005_create_batch_processing.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Archivo de migración no encontrado: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('📄 Leyendo migración desde:', migrationPath);

    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Ejecutando ${statements.length} statements SQL...\n`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.replace(/\-\-.*/g, '').trim().length === 0) {
        continue;
      }

      try {
        const finalStatement = statement.endsWith(';') ? statement : statement + ';';
        await sql.query(finalStatement);

        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`✅ ${i + 1}/${statements.length}: ${preview}...`);
        successCount++;

      } catch (error: any) {
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          const preview = statement.substring(0, 60).replace(/\n/g, ' ');
          console.log(`⚠️  ${i + 1}/${statements.length}: Ya existe, continuando...`);
          skipCount++;
        } else {
          console.error(`❌ Error en statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migración de Batch Processing completada');
    console.log(`   Ejecutados: ${successCount}, Saltados: ${skipCount}`);
    console.log('='.repeat(60));

    // Verificación
    console.log('\n📊 Verificando instalación...\n');

    // 1. Verificar tablas
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('batch_jobs', 'batch_items')
    `;

    console.log(`✅ ${tableCheck.rows.length} tablas creadas (batch_jobs, batch_items)`);

    // 2. Verificar índices
    const indexCheck = await sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename IN ('batch_jobs', 'batch_items')
    `;

    console.log(`✅ ${indexCheck.rows[0].count} índices creados`);

    // 3. Verificar funciones
    const functionCheck = await sql`
      SELECT COUNT(*) as count
      FROM pg_proc
      WHERE proname IN ('get_batch_stats', 'get_next_batch_item', 'update_batch_progress')
    `;

    console.log(`✅ ${functionCheck.rows[0].count} funciones creadas`);

    // 4. Verificar trigger
    const triggerCheck = await sql`
      SELECT COUNT(*) as count
      FROM pg_trigger
      WHERE tgname = 'trigger_update_batch_progress'
    `;

    console.log(`✅ ${triggerCheck.rows[0].count} trigger creado`);

    // 5. Verificar vista
    const viewCheck = await sql`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'batch_jobs_summary'
    `;

    console.log(`✅ ${viewCheck.rows[0].count} vista creada`);

    console.log('\n🎉 ¡Sistema de Batch Processing listo para usar!');
    console.log('\nPróximos pasos:');
    console.log('1. Crear batch: POST /api/batch/create');
    console.log('2. Consultar estado: GET /api/batch/:id/status');
    console.log('3. Implementar worker de procesamiento\n');

  } catch (error: any) {
    console.error('\n❌ Error en migración:', error.message);
    console.error('\nPosibles causas:');
    console.error('1. POSTGRES_URL no configurado');
    console.error('2. Tabla users no existe\n');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`){
  migrateBatchProcessing()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { migrateBatchProcessing };
