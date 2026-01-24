/**
 * API ENDPOINT: /api/unprocessable
 * Gestión de documentos no procesables
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import { AccessLogDB } from '../lib/access-log.js';

// Helper: Verificar autenticación y obtener client_id
async function verifyAuth(req: VercelRequest): Promise<{ userId: string; role: string; clientId: number | null } | null> {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.id || decoded.userId;

    // Obtener client_id del usuario para compartir datos entre usuarios del mismo cliente
    const userResult = await sql`SELECT client_id FROM users WHERE id = ${userId} LIMIT 1`;
    const clientId = userResult.rows[0]?.client_id || null;

    return {
      userId,
      role: decoded.role,
      clientId
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

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar autenticación
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // GET /api/unprocessable - Listar documentos no procesables
  if (req.method === 'GET') {
    try {
      const { limit = '100', category, search } = req.query;

      // COMPARTIR DATOS: Si tiene client_id, mostrar datos de todos los usuarios del mismo cliente
      const useClientSharing = user.clientId !== null;
      console.log('📋 GET /api/unprocessable - userId:', user.userId, '| clientId:', user.clientId, '| compartiendo:', useClientSharing);

      // Construir query con filtros
      let query: string;
      let params: any[];
      let paramIndex: number;

      if (useClientSharing && user.clientId) {
        // Query con JOIN para compartir por client_id
        query = `
          SELECT
            u.id,
            u.filename,
            u.rejection_category,
            u.rejection_reason,
            u.numero_expediente,
            u.numero_accion,
            u.numero_grupo,
            u.extracted_data,
            u.retry_count,
            u.max_retries,
            u.can_retry,
            u.created_at,
            u.updated_at,
            u.reviewed_at
          FROM unprocessable_documents u
          JOIN users usr ON u.user_id = usr.id
          WHERE usr.client_id = $1
        `;
        params = [user.clientId];
        paramIndex = 2;
      } else {
        // Query original solo por user_id
        query = `
          SELECT
            id,
            filename,
            rejection_category,
            rejection_reason,
            numero_expediente,
            numero_accion,
            numero_grupo,
            extracted_data,
            retry_count,
            max_retries,
            can_retry,
            created_at,
            updated_at,
            reviewed_at
          FROM unprocessable_documents
          WHERE user_id = $1
        `;
        params = [user.userId];
        paramIndex = 2;
      }

      // Filtro por categoría
      if (category && category !== 'all') {
        query += ` AND rejection_category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Búsqueda en filename o campos
      if (search && typeof search === 'string' && search.trim() !== '') {
        query += ` AND (
          filename ILIKE $${paramIndex}
          OR numero_expediente ILIKE $${paramIndex}
          OR numero_accion ILIKE $${paramIndex}
          OR numero_grupo ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
      params.push(parseInt(limit as string));

      const result = await sql.query(query, params);

      // Obtener estadísticas (compartidas por client_id si aplica)
      let stats;
      if (useClientSharing && user.clientId) {
        stats = await sql`
          SELECT
            u.rejection_category,
            COUNT(*) as count
          FROM unprocessable_documents u
          JOIN users usr ON u.user_id = usr.id
          WHERE usr.client_id = ${user.clientId}
          GROUP BY u.rejection_category
        `;
      } else {
        stats = await sql`
          SELECT
            rejection_category,
            COUNT(*) as count
          FROM unprocessable_documents
          WHERE user_id = ${user.userId}
          GROUP BY rejection_category
        `;
      }

      console.log('✅ Documentos no procesables encontrados:', result.rows.length);

      // Log access to unprocessable page
      await AccessLogDB.logFromRequest({
        req,
        userId: user.userId,
        action: 'view_unprocessable',
        success: true,
        metadata: {
          count: result.rows.length,
          category: category || 'all',
          search: search || null,
        },
      });

      return res.status(200).json({
        documents: result.rows,
        stats: stats.rows,
        total: result.rows.length
      });

    } catch (error: any) {
      console.error('❌ Error al obtener no procesables:', error);
      return res.status(500).json({
        error: 'Error al obtener documentos no procesables',
        message: error.message
      });
    }
  }

  // POST /api/unprocessable - Registrar documento no procesable manualmente
  if (req.method === 'POST') {
    try {
      const {
        filename,
        category,
        reason,
        extractedData,
        numero_expediente,
        numero_accion,
        numero_grupo,
        file_hash,
        batch_id
      } = req.body;

      if (!filename || !category || !reason) {
        return res.status(400).json({
          error: 'Faltan campos requeridos: filename, category, reason'
        });
      }

      const result = await sql`
        SELECT add_unprocessable_document(
          ${user.userId}::UUID,
          ${filename}::VARCHAR,
          ${category}::VARCHAR,
          ${reason}::TEXT,
          ${extractedData ? JSON.stringify(extractedData) : null}::JSONB,
          ${numero_expediente || null},
          ${numero_accion || null},
          ${numero_grupo || null},
          ${file_hash || null},
          ${batch_id || null}
        ) as new_id
      `;

      const newId = result.rows[0].new_id;

      console.log('✅ Documento no procesable registrado:', newId);

      return res.status(201).json({
        success: true,
        id: newId,
        message: 'Documento registrado como no procesable'
      });

    } catch (error: any) {
      console.error('❌ Error al registrar no procesable:', error);
      return res.status(500).json({
        error: 'Error al registrar documento no procesable',
        message: error.message
      });
    }
  }

  // PATCH /api/unprocessable - Enviar documento a revisión
  if (req.method === 'PATCH') {
    try {
      const { id, action } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID requerido' });
      }

      if (action !== 'send_to_review') {
        return res.status(400).json({ error: 'Acción no válida. Usar: send_to_review' });
      }

      // Verificar que el documento existe y pertenece al usuario
      const doc = await sql`
        SELECT * FROM unprocessable_documents
        WHERE id = ${id} AND user_id = ${user.userId}
      `;

      if (doc.rows.length === 0) {
        return res.status(404).json({
          error: 'Documento no encontrado o no tienes permiso'
        });
      }

      const unprocessable = doc.rows[0];

      // Insertar en extraction_results con estado needs_review
      // IMPORTANTE: Copiar pdf_blob_url para que el visor PDF funcione
      const insertResult = await sql`
        INSERT INTO extraction_results (
          user_id,
          filename,
          extracted_data,
          validation_status,
          model_used,
          page_count,
          has_corrections,
          rejection_reason,
          file_type,
          file_size_bytes,
          pdf_blob_url,
          created_at
        ) VALUES (
          ${user.userId},
          ${unprocessable.filename},
          ${unprocessable.extracted_data || '{}'},
          'needs_review',
          'manual_transfer',
          1,
          false,
          ${unprocessable.rejection_reason || 'Enviado desde No Procesables para revisión'},
          ${unprocessable.file_type || 'application/pdf'},
          ${unprocessable.file_size_bytes || null},
          ${unprocessable.pdf_blob_url || null},
          NOW()
        )
        RETURNING id
      `;

      const newExtractionId = insertResult.rows[0].id;

      // Eliminar de unprocessable_documents
      await sql`
        DELETE FROM unprocessable_documents
        WHERE id = ${id}
      `;

      console.log('✅ Documento enviado a revisión:', id, '-> nuevo ID:', newExtractionId);

      // Log access
      await AccessLogDB.logFromRequest({
        req,
        userId: user.userId,
        action: 'send_to_review',
        success: true,
        metadata: {
          unprocessable_id: id,
          new_extraction_id: newExtractionId,
          filename: unprocessable.filename
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Documento enviado a revisión correctamente',
        newExtractionId
      });

    } catch (error: any) {
      console.error('❌ Error al enviar a revisión:', error);
      return res.status(500).json({
        error: 'Error al enviar documento a revisión',
        message: error.message
      });
    }
  }

  // DELETE /api/unprocessable/:id - Eliminar documento no procesable
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID requerido' });
      }

      // Verificar permisos: usuario propio O mismo client_id
      const useClientSharing = user.clientId !== null;
      let check;

      if (useClientSharing && user.clientId) {
        // Verificar que pertenece al mismo cliente
        check = await sql`
          SELECT u.id FROM unprocessable_documents u
          JOIN users usr ON u.user_id = usr.id
          WHERE u.id = ${id} AND usr.client_id = ${user.clientId}
        `;
      } else {
        // Verificar que pertenece al usuario
        check = await sql`
          SELECT id FROM unprocessable_documents
          WHERE id = ${id} AND user_id = ${user.userId}
        `;
      }

      if (check.rows.length === 0) {
        return res.status(404).json({
          error: 'Documento no encontrado o no tienes permiso'
        });
      }

      // Eliminar
      await sql`
        DELETE FROM unprocessable_documents
        WHERE id = ${id}
      `;

      console.log('✅ Documento no procesable eliminado:', id, useClientSharing ? '(client_id sharing)' : '');

      return res.status(200).json({
        success: true,
        message: 'Documento eliminado correctamente'
      });

    } catch (error: any) {
      console.error('❌ Error al eliminar no procesable:', error);
      return res.status(500).json({
        error: 'Error al eliminar documento',
        message: error.message
      });
    }
  }

  // Método no permitido
  return res.status(405).json({ error: 'Método no permitido' });
}