/**
 * API ENDPOINT: GET /api/field-stats
 * Devuelve estadísticas de correcciones humanas por campo
 * Solo lectura - no modifica nada
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

function verifyAuth(req: VercelRequest): { userId: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return { userId: decoded.id || decoded.userId, role: decoded.role };
  } catch { return null; }
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const user = verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });

  try {
    const result = await sql`
      SELECT
        field_name,
        total_extractions,
        human_corrections,
        last_correction_at,
        CASE
          WHEN total_extractions > 0
          THEN ROUND(human_corrections::numeric / total_extractions::numeric, 4)
          ELSE 0
        END as error_rate
      FROM field_correction_stats
      WHERE total_extractions > 0
      ORDER BY error_rate DESC, human_corrections DESC
    `;

    const ATTENTION_THRESHOLD = 0.08;

    const fields = result.rows.map(row => ({
      fieldName: row.field_name,
      totalExtractions: parseInt(row.total_extractions),
      humanCorrections: parseInt(row.human_corrections),
      errorRate: parseFloat(row.error_rate),
      lastCorrectionAt: row.last_correction_at,
      needsAttention: parseFloat(row.error_rate) > ATTENTION_THRESHOLD
    }));

    const attentionFields = fields
      .filter(f => f.needsAttention)
      .map(f => f.fieldName);

    return res.status(200).json({
      fields,
      attentionFields,
      totalFieldsTracked: fields.length,
      totalCorrections: fields.reduce((sum, f) => sum + f.humanCorrections, 0),
      attentionThreshold: ATTENTION_THRESHOLD
    });

  } catch (error: any) {
    console.error('Error al obtener field stats:', error);
    return res.status(500).json({ error: 'Error al obtener estadísticas', message: error.message });
  }
}
