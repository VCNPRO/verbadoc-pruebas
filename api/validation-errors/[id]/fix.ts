/**
 * API ENDPOINT: POST /api/validation-errors/:id/fix
 * Corregir un error de validación específico
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ValidationErrorDB, ExtractionResultDB } from '../../lib/extractionDB.js';
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
    const { correctedValue, notes } = req.body;

    if (correctedValue === undefined) {
      return res.status(400).json({ error: 'Debes proporcionar un valor corregido' });
    }

    // Marcar error como resuelto
    const fixed = await ValidationErrorDB.markAsFixed(
      id,
      user.userId,
      correctedValue,
      notes
    );

    if (!fixed) {
      return res.status(500).json({ error: 'No se pudo marcar el error como corregido' });
    }

    console.log(`✅ Error ${id} corregido por usuario ${user.userId}: ${correctedValue}`);

    return res.status(200).json({
      success: true,
      message: 'Error corregido correctamente',
      correctedValue
    });

  } catch (error: any) {
    console.error('Error al corregir error de validación:', error);
    return res.status(500).json({
      error: 'Error al corregir error de validación',
      message: error.message
    });
  }
}
