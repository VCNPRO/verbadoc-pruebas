/**
 * API: Consultar Estado de Batch
 *
 * GET /api/batch/:id/status
 *
 * Obtiene el estado actual y progreso de un batch job
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import BatchProcessingService from '../../../src/services/batchProcessingService.js';

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
  // Solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const batchId = req.query.id as string;

    if (!batchId) {
      return res.status(400).json({ error: 'ID de batch requerido' });
    }

    // Obtener batch
    const batch = await BatchProcessingService.getBatch(batchId);

    if (!batch) {
      return res.status(404).json({ error: 'Batch no encontrado' });
    }

    // Verificar propiedad
    if (batch.userId !== user.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Obtener estadísticas
    const stats = await BatchProcessingService.getBatchStats(batchId);

    // Obtener items (opcional, solo si se solicita)
    const includeItems = req.query.includeItems === 'true';
    let items = undefined;

    if (includeItems) {
      items = await BatchProcessingService.getBatchItems(batchId);
    }

    return res.status(200).json({
      batch: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        status: batch.status,
        modelUsed: batch.modelUsed,
        totalFiles: batch.totalFiles,
        processedFiles: batch.processedFiles,
        successfulFiles: batch.successfulFiles,
        failedFiles: batch.failedFiles,
        createdAt: batch.createdAt,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        processingTimeMs: batch.processingTimeMs
      },
      stats: {
        totalItems: stats.totalItems,
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        completionPercentage: stats.completionPercentage,
        avgProcessingTimeMs: stats.avgProcessingTimeMs,
        estimatedTimeRemainingMs: stats.estimatedTimeRemainingMs,
        estimatedTimeRemainingFormatted: stats.estimatedTimeRemainingMs
          ? formatTime(stats.estimatedTimeRemainingMs)
          : null
      },
      items: items || undefined
    });

  } catch (error: any) {
    console.error('❌ Error al consultar batch:', error);

    return res.status(500).json({
      error: 'Error al consultar batch',
      message: error.message
    });
  }
}

// Helper: Formatear tiempo estimado
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `~${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `~${minutes}m ${seconds % 60}s`;
  } else {
    return `~${seconds}s`;
  }
}
