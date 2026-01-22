/**
 * API ENDPOINT: POST /api/notifications/send
 * Enviar notificación por email manualmente
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ExtractionResultDB, ValidationErrorDB } from '../../src/lib/extractionDB';
import EmailService from '../../src/services/emailService';
import jwt from 'jsonwebtoken';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { extractionId, type } = req.body;

  if (!extractionId || !type) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: extractionId, type'
    });
  }

  try {
    // Obtener la extracción
    const extraction = await ExtractionResultDB.findById(extractionId);

    if (!extraction) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }

    // Verificar permisos
    if (user.role !== 'admin' && extraction.user_id !== user.userId) {
      return res.status(403).json({
        error: 'No tienes permiso para enviar notificaciones de esta extracción'
      });
    }

    // Enviar según el tipo
    if (type === 'needs_review') {
      // Obtener errores de validación
      const dbErrors = await ValidationErrorDB.findPendingByExtractionId(extractionId);

      if (dbErrors.length === 0) {
        return res.status(400).json({
          error: 'No hay errores pendientes para notificar'
        });
      }

      // Mapear ValidationError[] a ValidationErrorInput[]
      const errors = dbErrors.map(e => ({
        fieldName: e.field_name,
        extractedValue: e.invalid_value,
        errorType: e.error_type,
        errorMessage: e.error_message,
        expectedFormat: e.expected_format,
        severity: e.severity
      }));

      await EmailService.notifyNeedsReview(extraction, errors);

      return res.status(200).json({
        success: true,
        message: 'Email de revisión enviado correctamente',
        errorsCount: errors.length
      });

    } else if (type === 'daily_summary') {
      // Obtener estadísticas
      const stats = await ExtractionResultDB.getStats(user.userId);

      await EmailService.sendDailySummary(
        stats.pending,
        stats.needsReview
      );

      return res.status(200).json({
        success: true,
        message: 'Resumen diario enviado correctamente',
        stats
      });

    } else if (type === 'batch_completed') {
      const { totalProcessed, validCount, needsReviewCount, rejectedCount } = req.body;

      if (!totalProcessed) {
        return res.status(400).json({
          error: 'Faltan estadísticas del batch: totalProcessed, validCount, etc.'
        });
      }

      await EmailService.notifyBatchCompleted(
        totalProcessed,
        validCount || 0,
        needsReviewCount || 0,
        rejectedCount || 0
      );

      return res.status(200).json({
        success: true,
        message: 'Email de batch completado enviado correctamente'
      });

    } else {
      return res.status(400).json({
        error: 'Tipo de notificación inválido. Usa: needs_review, daily_summary, batch_completed'
      });
    }

  } catch (error: any) {
    console.error('Error al enviar notificación:', error);
    return res.status(500).json({
      error: 'Error al enviar notificación',
      message: error.message
    });
  }
}
