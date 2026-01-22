/**
 * API ENDPOINT: /api/master-excel
 * Gestionar el Excel master de salida (todas las filas procesadas)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// ⚠️ MODO BYPASS TEMPORAL
const BYPASS_AUTH = true;
const BYPASS_USER = { userId: '3360dfa5-mock-test', email: 'test@test.eu', role: 'admin', clientId: null };

// Helper: Verificar autenticación y obtener client_id
async function verifyAuth(req: VercelRequest): Promise<{ userId: string; email: string; role: string; clientId: number | null } | null> {
  if (BYPASS_AUTH) return BYPASS_USER;

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
      email: decoded.email,
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

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar autenticación
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // 🔥 COMPARTIR DATOS: Si tiene client_id, mostrar datos de todos los usuarios del mismo cliente
  const useClientSharing = user.clientId !== null;
  console.log('👤 Usuario:', user.email, '| clientId:', user.clientId, '| compartiendo:', useClientSharing);

  // DELETE /api/master-excel - Eliminar una selección o todos los registros
  if (req.method === 'DELETE') {
    try {
      const { ids, deleteAll } = req.body;

      if (deleteAll === true) {
        // Eliminar TODOS los registros
        // 🔥 COMPARTIR DATOS: Si tiene client_id, eliminar de todos los usuarios del mismo cliente
        let result;
        if (useClientSharing && user.clientId) {
          result = await sql`
            DELETE FROM master_excel_output
            WHERE user_id IN (
              SELECT id FROM users WHERE client_id = ${user.clientId}
            )
          `;
          console.log(`🗑️ Eliminados todos los registros (${result.rowCount}) para client_id:`, user.clientId);
        } else {
          result = await sql`
            DELETE FROM master_excel_output
            WHERE user_id = ${user.userId}
          `;
          console.log(`🗑️ Eliminados todos los registros (${result.rowCount}) para el usuario:`, user.userId);
        }

        return res.status(200).json({
          success: true,
          message: `Se han eliminado todos los registros (${result.rowCount})`,
          count: result.rowCount
        });
      }

      if (Array.isArray(ids) && ids.length > 0) {
        // Eliminar selección de IDs
        // 🔥 COMPARTIR DATOS: Si tiene client_id, permitir eliminar registros de usuarios del mismo cliente
        let result;
        if (useClientSharing && user.clientId) {
          result = await sql.query(
            `DELETE FROM master_excel_output
             WHERE id = ANY($1)
             AND user_id IN (SELECT id FROM users WHERE client_id = $2)`,
            [ids, user.clientId]
          );
          console.log(`🗑️ Eliminados ${result.rowCount} registros para client_id:`, user.clientId);
        } else {
          result = await sql.query(
            'DELETE FROM master_excel_output WHERE id = ANY($1) AND user_id = $2',
            [ids, user.userId]
          );
          console.log(`🗑️ Eliminados ${result.rowCount} registros para el usuario:`, user.userId);
        }

        return res.status(200).json({
          success: true,
          message: `Se han eliminado ${result.rowCount} registros`,
          count: result.rowCount
        });
      }

      return res.status(400).json({
        error: 'Debes proporcionar una lista de IDs o marcar deleteAll=true'
      });

    } catch (error: any) {
      console.error('Error al eliminar registros del Excel master:', error);
      return res.status(500).json({
        error: 'Error al eliminar registros',
        message: error.message
      });
    }
  }

  // GET /api/master-excel - Listar todas las filas del Excel master (compartidas por client_id)
  if (req.method === 'GET') {
    try {
      const { limit = '1000', status, search } = req.query;

      // Construir query base
      // IMPORTANTE: Excluir registros con validation_status = 'needs_review'
      // 🔥 COMPARTIR DATOS: Si tiene client_id, mostrar datos de todos los usuarios del mismo cliente
      let query: string;
      let params: any[];
      let paramIndex: number;

      if (useClientSharing && user.clientId) {
        // Query con JOIN para compartir por client_id
        query = `
          SELECT
            m.id,
            m.extraction_id,
            m.row_data,
            m.row_number,
            m.filename,
            m.validation_status,
            m.cross_validation_match,
            m.discrepancy_count,
            m.version,
            m.created_at,
            m.updated_at
          FROM master_excel_output m
          JOIN users u ON m.user_id = u.id
          WHERE u.client_id = $1
            AND m.is_latest = true
            AND m.validation_status != 'needs_review'
        `;
        params = [user.clientId];
        paramIndex = 2;
      } else {
        // Query original solo por user_id
        query = `
          SELECT
            id,
            extraction_id,
            row_data,
            row_number,
            filename,
            validation_status,
            cross_validation_match,
            discrepancy_count,
            version,
            created_at,
            updated_at
          FROM master_excel_output
          WHERE user_id = $1
            AND is_latest = true
            AND validation_status != 'needs_review'
        `;
        params = [user.userId];
        paramIndex = 2;
      }

      // Filtrar por estado
      if (status && status !== 'all') {
        query += useClientSharing ? ` AND m.validation_status = $${paramIndex}` : ` AND validation_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Buscar en campos JSON
      if (search) {
        if (useClientSharing) {
          query += ` AND (
            m.row_data->>'numero_expediente' ILIKE $${paramIndex}
            OR m.row_data->>'nif_empresa' ILIKE $${paramIndex}
            OR m.row_data->>'razon_social' ILIKE $${paramIndex}
            OR m.filename ILIKE $${paramIndex}
          )`;
        } else {
          query += ` AND (
            row_data->>'numero_expediente' ILIKE $${paramIndex}
            OR row_data->>'nif_empresa' ILIKE $${paramIndex}
            OR row_data->>'razon_social' ILIKE $${paramIndex}
            OR filename ILIKE $${paramIndex}
          )`;
        }
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Ordenar y limitar
      query += useClientSharing
        ? ` ORDER BY m.row_number ASC, m.created_at DESC LIMIT $${paramIndex}`
        : ` ORDER BY row_number ASC, created_at DESC LIMIT $${paramIndex}`;
      params.push(parseInt(limit as string));

      const result = await sql.query(query, params);

      // Obtener estadísticas (compartidas por client_id si aplica)
      let stats;
      if (useClientSharing && user.clientId) {
        // Estadísticas compartidas - contar de todos los usuarios del mismo cliente
        const statsResult = await sql`
          SELECT
            COUNT(*)::INTEGER AS total_rows,
            COUNT(*) FILTER (WHERE m.validation_status = 'pending')::INTEGER AS pending,
            COUNT(*) FILTER (WHERE m.validation_status = 'valid')::INTEGER AS valid,
            COUNT(*) FILTER (WHERE m.validation_status = 'needs_review')::INTEGER AS needs_review,
            COUNT(*) FILTER (WHERE m.validation_status = 'approved')::INTEGER AS approved,
            COUNT(*) FILTER (WHERE m.validation_status = 'rejected')::INTEGER AS rejected,
            COUNT(*) FILTER (WHERE m.discrepancy_count > 0)::INTEGER AS with_discrepancies,
            COUNT(*) FILTER (WHERE m.cross_validation_match = true)::INTEGER AS fully_validated
          FROM master_excel_output m
          JOIN users u ON m.user_id = u.id
          WHERE u.client_id = ${user.clientId} AND m.is_latest = true
        `;
        stats = statsResult.rows[0];
      } else {
        const statsResult = await sql`
          SELECT * FROM get_master_excel_stats(${user.userId})
        `;
        stats = statsResult.rows[0];
      }

      console.log('✅ Excel master:', result.rows.length, 'filas', useClientSharing ? '(compartidas por client_id)' : '');

      return res.status(200).json({
        rows: result.rows,
        stats: stats,
        total: result.rows.length
      });

    } catch (error: any) {
      console.error('Error al obtener filas del Excel master:', error);
      return res.status(500).json({
        error: 'Error al obtener filas',
        message: error.message
      });
    }
  }

  // POST /api/master-excel - Agregar nueva fila al Excel master
  if (req.method === 'POST') {
    try {
      const {
        extraction_id,
        row_data,
        filename,
        validation_status = 'pending',
        cross_validation_match = false,
        discrepancy_count = 0
      } = req.body;

      // Validar datos requeridos
      if (!extraction_id || !row_data || !filename) {
        return res.status(400).json({
          error: 'Datos incompletos',
          required: ['extraction_id', 'row_data', 'filename']
        });
      }

      // Verificar que la extracción existe y pertenece al usuario
      const extractionCheck = await sql`
        SELECT id FROM extraction_results
        WHERE id = ${extraction_id}
          AND user_id = ${user.userId}
      `;

      if (extractionCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Extracción no encontrada o no tienes permiso'
        });
      }

      // Verificar si existe una fila para esta extracción
      const existingRow = await sql`
        SELECT id, validation_status FROM master_excel_output
        WHERE extraction_id = ${extraction_id}
          AND is_latest = true
      `;

      // Si existe y está en 'needs_review', actualizarla (viene de revisión)
      if (existingRow.rows.length > 0) {
        const existing = existingRow.rows[0];

        // Si estaba en revisión, actualizar y devolver al Excel Master
        if (existing.validation_status === 'needs_review') {
          console.log('📝 Actualizando registro que estaba en revisión:', existing.id);

          await sql`
            UPDATE master_excel_output
            SET row_data = ${JSON.stringify(row_data)}::JSONB,
                validation_status = ${validation_status},
                cross_validation_match = ${cross_validation_match},
                discrepancy_count = ${discrepancy_count},
                version = version + 1,
                updated_at = NOW()
            WHERE id = ${existing.id}
          `;

          // Obtener la fila actualizada
          const updatedRow = await sql`
            SELECT * FROM master_excel_output WHERE id = ${existing.id}
          `;

          console.log('✅ Registro actualizado y devuelto al Excel Master');

          return res.status(200).json({
            success: true,
            id: existing.id,
            row: updatedRow.rows[0],
            updated: true,
            message: 'Registro actualizado desde revisión'
          });
        }

        // Si no estaba en revisión, es un conflicto real
        return res.status(409).json({
          error: 'Ya existe una fila para esta extracción',
          existingId: existing.id
        });
      }

      // Agregar fila usando la función SQL
      const result = await sql`
        SELECT add_master_excel_row(
          ${user.userId}::UUID,
          ${extraction_id}::UUID,
          ${JSON.stringify(row_data)}::JSONB,
          ${filename},
          ${validation_status},
          ${cross_validation_match},
          ${discrepancy_count}
        ) as new_id
      `;

      const newId = result.rows[0].new_id;

      // Obtener la fila creada
      const newRow = await sql`
        SELECT * FROM master_excel_output WHERE id = ${newId}
      `;

      console.log('✅ Fila agregada al Excel master:', newId);

      return res.status(201).json({
        success: true,
        id: newId,
        row: newRow.rows[0]
      });

    } catch (error: any) {
      console.error('Error al agregar fila al Excel master:', error);
      return res.status(500).json({
        error: 'Error al agregar fila',
        message: error.message
      });
    }
  }

  // Método no permitido
  return res.status(405).json({ error: 'Método no permitido' });
}
