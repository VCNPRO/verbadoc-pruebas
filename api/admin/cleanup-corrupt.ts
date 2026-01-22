/**
 * SCRIPT TEMPORAL: Eliminar documento corrupto
 * Ejecutar una sola vez: GET /api/admin/cleanup-corrupt
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
  } catch (error) {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = verifyAuth(req);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' });
  }

  try {
    const corruptId = '96ae62a5-9f1c-4ebd-8e6a-f9bdd65d1ed2';

    // Eliminar errores de validación
    await sql`
      DELETE FROM validation_errors
      WHERE extraction_id = ${corruptId}
    `;

    // Eliminar extracción
    const result = await sql`
      DELETE FROM extraction_results
      WHERE id = ${corruptId}
    `;

    return res.status(200).json({
      success: true,
      message: 'Documento corrupto eliminado',
      id: corruptId,
      deleted: result.rowCount
    });

  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
