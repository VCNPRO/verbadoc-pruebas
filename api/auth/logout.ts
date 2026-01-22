import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth } from '../lib/auth.js';
import { AccessLogDB } from '../lib/access-log.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Try to get user info before clearing cookie (for logging)
  const authPayload = verifyRequestAuth(req);
  if (authPayload) {
    // Log logout
    await AccessLogDB.logFromRequest({
      req,
      userId: authPayload.userId,
      action: 'logout',
      success: true,
    });
  }

  // Limpiar cookie de autenticación
  res.setHeader('Set-Cookie', 'auth-token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');

  console.log('✅ Logout exitoso');
  return res.status(200).json({ success: true });
}