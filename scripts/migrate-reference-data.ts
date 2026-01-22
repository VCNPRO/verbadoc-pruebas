/**
 * Script para aplicar migración de Reference Data y Cross Validation
 *
 * Uso:
 *   npm run migrate:reference-data
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateReferenceData() {
  console.log('🚀 Aplicando migración: Sistema de Validación Cruzada con Excel...\n');

  try {
    // Leer el archivo SQL
    const migrationPath = path.join(process.cwd(), 'database', '003_create_reference_data.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Archivo de migración no encontrado: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Leyendo migración desde:', migrationPath);

    // Dividir en statements individuales
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Ejecutando ${statements.length} statements SQL...\n`);

    let successCount = 0;
    let skipCount = 0;

    // Ejecutar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip si es solo comentarios
      if (statement.replace(/\-\-.*/g, '').trim().length === 0) {
        continue;
      }

      try {
        // Añadir ; al final si no lo tiene
        const finalStatement = statement.endsWith(';') ? statement : statement + ';';
        await sql.query(finalStatement);

        // Mostrar preview del statement
        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`✅ ${i + 1}/${statements.length}: ${preview}...`);
        successCount++;

      } catch (error: any) {
        // Algunos errores son esperables (ya existe, etc.)
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          const preview = statement.substring(0, 60).replace(/\n/g, ' ');
          console.log(`⚠️  ${i + 1}/${statements.length}: Ya existe, continuando... (${preview})`);
          skipCount++;
        } else {
          console.error(`❌ Error en statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migración de Validación Cruzada completada');
    console.log(`   Ejecutados: ${successCount}, Saltados: ${skipCount}`);
    console.log('='.repeat(60));

    // Verificación
    console.log('\n📊 Verificando instalación...\n');

    // 1. Verificar tabla reference_data
    const tableCheck1 = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'reference_data'
      ) as exists
    `;

    if (tableCheck1.rows[0].exists) {
      console.log('✅ Tabla reference_data creada');
    } else {
      throw new Error('❌ Tabla reference_data NO fue creada');
    }

    // 2. Verificar tabla cross_validation_results
    const tableCheck2 = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'cross_validation_results'
      ) as exists
    `;

    if (tableCheck2.rows[0].exists) {
      console.log('✅ Tabla cross_validation_results creada');
    } else {
      throw new Error('❌ Tabla cross_validation_results NO fue creada');
    }

    // 3. Verificar índices
    const indexCheck = await sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename IN ('reference_data', 'cross_validation_results')
    `;

    console.log(`✅ ${indexCheck.rows[0].count} índices creados`);

    // 4. Verificar funciones
    const functionCheck = await sql`
      SELECT COUNT(*) as count
      FROM pg_proc
      WHERE proname IN (
        'get_reference_data_by_form_id',
        'get_cross_validation_stats',
        'deactivate_old_reference_data',
        'update_reference_data_timestamp'
      )
    `;

    console.log(`✅ ${functionCheck.rows[0].count} funciones creadas`);

    // 5. Verificar triggers
    const triggerCheck = await sql`
      SELECT COUNT(*) as count
      FROM pg_trigger
      WHERE tgname IN (
        'trigger_deactivate_old_reference_data',
        'trigger_update_reference_data_timestamp'
      )
    `;

    console.log(`✅ ${triggerCheck.rows[0].count} triggers creados`);

    // 6. Verificar vistas
    const viewCheck = await sql`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name IN (
        'extractions_with_cross_validation',
        'user_cross_validation_summary'
      )
    `;

    console.log(`✅ ${viewCheck.rows[0].count} vistas creadas`);

    console.log('\n🎉 ¡Sistema de Validación Cruzada listo para usar!');
    console.log('\nPróximos pasos:');
    console.log('1. Subir Excel de referencia: POST /api/reference-data/upload');
    console.log('2. Ejecutar validación: POST /api/extractions/:id/cross-validate');
    console.log('3. Ver resultados en dashboard\n');

  } catch (error: any) {
    console.error('\n❌ Error en migración:', error.message);
    console.error('\nPosibles causas:');
    console.error('1. POSTGRES_URL no configurado correctamente');
    console.error('2. Usuario de BD no tiene permisos suficientes');
    console.error('3. Sintaxis SQL incorrecta en migración');
    console.error('4. Tabla extraction_results no existe (ejecutar migraciones anteriores primero)\n');
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`){
  migrateReferenceData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { migrateReferenceData };
