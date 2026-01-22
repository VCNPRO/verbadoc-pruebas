/**
 * API ENDPOINT: DELETE /api/extractions/:id/delete
 * Eliminar un formulario
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ExtractionResultDB } from '../../lib/extractionDB.js';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// Helper: Verificar autenticación y obtener client_id
async function verifyAuth(req: VercelRequest): Promise<{ userId: string; role: string; email: string; clientId: number | null } | null> {
  try {
    const token = req.cookies['auth-token'];
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.id || decoded.userId;

    // Obtener client_id del usuario
    const userResult = await sql`SELECT client_id FROM users WHERE id = ${userId} LIMIT 1`;
    const clientId = userResult.rows[0]?.client_id || null;

    return {
      userId,
      role: decoded.role,
      email: decoded.email,
      clientId
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

  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de extracción requerido' });
  }

  // 🔥 COMPARTIR DATOS: Si tiene client_id, puede eliminar registros de usuarios del mismo cliente
  const useClientSharing = user.clientId !== null;
  const isAdmin = user.role === 'admin' || user.email === 'test@test.eu';

  try {
    const extraction = await ExtractionResultDB.findById(id);

    if (!extraction) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }

    // Verificar permisos:
    // 1. Admin puede eliminar cualquier cosa
    // 2. Usuario normal solo puede eliminar sus propios registros
    // 3. Usuario con client_id puede eliminar registros de usuarios del mismo cliente
    let canDelete = false;

    if (isAdmin) {
      canDelete = true;
    } else if (extraction.user_id === user.userId) {
      canDelete = true;
    } else if (useClientSharing && user.clientId) {
      // Verificar si el dueño del registro pertenece al mismo client_id
      const ownerResult = await sql`SELECT client_id FROM users WHERE id = ${extraction.user_id} LIMIT 1`;
      const ownerClientId = ownerResult.rows[0]?.client_id;
      if (ownerClientId === user.clientId) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta extracción' });
    }

    // Eliminar directamente sin restricción de user_id (ya verificamos permisos arriba)
    const result = await sql`
      DELETE FROM extraction_results WHERE id = ${id}
    `;
    const deleted = (result.rowCount ?? 0) > 0;

    if (!deleted) {
      return res.status(500).json({ error: 'No se pudo eliminar la extracción' });
    }

    console.log(`🗑️ Extracción ${id} eliminada por usuario ${user.userId} (admin: ${isAdmin}, clientSharing: ${useClientSharing})`);

    return res.status(200).json({
      success: true,
      message: 'Extracción eliminada correctamente'
    });

  } catch (error: any) {
    console.error('Error al eliminar extracción:', error);
    return res.status(500).json({
      error: 'Error al eliminar extracción',
      message: error.message
    });
  }
}
