/**
 * API ENDPOINT: /api/master-excel/:id
 * Operaciones sobre una fila específica del Excel master
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; email: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

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

  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID requerido' });
  }

  // GET /api/master-excel/:id - Obtener una fila específica
  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT * FROM master_excel_output
        WHERE id = ${id}
          AND user_id = ${user.userId}
          AND is_latest = true
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fila no encontrada' });
      }

      return res.status(200).json({
        row: result.rows[0]
      });

    } catch (error: any) {
      console.error('Error al obtener fila:', error);
      return res.status(500).json({
        error: 'Error al obtener fila',
        message: error.message
      });
    }
  }

  // PATCH /api/master-excel/:id - Actualizar fila (crea nueva versión)
  if (req.method === 'PATCH') {
    try {
      const { row_data, validation_status } = req.body;

      if (!row_data) {
        return res.status(400).json({
          error: 'row_data es requerido'
        });
      }

      // Verificar que la fila existe y pertenece al usuario
      const existingRow = await sql`
        SELECT * FROM master_excel_output
        WHERE id = ${id}
          AND user_id = ${user.userId}
          AND is_latest = true
      `;

      if (existingRow.rows.length === 0) {
        return res.status(404).json({
          error: 'Fila no encontrada o no tienes permiso'
        });
      }

      // Actualizar usando la función SQL (crea nueva versión)
      const result = await sql`
        SELECT update_master_excel_row(
          ${id}::UUID,
          ${JSON.stringify(row_data)}::JSONB,
          ${validation_status || null}
        ) as new_id
      `;

      const newId = result.rows[0].new_id;

      // Obtener la nueva versión
      const updatedRow = await sql`
        SELECT * FROM master_excel_output WHERE id = ${newId}
      `;

      console.log('✅ Fila actualizada (nueva versión):', newId);

      return res.status(200).json({
        success: true,
        id: newId,
        row: updatedRow.rows[0],
        message: 'Fila actualizada - nueva versión creada'
      });

    } catch (error: any) {
      console.error('Error al actualizar fila:', error);
      return res.status(500).json({
        error: 'Error al actualizar fila',
        message: error.message
      });
    }
  }

  // DELETE /api/master-excel/:id - Eliminar fila
  if (req.method === 'DELETE') {
    try {
      // Verificar que la fila existe y pertenece al usuario
      const existingRow = await sql`
        SELECT * FROM master_excel_output
        WHERE id = ${id}
          AND user_id = ${user.userId}
          AND is_latest = true
      `;

      if (existingRow.rows.length === 0) {
        return res.status(404).json({
          error: 'Fila no encontrada o no tienes permiso'
        });
      }

      // Eliminar fila (marcada como obsoleta, no se borra físicamente)
      await sql`
        UPDATE master_excel_output
        SET is_latest = false
        WHERE id = ${id}
      `;

      console.log('✅ Fila eliminada (marcada como obsoleta):', id);

      return res.status(200).json({
        success: true,
        message: 'Fila eliminada correctamente'
      });

    } catch (error: any) {
      console.error('Error al eliminar fila:', error);
      return res.status(500).json({
        error: 'Error al eliminar fila',
        message: error.message
      });
    }
  }

  // Método no permitido
  return res.status(405).json({ error: 'Método no permitido' });
}
