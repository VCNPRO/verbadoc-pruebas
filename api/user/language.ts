import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth } from '../lib/auth.js';
import { sql } from '@vercel/postgres';

const SUPPORTED_LANGUAGES = ['es', 'ca', 'gl', 'eu', 'pt', 'fr', 'en', 'it', 'de'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authPayload = verifyRequestAuth(req);
    if (!authPayload) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { language } = req.body;
    if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Idioma no soportado' });
    }

    await sql`
      UPDATE users
      SET preferred_language = ${language}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${authPayload.userId}
    `;

    return res.status(200).json({ success: true, language });
  } catch (error) {
    console.error('Error updating language:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
