/**
 * API ENDPOINT: /api/rag/folders
 * GET  - Listar carpetas del usuario (con conteo de documentos)
 * POST - Crear carpeta nueva
 * DELETE - Eliminar carpeta (query param ?id=...)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyRequestAuth } from '../lib/auth.js';

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

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth
  const auth = verifyRequestAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const userId = auth.userId;

  try {
    // GET - Listar carpetas con conteo de documentos
    if (req.method === 'GET') {
      const result = await sql`
        SELECT
          f.id,
          f.name,
          f.created_at,
          COUNT(er.id)::int AS document_count
        FROM rag_folders f
        LEFT JOIN extraction_results er ON er.folder_id = f.id
        WHERE f.user_id = ${userId}::uuid
        GROUP BY f.id, f.name, f.created_at
        ORDER BY f.name ASC
      `;

      return res.status(200).json({
        success: true,
        folders: result.rows
      });
    }

    // POST - Crear carpeta
    if (req.method === 'POST') {
      const { name } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'El nombre de la carpeta es obligatorio' });
      }

      const trimmedName = name.trim();

      if (trimmedName.length > 255) {
        return res.status(400).json({ error: 'El nombre no puede superar 255 caracteres' });
      }

      // Intentar crear (UNIQUE constraint previene duplicados)
      try {
        const result = await sql`
          INSERT INTO rag_folders (user_id, name)
          VALUES (${userId}::uuid, ${trimmedName})
          RETURNING id, name, created_at
        `;

        return res.status(201).json({
          success: true,
          folder: { ...result.rows[0], document_count: 0 }
        });
      } catch (err: any) {
        // Duplicado
        if (err.code === '23505') {
          return res.status(409).json({ error: 'Ya existe una carpeta con ese nombre' });
        }
        throw err;
      }
    }

    // DELETE - Eliminar carpeta
    if (req.method === 'DELETE') {
      const folderId = req.query.id as string;

      if (!folderId) {
        return res.status(400).json({ error: 'Se requiere el ID de la carpeta' });
      }

      // Quitar folder_id de los documentos asociados antes de eliminar
      await sql`
        UPDATE extraction_results
        SET folder_id = NULL
        WHERE folder_id = ${folderId}::uuid
      `;

      const result = await sql`
        DELETE FROM rag_folders
        WHERE id = ${folderId}::uuid AND user_id = ${userId}::uuid
      `;

      if ((result.rowCount ?? 0) === 0) {
        return res.status(404).json({ error: 'Carpeta no encontrada' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error: any) {
    console.error('Error en /api/rag/folders:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
}
