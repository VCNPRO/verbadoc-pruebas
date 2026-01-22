/**
 * API ENDPOINT: POST /api/extractions/:id/validate
 * Ejecuta validación manual de una extracción
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ExtractionResultDB } from '../../lib/extractionDB.js';
import ValidationService from '../../_lib/validationService.js';
import EmailService from '../../_lib/emailService.js';
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

  // Obtener ID de la extracción
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de extracción requerido' });
  }

  try {
    // Cargar extracción
    const extraction = await ExtractionResultDB.findById(id);

    if (!extraction) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }

    // Verificar permisos
    if (user.role !== 'admin' && extraction.user_id !== user.userId) {
      return res.status(403).json({
        error: 'No tienes permiso para validar esta extracción'
      });
    }

    console.log(`🔍 Validando extracción: ${id}`);

    // Ejecutar re-validación (borra errores anteriores y re-valida)
    const { errors, criticalCount } = await ValidationService.revalidateExtraction(id);

    // Actualizar estado de la extracción
    let newStatus: 'valid' | 'needs_review' | 'pending' = 'valid';

    if (criticalCount > 0) {
      newStatus = 'needs_review';
    } else if (errors.length > 0) {
      newStatus = 'pending';
    }

    await ExtractionResultDB.update(id, {
      status: newStatus,
      validatedAt: new Date()
    });

    console.log(`✅ Validación completada: ${errors.length} errores (${criticalCount} críticos)`);

    // Si hay errores críticos, enviar email (opcional)
    if (criticalCount > 0 && process.env.RESEND_API_KEY) {
      try {
        await EmailService.notifyNeedsReview(extraction, errors);
        console.log('📧 Email de notificación enviado');
      } catch (emailError) {
        console.error('Error al enviar email:', emailError);
        // No bloquear respuesta si falla el email
      }
    }

    // Obtener estadísticas
    const stats = await ValidationService.getValidationStats(id);

    return res.status(200).json({
      success: true,
      message: 'Validación completada',
      extraction: {
        id: extraction.id,
        filename: extraction.filename,
        status: newStatus
      },
      validation: {
        totalErrors: errors.length,
        criticalErrors: criticalCount,
        stats
      },
      errors: errors.map(e => ({
        fieldName: e.fieldName,
        extractedValue: e.extractedValue,
        errorType: e.errorType,
        errorMessage: e.errorMessage,
        expectedFormat: e.expectedFormat,
        severity: e.severity
      }))
    });

  } catch (error: any) {
    console.error('Error al validar extracción:', error);
    return res.status(500).json({
      error: 'Error al validar extracción',
      message: error.message
    });
  }
}
