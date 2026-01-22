import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => { const [k,v] = c.trim().split('='); acc[k]=v; return acc; }, {} as any);
    const token = cookies['auth-token'];
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    // Verify token
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (!payload) return res.status(401).json({ error: 'Token inválido' });

    // Get user from DB
    const result = await sql`SELECT id, email, password, name, role, client_id, created_at, updated_at FROM users WHERE id = ${payload.userId} LIMIT 1`;
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.status(200).json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: user.name,
        role: user.role,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
