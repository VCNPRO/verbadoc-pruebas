/**
 * api/modules/assign.ts
 *
 * POST /api/modules/assign - Admin assigns a module to a user
 * DELETE /api/modules/assign - Admin revokes a module from a user
 *
 * Body: { userId: string, moduleId: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyRequestAuth, verifyAdmin } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigins = [
    'https://www.verbadocpro.eu',
    'https://verbadoc-europa-pro.vercel.app',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await verifyRequestAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const isAdmin = await verifyAdmin(auth);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Solo administradores pueden gestionar modulos' });
    }

    const { userId, moduleId } = req.body || {};

    if (!userId || !moduleId) {
      return res.status(400).json({ error: 'userId y moduleId son requeridos' });
    }

    if (req.method === 'POST') {
      // Assign module to user
      const result = await sql`
        INSERT INTO user_modules (user_id, module_id, active, granted_by)
        VALUES (${userId}, ${moduleId}, true, ${auth.userId})
        ON CONFLICT (user_id, module_id)
        DO UPDATE SET active = true, granted_by = ${auth.userId}, granted_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      return res.status(200).json({
        success: true,
        message: 'Modulo asignado correctamente',
        id: result.rows[0]?.id
      });
    }

    if (req.method === 'DELETE') {
      // Revoke module from user
      await sql`
        UPDATE user_modules
        SET active = false
        WHERE user_id = ${userId} AND module_id = ${moduleId}
      `;

      return res.status(200).json({
        success: true,
        message: 'Modulo revocado correctamente'
      });
    }

  } catch (error: any) {
    console.error('Error managing module assignment:', error);
    return res.status(500).json({ error: error.message });
  }
}
