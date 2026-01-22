/**
 * Script de Restauración de Backup
 * Template para restaurar datos desde un backup de base de datos
 *
 * IMPORTANTE: Este script debe ser personalizado según tus necesidades
 *
 * Uso:
 * 1. Descargar backup: gunzip backup_YYYY-MM-DD.json.gz
 * 2. Copiar este archivo a restore_backup.cjs
 * 3. Modificar según tabla a restaurar
 * 4. Ejecutar: node restore_backup.cjs
 */

require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');
const fs = require('fs');

// ============================================
// CONFIGURACIÓN
// ============================================

const BACKUP_FILE = 'backup.json'; // Cambiar por tu archivo
const DRY_RUN = true; // Cambiar a false para ejecutar realmente

// Qué tablas restaurar
const RESTORE_TABLES = {
  users: false,              // ⚠️ Cuidado: puede sobrescribir usuarios
  extraction_results: false,
  master_excel_output: false,
  validation_errors: false,
  unprocessable_documents: false,
  reference_data: false,
  column_mappings: false,
  role_permissions: true,    // Ejemplo: restaurar solo permisos
  access_logs: false,
};

// ============================================
// FUNCIONES DE RESTAURACIÓN
// ============================================

async function restoreUsers(users) {
  console.log(`\n📦 Restaurando ${users.length} usuarios...`);

  if (DRY_RUN) {
    console.log('   🔍 DRY RUN - No se ejecutarán cambios');
    console.log(`   Primer usuario: ${users[0].email}`);
    return;
  }

  let restored = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      // Verificar si existe
      const existing = await sql`
        SELECT id FROM users WHERE id = ${user.id}
      `;

      if (existing.rows.length > 0) {
        console.log(`   ⚠️  Usuario ${user.email} ya existe - saltando`);
        skipped++;
        continue;
      }

      // Insertar (sin password, usar uno temporal)
      await sql`
        INSERT INTO users (
          id, email, name, role, client_id, account_type, account_status,
          total_cost_usd, monthly_budget_usd, internal_notes, tags,
          last_activity_at, created_at, updated_at
        ) VALUES (
          ${user.id}, ${user.email}, ${user.name}, ${user.role},
          ${user.client_id}, ${user.account_type}, ${user.account_status},
          ${user.total_cost_usd}, ${user.monthly_budget_usd},
          ${user.internal_notes}, ${user.tags}, ${user.last_activity_at},
          ${user.created_at}, ${user.updated_at}
        )
      `;

      console.log(`   ✅ Restaurado: ${user.email}`);
      restored++;
    } catch (error) {
      console.error(`   ❌ Error restaurando ${user.email}:`, error.message);
    }
  }

  console.log(`\n   📊 Resultado: ${restored} restaurados, ${skipped} saltados`);
}

async function restoreRolePermissions(permissions) {
  console.log(`\n📦 Restaurando ${permissions.length} permisos...`);

  if (DRY_RUN) {
    console.log('   🔍 DRY RUN - No se ejecutarán cambios');
    console.log(`   Primer permiso: ${permissions[0].role} - ${permissions[0].resource}`);
    return;
  }

  // Limpiar tabla actual (CUIDADO)
  console.log('   🗑️  Limpiando permisos actuales...');
  await sql`DELETE FROM role_permissions`;

  let restored = 0;

  for (const perm of permissions) {
    try {
      await sql`
        INSERT INTO role_permissions (
          id, role, resource, can_read, can_write, can_delete,
          can_download, created_at
        ) VALUES (
          ${perm.id}, ${perm.role}, ${perm.resource},
          ${perm.can_read}, ${perm.can_write}, ${perm.can_delete},
          ${perm.can_download}, ${perm.created_at}
        )
      `;

      restored++;
    } catch (error) {
      console.error(`   ❌ Error restaurando permiso:`, error.message);
    }
  }

  console.log(`\n   📊 Resultado: ${restored} permisos restaurados`);
}

async function restoreExtractionResults(extractions) {
  console.log(`\n📦 Restaurando ${extractions.length} extracciones...`);

  if (DRY_RUN) {
    console.log('   🔍 DRY RUN - No se ejecutarán cambios');
    return;
  }

  let restored = 0;
  let skipped = 0;

  for (const extraction of extractions) {
    try {
      // Verificar si existe
      const existing = await sql`
        SELECT id FROM extraction_results WHERE id = ${extraction.id}
      `;

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await sql`
        INSERT INTO extraction_results (
          id, user_id, filename, extracted_data, model_used, pdf_blob_url,
          file_type, file_size_bytes, page_count, processing_time_ms,
          confidence_score, status, validation_status, validated_at,
          rejection_reason, batch_id, created_at, updated_at
        ) VALUES (
          ${extraction.id}, ${extraction.user_id}, ${extraction.filename},
          ${extraction.extracted_data}, ${extraction.model_used},
          ${extraction.pdf_blob_url}, ${extraction.file_type},
          ${extraction.file_size_bytes}, ${extraction.page_count},
          ${extraction.processing_time_ms}, ${extraction.confidence_score},
          ${extraction.status}, ${extraction.validation_status},
          ${extraction.validated_at}, ${extraction.rejection_reason},
          ${extraction.batch_id}, ${extraction.created_at}, ${extraction.updated_at}
        )
      `;

      restored++;

      if (restored % 100 === 0) {
        console.log(`   📊 Progreso: ${restored} / ${extractions.length}`);
      }
    } catch (error) {
      console.error(`   ❌ Error restaurando extracción ${extraction.id}:`, error.message);
    }
  }

  console.log(`\n   📊 Resultado: ${restored} restauradas, ${skipped} saltadas`);
}

