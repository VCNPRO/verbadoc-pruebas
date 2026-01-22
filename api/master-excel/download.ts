/**
 * API ENDPOINT: /api/master-excel/download
 * Descargar el Excel master completo con todas las filas procesadas
 *
 * CRÍTICO: Debe exportar EXACTAMENTE 45 columnas según FUNDAE oficial
 * Si column_mappings no tiene 45 columnas, usa las columnas oficiales
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import { AccessLogDB } from '../lib/access-log.js';
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

// Helper: Convertir letra de columna (A-Z, AA-ZZ) a número
function columnToNumber(column: string): number {
  let result = 0;
  for (let i = 0; i < column.length; i++) {
    result = result * 26 + (column.charCodeAt(i) - 64);
  }
  return result;
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
    console.log('📥 Generando Excel master para usuario:', user.email);

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIÓN CRÍTICA: Siempre usar las 45 columnas oficiales FUNDAE
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

    console.log(`✅ Validación de columnas OK: ${columnValidation.count} columnas oficiales FUNDAE`);

    // Verificar si hay configuración personalizada (pero advertir si no tiene 45 columnas)
    const mappingConfig = await sql`
      SELECT mappings
      FROM column_mappings
      WHERE user_id = ${user.userId}
        AND is_active = true
      LIMIT 1
    `;

    let useOfficialColumns = true;
    let columnMappings: any[] = [];

    if (mappingConfig.rows.length > 0) {
      const customMappings = mappingConfig.rows[0].mappings;
      if (customMappings.length === FUNDAE_REQUIRED_COLUMNS) {
        columnMappings = customMappings;
        useOfficialColumns = false;
        console.log(`📋 Usando configuración personalizada con ${columnMappings.length} columnas`);
      } else {
        console.warn(`⚠️ Configuración personalizada tiene ${customMappings.length} columnas, se requieren ${FUNDAE_REQUIRED_COLUMNS}`);
        console.warn(`⚠️ USANDO COLUMNAS OFICIALES FUNDAE en su lugar`);
      }
    }

    // Si no hay configuración válida, usar las columnas oficiales
    if (useOfficialColumns) {
      console.log(`📋 Usando ${FUNDAE_REQUIRED_COLUMNS} columnas oficiales FUNDAE`);
      columnMappings = FUNDAE_EXCEL_COLUMNS.map(col => ({
        fundaeField: col.field,
        excelColumn: col.excelColumn,
        excelColumnName: col.header
      }));
    }

    // 2. Ordenar columnas por letra (A, B, C, ... AA, AB, etc.)
    columnMappings.sort((a, b) => {
      return columnToNumber(a.excelColumn) - columnToNumber(b.excelColumn);
    });

    console.log(`📊 Columnas ordenadas: ${columnMappings.map(c => c.excelColumn).join(', ')}`);

    // 3. Obtener todas las filas del usuario (excluyendo las que están en revisión)
    const result = await sql`
      SELECT
        row_number,
        row_data,
        filename,
        validation_status,
        cross_validation_match,
        discrepancy_count,
        created_at
      FROM master_excel_output
      WHERE user_id = ${user.userId}
        AND is_latest = true
        AND validation_status != 'needs_review'
      ORDER BY row_number ASC, created_at DESC
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No hay formularios procesados',
        message: 'Procesa al menos un formulario antes de descargar el Excel'
      });
    }

    console.log(`📊 Generando Excel con ${result.rows.length} filas y ${columnMappings.length} columnas`);

    // 4. Crear workbook
    const workbook = XLSX.utils.book_new();

    // 5. Preparar headers según configuración
    const headers = columnMappings.map(mapping => mapping.excelColumnName || mapping.fundaeField);

    // 6. Preparar datos para el Excel
    const worksheetData: any[][] = [headers];

    // 7. Agregar cada fila
    result.rows.forEach(row => {
      const rowData = row.row_data;
      const excelRow = columnMappings.map(mapping => {
        const fieldName = mapping.fundaeField;
        const value = rowData[fieldName];

        // Aplicar transformación si está configurada
        if (value !== undefined && value !== null) {
          switch (mapping.transform) {
            case 'uppercase':
            case 'Mayúsculas':
              return String(value).toUpperCase();
            case 'lowercase':
            case 'Minúsculas':
              return String(value).toLowerCase();
            case 'date':
            case 'Formato fecha':
              // TODO: Implementar formato de fecha
              return value;
            default:
              return value;
          }
        }

        return '';
      });
      worksheetData.push(excelRow);
    });

    // 8. Crear worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // 9. Ajustar anchos de columnas
    const colWidths = headers.map(h => ({ wch: Math.max(String(h).length + 2, 15) }));
    worksheet['!cols'] = colWidths;

    // 10. Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Formularios FUNDAE');

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIÓN FINAL: Verificar que estamos exportando exactamente 45 columnas
    // ═══════════════════════════════════════════════════════════════════════════
    if (columnMappings.length !== FUNDAE_REQUIRED_COLUMNS) {
      console.error(`🚨 ERROR CRÍTICO: Se esperan ${FUNDAE_REQUIRED_COLUMNS} columnas pero hay ${columnMappings.length}`);
      return res.status(500).json({
        error: 'Error de configuración de columnas',
        message: `El Excel debe tener exactamente ${FUNDAE_REQUIRED_COLUMNS} columnas, pero la configuración tiene ${columnMappings.length}`,
        expectedColumns: FUNDAE_REQUIRED_COLUMNS,
        actualColumns: columnMappings.length
      });
    }

    // 11. Agregar hoja con metadata
    const metadataData = [
      ['Información del Excel Master FUNDAE'],
      [''],
      ['Usuario', user.email],
      ['Total filas', result.rows.length],
      ['Total columnas', columnMappings.length],
      ['Columnas requeridas FUNDAE', FUNDAE_REQUIRED_COLUMNS],
      ['Fecha generación', new Date().toLocaleString()],
      [''],
      ['⚠️ IMPORTANTE: Este Excel tiene exactamente 45 columnas según formato FUNDAE oficial'],
      [''],
      ['Estadísticas'],
      ['Estado', 'Cantidad'],
    ];

    // Contar por estado
    const statsByStatus = result.rows.reduce((acc, row) => {
      acc[row.validation_status] = (acc[row.validation_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(statsByStatus).forEach(([status, count]) => {
      metadataData.push([status, count]);
    });

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

    // 12. Generar buffer del Excel
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 13. Nombre del archivo
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `FUNDAE_Master_${timestamp}.xlsx`;

    console.log('✅ Excel generado:', filename, `(${columnMappings.length} columnas, ${result.rows.length} filas)`);

    // Log download
    await AccessLogDB.logFromRequest({
      req,
      userId: user.userId,
      action: 'download_excel',
      resourceType: 'excel_master',
      resourceName: filename,
      success: true,
      metadata: {
        columns: columnMappings.length,
        rows: result.rows.length,
        fileSize: buffer.length,
      },
    });

    // 14. Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    // 15. Enviar archivo
    return res.status(200).send(buffer);

  } catch (error: any) {
    console.error('Error al generar Excel:', error);
    return res.status(500).json({
      error: 'Error al generar Excel',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
