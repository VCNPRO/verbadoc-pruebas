/**
 * /api/column-mappings/[id]/activate
 *
 * POST: Activar configuración de mapeo (desactiva las demás)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// ============================================================================
// HELPER: Verificar autenticación
// ============================================================================

function verifyAuth(req: VercelRequest): { userId: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
      role: decoded.role,
    };
  } catch (error) {
    return null;
  }
}

// ============================================================================
// POST /api/column-mappings/[id]/activate
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID de mapeo requerido' });
    }

    // Verificar que el mapeo existe y pertenece al usuario
    const existing = await sql.query(
      `SELECT * FROM column_mappings WHERE id = $1 AND user_id = $2`,
      [id, user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Mapeo no encontrado' });
    }

    // Desactivar todos los mapeos del usuario
    await sql.query(
      `UPDATE column_mappings SET is_active = false WHERE user_id = $1`,
      [user.userId]
    );

    // Activar este mapeo
    const result = await sql.query(
      `
      UPDATE column_mappings
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      mapping: result.rows[0],
      message: 'Mapeo activado correctamente',
    });
  } catch (error: any) {
    console.error('Error al activar mapeo:', error);
    return res.status(500).json({
      error: 'Error al activar mapeo',
      message: error.message,
    });
  }
}
