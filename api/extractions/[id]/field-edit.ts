/**
 * API ENDPOINT: POST /api/extractions/:id/field-edit
 * Persiste la edición directa de un campo y registra tracking
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const user = verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID de extracción requerido' });

  try {
    const { fieldName, originalValue, newValue } = req.body;
    if (!fieldName || newValue === undefined) {
      return res.status(400).json({ error: 'fieldName y newValue son requeridos' });
    }

    // 1. Obtener extracción actual
    const current = await sql`
      SELECT extracted_data FROM extraction_results WHERE id = ${id} LIMIT 1
    `;
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }

    // 2. Actualizar el campo en extracted_data
    const extractedData = current.rows[0].extracted_data;
    extractedData[fieldName] = newValue;

    await sql`
      UPDATE extraction_results
      SET extracted_data = ${JSON.stringify(extractedData)},
          has_corrections = TRUE,
          corrected_by_user_id = ${user.userId},
          corrected_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    // 3. Tracking: incrementar human_corrections
    await sql`
      INSERT INTO field_correction_stats (field_name, human_corrections, last_correction_at, updated_at)
      VALUES (${fieldName}, 1, NOW(), NOW())
      ON CONFLICT (field_name)
      DO UPDATE SET
        human_corrections = field_correction_stats.human_corrections + 1,
        last_correction_at = NOW(),
        updated_at = NOW()
    `;

    console.log(`✅ Campo "${fieldName}" editado por ${user.userId}: "${originalValue}" → "${newValue}"`);
    console.log(`📊 Tracking: corrección humana registrada para campo "${fieldName}"`);

    return res.status(200).json({
      success: true,
      fieldName,
      newValue
    });

  } catch (error: any) {
    console.error('Error al editar campo:', error);
    return res.status(500).json({ error: 'Error al guardar edición', message: error.message });
  }
}