async function restoreMasterExcelOutput(rows) {
  console.log(`\n📦 Restaurando ${rows.length} filas de Master Excel...`);

  if (DRY_RUN) {
    console.log('   🔍 DRY RUN - No se ejecutarán cambios');
    return;
  }

  let restored = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      // Verificar si existe
      const existing = await sql`
        SELECT id FROM master_excel_output WHERE id = ${row.id}
      `;

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await sql`
        INSERT INTO master_excel_output (
          id, user_id, row_number, row_data, filename, validation_status,
          cross_validation_match, discrepancy_count, notes, is_latest,
          batch_id, created_at, updated_at
        ) VALUES (
          ${row.id}, ${row.user_id}, ${row.row_number}, ${row.row_data},
          ${row.filename}, ${row.validation_status},
          ${row.cross_validation_match}, ${row.discrepancy_count},
          ${row.notes}, ${row.is_latest}, ${row.batch_id},
          ${row.created_at}, ${row.updated_at}
        )
      `;

      restored++;

      if (restored % 500 === 0) {
        console.log(`   📊 Progreso: ${restored} / ${rows.length}`);
      }
    } catch (error) {
      console.error(`   ❌ Error restaurando fila ${row.id}:`, error.message);
    }
  }

  console.log(`\n   📊 Resultado: ${restored} restauradas, ${skipped} saltadas`);
}

// ============================================
// PROCESO PRINCIPAL
// ============================================

async function restore() {
  try {
    console.log('\n🔄 INICIANDO RESTAURACIÓN DE BACKUP\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verificar que existe el archivo
    if (!fs.existsSync(BACKUP_FILE)) {
      console.error(`❌ Archivo ${BACKUP_FILE} no encontrado`);
      console.log('\nPasos para obtener backup:');
      console.log('1. Descargar desde Vercel Blob Storage');
      console.log('2. Descomprimir: gunzip backup.json.gz');
      console.log('3. Renombrar a backup.json');
      process.exit(1);
    }

    // Cargar backup
    console.log(`📂 Cargando backup desde ${BACKUP_FILE}...`);
    const backupStr = fs.readFileSync(BACKUP_FILE, 'utf8');
    const backup = JSON.parse(backupStr);

    console.log(`✅ Backup cargado exitosamente\n`);
    console.log('📋 Metadata:');
    console.log(`   Fecha:          ${backup.metadata.timestamp}`);
    console.log(`   Tipo:           ${backup.metadata.type}`);
    console.log(`   Total registros: ${backup.metadata.totalRecords}`);
    console.log(`   Tamaño:         ${(backup.metadata.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Tablas:         ${backup.metadata.tables.join(', ')}\n`);

    if (DRY_RUN) {
      console.log('⚠️  MODO DRY RUN ACTIVADO');
      console.log('   No se realizarán cambios reales en la base de datos');
      console.log('   Cambiar DRY_RUN = false para ejecutar\n');
    } else {
      console.log('🚨 MODO EJECUCIÓN REAL');
      console.log('   Los cambios se aplicarán a la base de datos');
      console.log('   Presiona Ctrl+C en los próximos 5 segundos para cancelar...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Restaurar tablas seleccionadas
    for (const [table, shouldRestore] of Object.entries(RESTORE_TABLES)) {
      if (!shouldRestore) {
        console.log(`⏭️  Saltando ${table} (desactivado en config)`);
        continue;
      }

      if (!backup.data[table]) {
        console.log(`⚠️  Tabla ${table} no encontrada en backup`);
        continue;
      }

      switch (table) {
        case 'users':
          await restoreUsers(backup.data.users);
          break;
        case 'role_permissions':
          await restoreRolePermissions(backup.data.role_permissions);
          break;
        case 'extraction_results':
          await restoreExtractionResults(backup.data.extraction_results);
          break;
        case 'master_excel_output':
          await restoreMasterExcelOutput(backup.data.master_excel_output);
          break;
        default:
          console.log(`⚠️  No hay función de restauración para ${table}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ RESTAURACIÓN COMPLETADA\n');

    if (DRY_RUN) {
      console.log('ℹ️  Fue un dry run - no se realizaron cambios');
      console.log('   Revisa los logs y cambia DRY_RUN = false para ejecutar\n');
    }

  } catch (error) {
    console.error('\n❌ Error en restauración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

restore();
