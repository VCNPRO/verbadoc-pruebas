/**
 * /api/column-mappings/[id]
 *
 * GET: Obtener configuración específica
 * PATCH: Actualizar configuración
 * DELETE: Eliminar configuración
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
// GET /api/column-mappings/[id]
// ============================================================================

async function handleGet(req: VercelRequest, res: VercelResponse, mappingId: string) {
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const result = await sql.query(
      `
      SELECT * FROM column_mappings
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
      `,
      [mappingId, user.userId, user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapeo no encontrado' });
    }

    return res.status(200).json({
      success: true,
      mapping: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error al obtener mapeo:', error);
    return res.status(500).json({
      error: 'Error al obtener mapeo',
      message: error.message,
    });
  }
}

// ============================================================================
// PATCH /api/column-mappings/[id]
// ============================================================================

async function handlePatch(req: VercelRequest, res: VercelResponse, mappingId: string) {
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const { mapping_name, description, mappings, is_active } = req.body;

    // Verificar que el mapeo existe y pertenece al usuario
    const existing = await sql.query(
      `SELECT * FROM column_mappings WHERE id = $1 AND user_id = $2`,
      [mappingId, user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Mapeo no encontrado' });
    }

    // Si se activa este mapeo, desactivar todos los demás
    if (is_active === true) {
      await sql.query(
        `UPDATE column_mappings SET is_active = false WHERE user_id = $1 AND id != $2`,
        [user.userId, mappingId]
      );
    }

    // Construir query de actualización dinámica
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (mapping_name !== undefined) {
      updates.push(`mapping_name = $${paramIndex++}`);
      values.push(mapping_name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (mappings !== undefined) {
      updates.push(`mappings = $${paramIndex++}`);
      values.push(JSON.stringify(mappings));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updates.push(`updated_at = NOW()`);

    values.push(mappingId);
    const result = await sql.query(
      `
      UPDATE column_mappings
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
      `,
      values
    );

    return res.status(200).json({
      success: true,
      mapping: result.rows[0],
      message: 'Mapeo actualizado correctamente',
    });
  } catch (error: any) {
    console.error('Error al actualizar mapeo:', error);
    return res.status(500).json({
      error: 'Error al actualizar mapeo',
      message: error.message,
    });
  }
}

// ============================================================================
// DELETE /api/column-mappings/[id]
// ============================================================================

async function handleDelete(req: VercelRequest, res: VercelResponse, mappingId: string) {
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const result = await sql.query(
      `DELETE FROM column_mappings WHERE id = $1 AND user_id = $2 RETURNING id`,
      [mappingId, user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapeo no encontrado' });
    }

    return res.status(200).json({
      success: true,
      message: 'Mapeo eliminado correctamente',
    });
  } catch (error: any) {
    console.error('Error al eliminar mapeo:', error);
    return res.status(500).json({
      error: 'Error al eliminar mapeo',
      message: error.message,
    });
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extraer ID del mapeo
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de mapeo requerido' });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, id);
  }

  if (req.method === 'PATCH') {
    return handlePatch(req, res, id);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res, id);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
