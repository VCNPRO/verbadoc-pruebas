/**
 * /api/column-mappings
 *
 * GET: Listar configuraciones de mapeo del usuario
 * POST: Crear nueva configuración de mapeo
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
// GET /api/column-mappings
// ============================================================================

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const { activeOnly = 'false' } = req.query;

    // Construir query
    let query = `
      SELECT
        id,
        mapping_name,
        description,
        mappings,
        is_active,
        is_default,
        created_at,
        updated_at
      FROM column_mappings
      WHERE user_id = $1
    `;

    if (activeOnly === 'true') {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await sql.query(query, [user.userId]);

    return res.status(200).json({
      success: true,
      mappings: result.rows,
      total: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error al listar mapeos:', error);
    return res.status(500).json({
      error: 'Error al listar mapeos',
      message: error.message,
    });
  }
}

// ============================================================================
// POST /api/column-mappings
// ============================================================================

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const { mapping_name, description, mappings, is_active = true } = req.body;

    // Validar campos requeridos
    if (!mapping_name || !mappings) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: mapping_name, mappings',
      });
    }

    // Validar estructura de mappings
    if (!Array.isArray(mappings)) {
      return res.status(400).json({
        error: 'mappings debe ser un array',
      });
    }

    // Validar cada mapeo
    for (const mapping of mappings) {
      if (!mapping.fundaeField || !mapping.excelColumn || !mapping.excelColumnName) {
        return res.status(400).json({
          error: 'Cada mapeo debe tener fundaeField, excelColumn y excelColumnName',
        });
      }
    }

    // Si se activa este mapeo, desactivar todos los demás del usuario
    if (is_active) {
      await sql.query(
        `UPDATE column_mappings SET is_active = false WHERE user_id = $1`,
        [user.userId]
      );
    }

    // Insertar nuevo mapeo
    const result = await sql.query(
      `
      INSERT INTO column_mappings (
        user_id,
        mapping_name,
        description,
        mappings,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        user.userId,
        mapping_name,
        description || null,
        JSON.stringify(mappings),
        is_active,
      ]
    );

    return res.status(201).json({
      success: true,
      mapping: result.rows[0],
      message: `Mapeo "${mapping_name}" creado correctamente`,
    });
  } catch (error: any) {
    console.error('Error al crear mapeo:', error);
    return res.status(500).json({
      error: 'Error al crear mapeo',
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
