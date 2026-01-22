/**
 * API: Ejecutar Validación Cruzada
 *
 * POST /api/extractions/:id/cross-validate
 *
 * Valida los datos extraídos por IA contra el Excel de referencia del cliente
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import CrossValidationService from '../../../src/services/crossValidationService.js';

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
    const extractionId = req.query.id as string;

    if (!extractionId) {
      return res.status(400).json({ error: 'ID de extracción requerido' });
    }

    console.log(`🔍 Iniciando validación cruzada para extracción: ${extractionId}`);

    // Ejecutar validación cruzada
    const validationResult = await CrossValidationService.validateExtraction(extractionId);

    if (!validationResult.success) {
      console.error('❌ Error en validación:', validationResult.error);
      return res.status(400).json({
        success: false,
        error: validationResult.error
      });
    }

    const result = validationResult.result!;

    console.log(`✅ Validación completada: ${result.matchPercentage}% match`);
    console.log(`   - Campos coincidentes: ${result.matchingFieldsCount}/${result.totalFieldsCompared}`);
    console.log(`   - Discrepancias: ${result.discrepancyCount} (${result.criticalDiscrepancies} críticas)`);

    // Respuesta detallada
    return res.status(200).json({
      success: true,
      result: {
        matches: result.matches,
        matchPercentage: result.matchPercentage,
        summary: {
          totalFieldsCompared: result.totalFieldsCompared,
          matchingFields: result.matchingFieldsCount,
          discrepancies: result.discrepancyCount,
          criticalDiscrepancies: result.criticalDiscrepancies,
          warningDiscrepancies: result.warningDiscrepancies
        },
        discrepancies: result.discrepancies,
        matchingFields: result.matchingFields
      }
    });

  } catch (error: any) {
    console.error('❌ Error al ejecutar validación cruzada:', error);

    return res.status(500).json({
      success: false,
      error: 'Error interno',
      message: error.message
    });
  }
}
