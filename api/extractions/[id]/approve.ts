/**
 * API ENDPOINT: POST /api/extractions/:id/approve
 * Aprobar un formulario (marcar como válido y corregido)
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

    // Verificar permisos (admin puede aprobar todo, user solo lo suyo)
    if (user.role !== 'admin' && extraction.user_id !== user.userId) {
      return res.status(403).json({ error: 'No tienes permiso para aprobar esta extracción' });
    }

    const { notes } = req.body;

    // Marcar como aprobado
    await ExtractionResultDB.markAsCorrected(id, user.userId, notes);

    // Obtener extracción actualizada
    const updatedExtraction = await ExtractionResultDB.findById(id);

    console.log(`✅ Extracción ${id} aprobada por usuario ${user.userId}`);

    return res.status(200).json({
      success: true,
      message: 'Formulario aprobado correctamente',
      extraction: updatedExtraction
    });

  } catch (error: any) {
    console.error('Error al aprobar extracción:', error);
    return res.status(500).json({
      error: 'Error al aprobar extracción',
      message: error.message
    });
  }
}
