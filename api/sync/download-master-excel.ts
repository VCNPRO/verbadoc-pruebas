/**
 * API ENDPOINT: /api/sync/download-master-excel
 * Descarga datos del Excel Master para sincronizacion local
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

function verifyAuth(req: VercelRequest): { userId: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return { userId: decoded.id || decoded.userId };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://www.verbadocpro.eu', 'https://verbadoc-europa-pro.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' });

  const user = verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });

  try {
    const { since } = req.query;

    let result;
    if (since && typeof since === 'string') {
      result = await sql`
        SELECT row_number, row_data, filename, validation_status, created_at, updated_at
        FROM master_excel_output
        WHERE is_latest = true AND updated_at > ${since}
        ORDER BY row_number ASC
      `;
    } else {
      result = await sql`
        SELECT row_number, row_data, filename, validation_status, created_at, updated_at
        FROM master_excel_output
        WHERE is_latest = true
        ORDER BY row_number ASC
      `;
    }

    if (result.rows.length === 0) {
      return res.status(200).json({
        message: 'No hay datos nuevos para sincronizar',
        rows: 0,
        lastSync: new Date().toISOString()
      });
    }

    return res.status(200).json({
      rows: result.rows,
      total: result.rows.length,
      lastSync: new Date().toISOString()
    });

  } catch (error: any) {
    // Tabla puede no existir - devolver vacio
    return res.status(200).json({
      message: 'No hay datos nuevos para sincronizar',
      rows: 0,
      lastSync: new Date().toISOString()
    });
  }
}
