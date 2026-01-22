/**
 * CRON JOB: /api/cron/backup-database
 * Backup completo de la base de datos PostgreSQL cada 24 horas
 *
 * TABLAS INCLUIDAS:
 * - users (sin passwords)
 * - extraction_results
 * - master_excel_output
 * - validation_errors
 * - unprocessable_documents
 * - reference_data
 * - column_mappings
 * - role_permissions
 * - access_logs (últimos 30 días)
 *
 * POLÍTICA DE RETENCIÓN:
 * - Backups diarios: 7 días
 * - Backups semanales: 4 semanas
 * - Backups mensuales: 3 meses
 *
 * Configuración en vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/backup-database",
 *     "schedule": "0 2 * * *"  // 2 AM diario
 *   }]
 * }
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { put, list, del } from '@vercel/blob';
import { createGzip } from 'zlib';
import { promisify } from 'util';

const gzip = promisify(createGzip().end.bind(createGzip()));

// Verificar autenticación del cron
function verifyCronAuth(req: VercelRequest): boolean {
  const authHeader = req.headers['authorization'];

  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // En desarrollo, permitir sin auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

interface BackupMetadata {
  timestamp: string;
  type: 'daily' | 'weekly' | 'monthly';
  tables: string[];
  totalRecords: number;
  size: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  if (!verifyCronAuth(req)) {
    console.error('❌ Acceso no autorizado al cron de backup de BD');
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    console.log('🔄 Iniciando backup completo de base de datos...');

    const backupData: Record<string, any> = {};
    let totalRecords = 0;

    // 1. USERS (sin passwords)
    console.log('📦 Backup de users...');
    const users = await sql`
      SELECT id, email, name, role, client_id, account_type, account_status,
             total_cost_usd, monthly_budget_usd, internal_notes, tags,
             last_activity_at, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `;
    backupData.users = users.rows;
    totalRecords += users.rows.length;
    console.log(`  ✅ ${users.rows.length} usuarios`);

    // 2. EXTRACTION_RESULTS
    console.log('📦 Backup de extraction_results...');
    const extractions = await sql`
      SELECT id, user_id, filename, extracted_data, model_used, pdf_blob_url,
             file_type, file_size_bytes, page_count, processing_time_ms,
             confidence_score, status, validation_status, validated_at,
             rejection_reason, batch_id, created_at, updated_at
      FROM extraction_results
      WHERE created_at >= NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `;
    backupData.extraction_results = extractions.rows;
    totalRecords += extractions.rows.length;
    console.log(`  ✅ ${extractions.rows.length} extracciones (últimos 90 días)`);

    // 3. MASTER_EXCEL_OUTPUT
    console.log('📦 Backup de master_excel_output...');
    const masterExcel = await sql`
      SELECT id, user_id, row_number, row_data, filename, validation_status,
             cross_validation_match, discrepancy_count, notes, is_latest,
             batch_id, created_at, updated_at
      FROM master_excel_output
      WHERE is_latest = true
      ORDER BY user_id, row_number
    `;
    backupData.master_excel_output = masterExcel.rows;
    totalRecords += masterExcel.rows.length;
    console.log(`  ✅ ${masterExcel.rows.length} filas master excel`);

    // 4. VALIDATION_ERRORS
    console.log('📦 Backup de validation_errors...');
    const validationErrors = await sql`
      SELECT id, extraction_id, field_name, error_type, error_message,
             expected_value, actual_value, severity, is_fixed, fixed_at,
             fixed_by_user_id, created_at
      FROM validation_errors
      WHERE created_at >= NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `;
    backupData.validation_errors = validationErrors.rows;
    totalRecords += validationErrors.rows.length;
    console.log(`  ✅ ${validationErrors.rows.length} errores de validación`);

    // 5. UNPROCESSABLE_DOCUMENTS
    console.log('📦 Backup de unprocessable_documents...');
    const unprocessable = await sql`
      SELECT id, user_id, filename, rejection_category, rejection_reason,
             numero_expediente, numero_accion, numero_grupo, extracted_data,
             retry_count, max_retries, can_retry, file_hash, batch_id,
             created_at, updated_at, reviewed_at
      FROM unprocessable_documents
      WHERE created_at >= NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `;
    backupData.unprocessable_documents = unprocessable.rows;
    totalRecords += unprocessable.rows.length;
    console.log(`  ✅ ${unprocessable.rows.length} documentos no procesables`);

    // 6. REFERENCE_DATA
    console.log('📦 Backup de reference_data...');
    const referenceData = await sql`
      SELECT id, data, source_file, is_active, created_at, updated_at
      FROM reference_data
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    backupData.reference_data = referenceData.rows;
    totalRecords += referenceData.rows.length;
    console.log(`  ✅ ${referenceData.rows.length} registros de referencia`);

    // 7. COLUMN_MAPPINGS
    console.log('📦 Backup de column_mappings...');
    const columnMappings = await sql`
      SELECT id, user_id, name, mappings, is_active, created_at, updated_at
      FROM column_mappings
      ORDER BY created_at DESC
    `;
    backupData.column_mappings = columnMappings.rows;
    totalRecords += columnMappings.rows.length;
    console.log(`  ✅ ${columnMappings.rows.length} mapeos de columnas`);

    // 8. ROLE_PERMISSIONS
    console.log('📦 Backup de role_permissions...');
    const rolePermissions = await sql`
      SELECT id, role, resource, can_read, can_write, can_delete, can_download, created_at
      FROM role_permissions
      ORDER BY role, resource
    `;
    backupData.role_permissions = rolePermissions.rows;
    totalRecords += rolePermissions.rows.length;
    console.log(`  ✅ ${rolePermissions.rows.length} permisos de rol`);

    // 9. ACCESS_LOGS (últimos 30 días)
    console.log('📦 Backup de access_logs...');
    const accessLogs = await sql`
      SELECT id, user_id, user_email, user_role, action, resource_type,
             resource_id, resource_name, ip_address, user_agent, success,
             error_message, metadata, created_at
      FROM access_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
    `;
    backupData.access_logs = accessLogs.rows;
    totalRecords += accessLogs.rows.length;
    console.log(`  ✅ ${accessLogs.rows.length} logs de acceso (últimos 30 días)`);

    // Crear metadata del backup
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Domingo
    const dayOfMonth = now.getDate();

    // Determinar tipo de backup
    let backupType: 'daily' | 'weekly' | 'monthly' = 'daily';
    if (dayOfMonth === 1) {
      backupType = 'monthly';
    } else if (dayOfWeek === 0) {
      backupType = 'weekly';
    }

    const metadata: BackupMetadata = {
      timestamp: now.toISOString(),
      type: backupType,
      tables: Object.keys(backupData),
      totalRecords,
      size: 0, // Se calculará después de comprimir
    };

    // Agregar metadata al backup
    const fullBackup = {
      metadata,
      data: backupData,
    };

    // Convertir a JSON
    const jsonStr = JSON.stringify(fullBackup, null, 2);
    const buffer = Buffer.from(jsonStr, 'utf-8');

    // Comprimir con gzip
    console.log('🗜️  Comprimiendo backup...');
    const { createGzip } = await import('zlib');
    const gzipStream = createGzip();

    const chunks: Buffer[] = [];
    gzipStream.on('data', (chunk) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      gzipStream.on('end', () => resolve());
      gzipStream.on('error', reject);
      gzipStream.write(buffer);
      gzipStream.end();
    });

    const compressedBuffer = Buffer.concat(chunks);
    metadata.size = compressedBuffer.length;

    const compressionRatio = ((1 - compressedBuffer.length / buffer.length) * 100).toFixed(1);
    console.log(`  ✅ Comprimido: ${buffer.length} → ${compressedBuffer.length} bytes (${compressionRatio}% reducción)`);

    // Nombre del archivo
    const timestamp = now.toISOString().split('T')[0];
    const filename = `database-backups/${backupType}/backup_${timestamp}_${now.getTime()}.json.gz`;

    // Subir a Vercel Blob
    console.log('☁️  Subiendo a Vercel Blob...');
    const blob = await put(filename, compressedBuffer, {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log(`  ✅ Backup guardado: ${blob.url}`);

    // LIMPIEZA: Aplicar política de retención
    console.log('🧹 Aplicando política de retención...');

    try {
      const { blobs } = await list({ prefix: 'database-backups/' });

      // Agrupar por tipo
      const dailyBackups = blobs.filter(b => b.pathname.includes('/daily/'));
      const weeklyBackups = blobs.filter(b => b.pathname.includes('/weekly/'));
      const monthlyBackups = blobs.filter(b => b.pathname.includes('/monthly/'));

      // Ordenar por fecha (más reciente primero)
      const sortByDate = (a: any, b: any) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();

      dailyBackups.sort(sortByDate);
      weeklyBackups.sort(sortByDate);
      monthlyBackups.sort(sortByDate);

      // Mantener solo los permitidos por política
      const toDelete: any[] = [
        ...dailyBackups.slice(7),     // Mantener últimos 7 diarios
        ...weeklyBackups.slice(4),    // Mantener últimas 4 semanales
        ...monthlyBackups.slice(3),   // Mantener últimas 3 mensuales
      ];

      for (const blob of toDelete) {
        await del(blob.url);
        console.log(`  🗑️  Eliminado: ${blob.pathname}`);
      }

      console.log(`  ✅ Limpieza completada: ${toDelete.length} backups antiguos eliminados`);
    } catch (cleanupError: any) {
      console.error('⚠️  Error en limpieza (no crítico):', cleanupError.message);
    }

    console.log('✅ Backup de base de datos completado exitosamente');

    return res.status(200).json({
      success: true,
      message: `Backup ${backupType} completado`,
      timestamp: metadata.timestamp,
      type: backupType,
      tables: metadata.tables.length,
      totalRecords,
      size: metadata.size,
      url: blob.url,
      compressionRatio: `${compressionRatio}%`,
    });

  } catch (error: any) {
    console.error('❌ Error en backup de base de datos:', error);
    return res.status(500).json({
      error: 'Error en backup de base de datos',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
