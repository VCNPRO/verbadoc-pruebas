/**
 * API ENDPOINT: /api/sync/download-master-excel
 * Descarga el Excel Master para sincronización local
 *
 * Este endpoint genera un Excel con todos los datos actuales
 * para mantener una copia local sincronizada.
 *
 * CRÍTICO: Debe exportar EXACTAMENTE 45 columnas según FUNDAE oficial
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import {
  FUNDAE_EXCEL_COLUMNS,
  FUNDAE_REQUIRED_COLUMNS,
  validateColumnCount,
  getExcelHeaders,
  extractRowInOrder
} from '../_lib/fundaeExcelColumns.js';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; email: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

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

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    console.log('🔄 Generando Excel para sincronización - Usuario:', user.email);

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIÓN CRÍTICA: Verificar que tenemos exactamente 45 columnas
    // ═══════════════════════════════════════════════════════════════════════════
    const columnValidation = validateColumnCount();
    if (!columnValidation.valid) {
      console.error('🚨 ' + columnValidation.error);
      return res.status(500).json({
        error: 'Error de configuración',
        message: columnValidation.error,
        expectedColumns: FUNDAE_REQUIRED_COLUMNS,
        actualColumns: columnValidation.count
      });
    }

    console.log(`✅ Validación de columnas OK: ${columnValidation.count} columnas`);

    // Obtener timestamp del último sync del usuario (si lo pasó)
    const { since } = req.query;

    let query = `
      SELECT
        row_number,
        row_data,
        filename,
        validation_status,
        cross_validation_match,
        discrepancy_count,
        created_at,
        updated_at
      FROM master_excel_output
      WHERE user_id = $1
        AND is_latest = true
        AND validation_status != 'needs_review'
    `;

    const params: any[] = [user.userId];

    // Si pasó "since", solo traer cambios desde esa fecha
    if (since && typeof since === 'string') {
      query += ` AND updated_at > $2`;
      params.push(since);
      console.log('📊 Sincronización incremental desde:', since);
    }

    query += ` ORDER BY row_number ASC, created_at DESC`;

    const result = await sql.query(query, params);

    if (result.rows.length === 0) {
      return res.status(200).json({
        message: 'No hay datos nuevos para sincronizar',
        rows: 0,
        lastSync: new Date().toISOString()
      });
    }

    console.log(`📊 Generando Excel con ${result.rows.length} filas y ${FUNDAE_REQUIRED_COLUMNS} columnas`);

    // Crear workbook
    const workbook = XLSX.utils.book_new();

    // Preparar datos para el Excel usando la función centralizada
    const headers = getExcelHeaders();
    const worksheetData: any[][] = [headers];

    // Agregar cada fila usando la función centralizada
    result.rows.forEach(row => {
      const excelRow = extractRowInOrder(row.row_data);
      worksheetData.push(excelRow);
    });

    // Crear worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Ajustar anchos de columnas
    const colWidths = headers.map(h => ({ wch: Math.max(String(h).length + 2, 15) }));
    worksheet['!cols'] = colWidths;

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Formularios FUNDAE');

    // Agregar hoja con metadata
    const metadataData = [
      ['Sincronización Excel Master FUNDAE'],
      [''],
      ['Usuario', user.email],
      ['Total filas', result.rows.length],
      ['Total columnas', FUNDAE_REQUIRED_COLUMNS],
      ['Fecha sincronización', new Date().toISOString()],
      ['Tipo', since ? 'Incremental' : 'Completa'],
      [''],
      ['⚠️ IMPORTANTE: Este Excel tiene exactamente 45 columnas según formato FUNDAE oficial'],
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Sync Info');

    // Generar buffer del Excel
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Nombre del archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `FUNDAE_Sync_${timestamp}.xlsx`;

    console.log(`✅ Excel generado: ${filename} (${result.rows.length} filas × ${FUNDAE_REQUIRED_COLUMNS} columnas)`);

    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Sync-Rows', result.rows.length.toString());
    res.setHeader('X-Sync-Columns', FUNDAE_REQUIRED_COLUMNS.toString());
    res.setHeader('X-Sync-Timestamp', new Date().toISOString());

    // Enviar archivo
    return res.status(200).send(buffer);

  } catch (error: any) {
    console.error('Error al generar Excel de sincronización:', error);
    return res.status(500).json({
      error: 'Error al generar Excel de sincronización',
      message: error.message
    });
  }
}
