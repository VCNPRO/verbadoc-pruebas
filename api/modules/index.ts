/**
 * api/modules/index.ts
 *
 * GET /api/modules - List modules
 *   Admin: all modules + assignment info
 *   User: only assigned modules
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyRequestAuth } from '../lib/auth';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await verifyRequestAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Get user role
    const userResult = await sql`SELECT role FROM users WHERE id = ${auth.userId}`;
    const userRole = userResult.rows[0]?.role;

    if (userRole === 'admin') {
      // Admin sees all modules with user counts
      const modules = await sql`
        SELECT
          sm.*,
          COUNT(um.id) FILTER (WHERE um.active = true) as active_users
        FROM service_modules sm
        LEFT JOIN user_modules um ON sm.id = um.module_id
        GROUP BY sm.id
        ORDER BY sm.name
      `;
      return res.status(200).json({ modules: modules.rows });
    }

    // Regular user: only their assigned active modules
    const modules = await sql`
      SELECT
        sm.id, sm.name, sm.description, sm.monthly_price,
        um.active, um.granted_at, um.expires_at
      FROM user_modules um
      JOIN service_modules sm ON um.module_id = sm.id
      WHERE um.user_id = ${auth.userId}
        AND um.active = true
        AND sm.is_active = true
        AND (um.expires_at IS NULL OR um.expires_at > CURRENT_TIMESTAMP)
      ORDER BY sm.name
    `;

    return res.status(200).json({ modules: modules.rows });

  } catch (error: any) {
    console.error('Error fetching modules:', error);
    return res.status(500).json({ error: error.message });
  }
}
