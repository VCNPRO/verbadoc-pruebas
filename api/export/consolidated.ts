/**
 * API: Exportación Consolidada
 *
 * POST /api/export/consolidated
 *
 * Exporta múltiples extracciones a Excel, CSV o PDF
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import ExportService from '../../src/services/exportService.js';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; email: string; role: string } | null {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['auth-token'];
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
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const {
      extractionIds,
      format,
      includeValidation,
      includeCrossValidation,
      groupBy
    } = req.body;

    // Validación
    if (!extractionIds || !Array.isArray(extractionIds)) {
      return res.status(400).json({
        error: 'Parámetro requerido: extractionIds (array)'
      });
    }

    if (extractionIds.length === 0) {
      return res.status(400).json({
        error: 'Debe proporcionar al menos una extracción para exportar'
      });
    }

    if (extractionIds.length > 1000) {
      return res.status(400).json({
        error: 'Máximo 1000 extracciones por exportación'
      });
    }

    if (!format || !['excel', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        error: 'Formato debe ser: excel, csv o pdf'
      });
    }

    console.log(`📊 Exportando ${extractionIds.length} extracciones a ${format.toUpperCase()}`);

    // Ejecutar exportación
    const result = await ExportService.exportExtractions({
      extractionIds,
      format,
      includeValidation: includeValidation === true,
      includeCrossValidation: includeCrossValidation === true,
      groupBy
    });

    if (!result.success) {
      console.error('❌ Error en exportación:', result.error);
      return res.status(500).json({
        error: 'Error al exportar',
        message: result.error
      });
    }

    console.log(`✅ Exportación completada: ${result.filename}`);

    // Enviar archivo como descarga
    res.setHeader('Content-Type', result.mimeType!);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer!.length);

    return res.send(result.buffer);

  } catch (error: any) {
    console.error('❌ Error al exportar:', error);

    return res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
}
