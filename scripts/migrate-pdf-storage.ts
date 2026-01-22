/**
 * Script para aplicar migración de PDF Storage
 *
 * Uso:
 *   npm run migrate:pdf-storage
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migratePDFStorage() {
  console.log('🚀 Aplicando migración: Almacenamiento de PDFs en Vercel Blob...\n');

  try {
    // Leer el archivo SQL
    const migrationPath = path.join(process.cwd(), 'database', '004_add_pdf_storage.sql');

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
        const finalStatement = statement.endsWith(';') ? statement : statement + ';';
        await sql.query(finalStatement);

        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`✅ ${i + 1}/${statements.length}: ${preview}...`);
        successCount++;

      } catch (error: any) {
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
    console.log('✅ Migración de PDF Storage completada');
    console.log(`   Ejecutados: ${successCount}, Saltados: ${skipCount}`);
    console.log('='.repeat(60));

    // Verificación
    console.log('\n📊 Verificando instalación...\n');

    // 1. Verificar columnas añadidas
    const columnsCheck = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'extraction_results'
      AND column_name LIKE 'pdf_%'
    `;

    console.log(`✅ ${columnsCheck.rows.length} columnas de PDF añadidas:`);
    columnsCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // 2. Verificar índices
    const indexCheck = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'extraction_results'
      AND indexname LIKE '%pdf%'
    `;

    console.log(`✅ ${indexCheck.rows.length} índices de PDF creados`);

    // 3. Verificar funciones
    const functionCheck = await sql`
      SELECT proname
      FROM pg_proc
      WHERE proname IN ('find_orphan_blobs', 'get_storage_stats')
    `;

    console.log(`✅ ${functionCheck.rows.length} funciones helper creadas`);

    // 4. Verificar vista
    const viewCheck = await sql`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'extractions_with_storage'
    `;

    if (viewCheck.rows[0].count > 0) {
      console.log('✅ Vista extractions_with_storage creada');
    }

    // 5. Probar función de estadísticas
    const stats = await sql`SELECT * FROM get_storage_stats()`;
    console.log('\n📊 Estadísticas de almacenamiento:');
    console.log(`   - PDFs almacenados: ${stats.rows[0].total_pdfs_stored || 0}`);
    console.log(`   - Tamaño total: ${stats.rows[0].total_size_mb || 0} MB`);

    console.log('\n🎉 ¡Sistema de PDF Storage listo para usar!');
    console.log('\nPróximos pasos:');
    console.log('1. Configurar BLOB_READ_WRITE_TOKEN en variables de entorno');
    console.log('2. Subir PDF: POST /api/extractions/:id/upload-pdf');
    console.log('3. Ver estadísticas con get_storage_stats()\n');

  } catch (error: any) {
    console.error('\n❌ Error en migración:', error.message);
    console.error('\nPosibles causas:');
    console.error('1. POSTGRES_URL no configurado correctamente');
    console.error('2. Tabla extraction_results no existe');
    console.error('3. Usuario de BD no tiene permisos para ALTER TABLE\n');
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`){
  migratePDFStorage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { migratePDFStorage };
