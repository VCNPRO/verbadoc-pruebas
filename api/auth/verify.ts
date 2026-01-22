import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth } from '../lib/auth.js';
import { UserDB } from '../lib/db.js';

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
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const authPayload = verifyRequestAuth(req);

    if (!authPayload) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Optional: Fetch user from DB to ensure they still exist and have fresh data
    const user = await UserDB.findById(authPayload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Return non-sensitive user info
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
      },
    });

  } catch (error: any) {
    console.error('Error en verificación de token:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
