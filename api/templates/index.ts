// verbadoc-pruebas/api/templates/index.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

async function verifyAuth(req: VercelRequest): Promise<{ userId: string; role: string; clientId: number | null } | null> {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.id || decoded.userId;
    const userResult = await sql`SELECT client_id FROM users WHERE id = ${userId} LIMIT 1`;
    const clientId = userResult.rows[0]?.client_id || null;
    return { userId, role: decoded.role, clientId };
  } catch (error) {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });

  // GET /api/templates - Listar todas las plantillas
  if (req.method === 'GET') {
    try {
      const templates = await sql`
        SELECT id, name, description, regions, created_at, updated_at
        FROM form_templates
        WHERE user_id = ${user.userId} OR (client_id IS NOT NULL AND client_id = ${user.clientId})
        ORDER BY created_at DESC
      `;
      return res.status(200).json(templates.rows);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener plantillas', message: error.message });
    }
  }

  // POST /api/templates - Crear una nueva plantilla
  if (req.method === 'POST') {
    try {
      const { name, description, regions } = req.body;
      if (!name || !regions || !Array.isArray(regions)) {
        return res.status(400).json({ error: 'Faltan campos requeridos: name, regions' });
      }
      const result = await sql`
        INSERT INTO form_templates (user_id, client_id, name, description, regions)
        VALUES (${user.userId}, ${user.clientId}, ${name}, ${description || null}, ${JSON.stringify(regions)}::jsonb)
        RETURNING *
      `;
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al crear la plantilla', message: error.message });
    }
  }
  
  // DELETE /api/templates - Eliminar una plantilla
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Se requiere el ID de la plantilla' });
      }
      const deleteResult = await sql`
        DELETE FROM form_templates
        WHERE id = ${id}
          AND (user_id = ${user.userId} OR 'admin' = ${user.role})
      `;
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: 'Plantilla no encontrada o sin permisos para eliminar' });
      }
      return res.status(204).end();
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al eliminar la plantilla', message: error.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
