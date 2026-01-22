/**
 * API ENDPOINT: POST /api/extractions/:id/reject
 * Rechazar un formulario (marcar como inválido)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ExtractionResultDB } from '../../lib/extractionDB.js';
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
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de extracción requerido' });
  }

  try {
    // Verificar que la extracción existe
    const extraction = await ExtractionResultDB.findById(id);

    if (!extraction) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }

    // Verificar permisos
    if (user.role !== 'admin' && extraction.user_id !== user.userId) {
      return res.status(403).json({ error: 'No tienes permiso para rechazar esta extracción' });
    }

    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Debes proporcionar un motivo de rechazo' });
    }

    // Marcar como rechazado
    await ExtractionResultDB.updateValidationStatus(id, 'rejected', reason);

    // Obtener extracción actualizada
    const updatedExtraction = await ExtractionResultDB.findById(id);

    console.log(`❌ Extracción ${id} rechazada por usuario ${user.userId}: ${reason}`);

    return res.status(200).json({
      success: true,
      message: 'Formulario rechazado correctamente',
      extraction: updatedExtraction
    });

  } catch (error: any) {
    console.error('Error al rechazar extracción:', error);
    return res.status(500).json({
      error: 'Error al rechazar extracción',
      message: error.message
    });
  }
}
