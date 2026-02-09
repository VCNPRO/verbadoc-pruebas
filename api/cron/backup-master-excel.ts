/**
 * CRON JOB: /api/cron/backup-master-excel
 * Backup automático del Excel Master cada 60 minutos
 *
 * Configuración en vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/backup-master-excel",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { put, list, del } from '@vercel/blob';
import * as XLSX from 'xlsx';

// Verificar que la request viene del cron de Vercel
function verifyCronAuth(req: VercelRequest): boolean {
  const authHeader = req.headers['authorization'];

  // Vercel cron jobs incluyen un token en el header
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // En desarrollo, permitir sin auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

// Mapeo de campos FUNDAE
const EXCEL_COLUMNS = [
  { field: 'numero_expediente', header: 'Nº Expediente' },
  { field: 'nif_empresa', header: 'CIF' },
  { field: 'razon_social', header: 'Razón Social' },
  { field: 'denominacion_aaff', header: 'Denominación AAFF' },
  { field: 'modalidad', header: 'Modalidad' },
  { field: 'edad', header: 'Edad' },
  { field: 'sexo', header: 'Sexo' },
  { field: 'titulacion', header: 'Titulación' },
  { field: 'lugar_trabajo', header: 'Lugar Trabajo' },
  { field: 'categoria_profesional', header: 'Categoría Profesional' },
  { field: 'horario_curso', header: 'Horario' },
  { field: 'porcentaje_jornada', header: '% Jornada' },
  { field: 'tamano_empresa', header: 'Tamaño Empresa' },
  { field: 'valoracion_1_1', header: 'Val 1.1 - Organización' },
  { field: 'valoracion_2_1', header: 'Val 2.1 - Contenidos' },
  { field: 'valoracion_3_1', header: 'Val 3.1 - Duración' },
  { field: 'valoracion_4_1_formadores', header: 'Val 4.1 - Formadores' },
  { field: 'valoracion_5_1', header: 'Val 5.1 - Medios Didácticos' },
  { field: 'valoracion_6_1', header: 'Val 6.1 - Instalaciones' },
  { field: 'valoracion_9_1', header: 'Val 9.1 - Mercado Trabajo' },
  { field: 'valoracion_10', header: 'Satisfacción General' },
  { field: 'recomendaria_curso', header: 'Recomendaría' },
  { field: 'fecha_cumplimentacion', header: 'Fecha' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo GET/POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación del cron
  if (!verifyCronAuth(req)) {
    console.error('❌ Acceso no autorizado al cron de backup');
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    console.log('🔄 Iniciando backup automático del Excel Master...');

    // Obtener todos los datos de todos los usuarios
    const result = await sql`
      SELECT
        user_id,
        row_number,
        row_data,
        filename,
        validation_status,
        cross_validation_match,
        discrepancy_count,
        created_at,
        updated_at
      FROM master_excel_output
      WHERE is_latest = true
      ORDER BY user_id, row_number ASC
    `;

    if (result.rows.length === 0) {
      console.log('ℹ️  No hay datos para hacer backup');
      return res.status(200).json({
        success: true,
        message: 'No hay datos para backup',
        rows: 0
      });
    }

    console.log(`📊 Generando backup con ${result.rows.length} filas`);

    // Agrupar por usuario
    const dataByUser = result.rows.reduce((acc, row) => {
      if (!acc[row.user_id]) {
        acc[row.user_id] = [];
      }
      acc[row.user_id].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    const backups: string[] = [];

    // Crear backup para cada usuario
    for (const [userId, userRows] of Object.entries(dataByUser)) {
      console.log(`📦 Creando backup para usuario ${userId} (${userRows.length} filas)`);

      // Crear workbook
      const workbook = XLSX.utils.book_new();

      // Preparar datos
      const headers = EXCEL_COLUMNS.map(col => col.header);
      const worksheetData: any[][] = [headers];

      userRows.forEach(row => {
        const rowData = row.row_data;
        const excelRow = EXCEL_COLUMNS.map(col => {
          const value = rowData[col.field];
          return value !== undefined && value !== null ? value : '';
        });
        worksheetData.push(excelRow);
      });

      // Crear worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
      worksheet['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Formularios FUNDAE');

      // Metadata
      const metadataData = [
        ['Backup Automático Excel Master'],
        [''],
        ['Usuario ID', userId],
        ['Total filas', userRows.length],
        ['Fecha backup', new Date().toISOString()],
        ['Tipo', 'Automático (cada 60 min)'],
      ];
      const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Backup Info');

      // Generar buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Nombre del archivo con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backups/user_${userId}/FUNDAE_Backup_${timestamp}.xlsx`;

      // Subir a Vercel Blob Storage
      try {
        const blob = await put(filename, buffer, {
          access: 'public',
          addRandomSuffix: false
        });

        console.log(`✅ Backup excel guardado`);
        backups.push(blob.pathname);
      } catch (uploadError: any) {
        console.error(`❌ Error al subir backup para usuario ${userId}:`, uploadError.message);
      }
    }

    // Limpiar backups antiguos (mantener últimos 48 = 2 días)
    console.log('🧹 Limpiando backups antiguos...');
    try {
      const { blobs } = await list({ prefix: 'backups/' });

      // Agrupar por usuario
      const blobsByUser = blobs.reduce((acc, blob) => {
        const match = blob.pathname.match(/user_([^/]+)/);
        if (match) {
          const userId = match[1];
          if (!acc[userId]) acc[userId] = [];
          acc[userId].push(blob);
        }
        return acc;
      }, {} as Record<string, any[]>);

      // Para cada usuario, mantener solo los últimos 48
      for (const [userId, userBlobs] of Object.entries(blobsByUser)) {
        if (userBlobs.length > 48) {
          // Ordenar por fecha (más reciente primero)
          userBlobs.sort((a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          );

          // Eliminar los más antiguos
          const toDelete = userBlobs.slice(48);
          for (const blob of toDelete) {
            await del(blob.url);
            console.log(`🗑️  Backup antiguo eliminado: ${blob.pathname}`);
          }
        }
      }

      console.log('✅ Limpieza de backups completada');
    } catch (cleanupError: any) {
      console.error('⚠️  Error en limpieza de backups (no crítico):', cleanupError.message);
    }

    console.log('✅ Backup automático completado exitosamente');

    return res.status(200).json({
      success: true,
      message: 'Backup automático completado',
      timestamp: new Date().toISOString(),
      totalRows: result.rows.length,
      users: Object.keys(dataByUser).length,
      backups: backups.length,
      backupUrls: backups
    });

  } catch (error: any) {
    console.error('❌ Error en backup automático:', error);
    return res.status(500).json({
      error: 'Error en backup automático',
      message: error.message
    });
  }
}
