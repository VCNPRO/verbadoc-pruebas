/**
 * API ENDPOINT: /api/admin/backup-manual
 * Ejecutar backup manual (Admin only)
 *
 * POST /api/admin/backup-manual
 * Body: {
 *   type: 'full' | 'database' | 'excel'
 * }
 *
 * Respuestas:
 * 200: Backup completado
 * 401: No autenticado
 * 403: No autorizado (no admin)
 * 500: Error en backup
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth, verifyAdmin } from '../lib/auth.js';
import { AccessLogDB } from '../lib/access-log.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  const allowedOrigins = [
    'https://www.verbadocpro.eu',
    'https://verbadoc-europa-pro.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  const authPayload = verifyRequestAuth(req);
  if (!authPayload) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // Verificar que es admin
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'No autorizado - Solo administradores' });
  }

  try {
    const { type = 'full' } = req.body;

    console.log(`🔄 Iniciando backup manual: ${type}`);

    const results: any = {
      type,
      timestamp: new Date().toISOString(),
      success: true,
      backups: [],
    };

    // BACKUP DE BASE DE DATOS
    if (type === 'full' || type === 'database') {
      console.log('📦 Ejecutando backup de base de datos...');
      try {
        const dbBackupUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/backup-database`;

        const dbResponse = await fetch(dbBackupUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev'}`,
          },
        });

        const dbResult = await dbResponse.json();
        results.backups.push({
          type: 'database',
          success: dbResponse.ok,
          data: dbResult,
        });

        console.log(`  ✅ Backup de BD completado: ${dbResult.url || 'OK'}`);
      } catch (dbError: any) {
        console.error('❌ Error en backup de BD:', dbError.message);
        results.backups.push({
          type: 'database',
          success: false,
          error: dbError.message,
        });
      }
    }

    // BACKUP DE EXCEL MASTER
    if (type === 'full' || type === 'excel') {
      console.log('📦 Ejecutando backup de Excel Master...');
      try {
        const excelBackupUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/backup-master-excel`;

        const excelResponse = await fetch(excelBackupUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev'}`,
          },
        });

        const excelResult = await excelResponse.json();
        results.backups.push({
          type: 'excel',
          success: excelResponse.ok,
          data: excelResult,
        });

        console.log(`  ✅ Backup de Excel completado: ${excelResult.backups || 0} archivos`);
      } catch (excelError: any) {
        console.error('❌ Error en backup de Excel:', excelError.message);
        results.backups.push({
          type: 'excel',
          success: false,
          error: excelError.message,
        });
      }
    }

    // Log access
    await AccessLogDB.logFromRequest({
      req,
      userId: authPayload.userId,
      action: 'create_user', // Usar action genérico, podríamos crear 'manual_backup'
      resourceType: 'backup',
      resourceName: `Manual ${type} backup`,
      success: true,
      metadata: {
        backupType: type,
        results,
      },
    });

    console.log('✅ Backup manual completado');

    return res.status(200).json({
      success: true,
      message: `Backup ${type} completado exitosamente`,
      ...results,
    });

  } catch (error: any) {
    console.error('❌ Error en backup manual:', error);

    // Log error
    await AccessLogDB.logFromRequest({
      req,
      userId: authPayload.userId,
      action: 'create_user',
      resourceType: 'backup',
      resourceName: 'Manual backup',
      success: false,
      errorMessage: error.message,
    });

    return res.status(500).json({
      error: 'Error en backup manual',
      message: error.message,
    });
  }
}
