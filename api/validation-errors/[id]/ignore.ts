/**
 * API ENDPOINT: POST /api/validation-errors/:id/ignore
 * Ignorar un error de validación (marcarlo como no crítico)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ValidationErrorDB } from '../../lib/extractionDB.js';
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
    return res.status(400).json({ error: 'ID de error requerido' });
  }

  try {
    const { notes } = req.body;

    // Marcar error como ignorado
    const ignored = await ValidationErrorDB.markAsIgnored(
      id,
      user.userId,
      notes || 'Error ignorado por el usuario'
    );

    if (!ignored) {
      return res.status(500).json({ error: 'No se pudo marcar el error como ignorado' });
    }

    console.log(`⚠️ Error ${id} ignorado por usuario ${user.userId}`);

    return res.status(200).json({
      success: true,
      message: 'Error ignorado correctamente'
    });

  } catch (error: any) {
    console.error('Error al ignorar error de validación:', error);
    return res.status(500).json({
      error: 'Error al ignorar error de validación',
      message: error.message
    });
  }
}
