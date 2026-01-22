/**
 * API ENDPOINT: GET /api/admin/logs
 * Ver logs de actividad (solo admin)
 *
 * Fecha: 15 Enero 2026
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// Helper: Verificar autenticación admin
function verifyAdmin(req: VercelRequest): { userId: string; email: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.role !== 'admin') return null;

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

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar admin
  const user = verifyAdmin(req);
  if (!user) {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
  }

  try {
    const {
      limit = '100',
      offset = '0',
      action,
      user_email,
      date_from,
      date_to
    } = req.query;

    // Construir query con filtros
    let query = `
      SELECT
        id,
        user_id,
        user_email,
        user_role,
        action,
        resource_type,
        resource_id,
        ip_address,
        user_agent,
        success,
        error_message,
        metadata,
        created_at
      FROM access_logs
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (action && typeof action === 'string') {
      query += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (user_email && typeof user_email === 'string') {
      query += ` AND user_email ILIKE $${paramIndex}`;
      params.push(`%${user_email}%`);
      paramIndex++;
    }

    if (date_from && typeof date_from === 'string') {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to && typeof date_to === 'string') {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    // Ejecutar query
    const result = await sql.query(query, params);

    // Obtener total para paginación
    let countQuery = `SELECT COUNT(*) as total FROM access_logs WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (action && typeof action === 'string') {
      countQuery += ` AND action = $${countParamIndex}`;
      countParams.push(action);
      countParamIndex++;
    }

    if (user_email && typeof user_email === 'string') {
      countQuery += ` AND user_email ILIKE $${countParamIndex}`;
      countParams.push(`%${user_email}%`);
      countParamIndex++;
    }

    if (date_from && typeof date_from === 'string') {
      countQuery += ` AND created_at >= $${countParamIndex}`;
      countParams.push(date_from);
      countParamIndex++;
    }

    if (date_to && typeof date_to === 'string') {
      countQuery += ` AND created_at <= $${countParamIndex}`;
      countParams.push(date_to);
      countParamIndex++;
    }

    const countResult = await sql.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Obtener estadísticas rápidas
    const statsResult = await sql`
      SELECT
        action,
        COUNT(*) as count
      FROM access_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY action
      ORDER BY count DESC
    `;

    return res.status(200).json({
      success: true,
      logs: result.rows,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      stats: {
        last24h: statsResult.rows
      }
    });

  } catch (error: any) {
    console.error('Error al obtener logs:', error);
    return res.status(500).json({
      error: 'Error al obtener logs',
      message: error.message
    });
  }
}
