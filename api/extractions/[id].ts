/**
 * API ENDPOINT: /api/extractions/:id
 * Obtener, actualizar o eliminar una extracción específica
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { ExtractionResultDB, ValidationErrorDB } from '../lib/extractionDB.js';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
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
    return res.status(400).json({ error: 'ID de extracción requerido' });
  }

  // GET /api/extractions/:id - Obtener una extracción con sus errores
  if (req.method === 'GET') {
    try {
      // Primero buscar en extraction_results
      let extraction = await ExtractionResultDB.findById(id);
      let source = 'extraction';

      // Si no se encuentra, buscar en unprocessable_documents
      if (!extraction) {
        console.log(`📋 No encontrado en extraction_results, buscando en unprocessable_documents: ${id}`);
        const unprocessableQuery = await sql`
          SELECT
            id,
            user_id,
            filename,
            extracted_data,
            rejection_category,
            rejection_reason,
            numero_expediente,
            numero_accion,
            numero_grupo,
            file_type,
            file_size_bytes,
            pdf_blob_url,
            file_url,
            created_at,
            updated_at,
            'rejected' as validation_status
          FROM unprocessable_documents
          WHERE id = ${id}
        `;

        if (unprocessableQuery.rows.length > 0) {
          extraction = unprocessableQuery.rows[0];
          source = 'unprocessable';
          console.log(`✅ Encontrado en unprocessable_documents: ${extraction.filename}`);
        }
      }

      if (!extraction) {
        return res.status(404).json({ error: 'Extracción no encontrada' });
      }

      // Verificar que el usuario tiene acceso (admin ve todo, user solo lo suyo)
      if (user.role !== 'admin' && extraction.user_id !== user.userId) {
        return res.status(403).json({ error: 'No tienes permiso para ver esta extracción' });
      }

      // Obtener errores de validación pendientes (solo si viene de extraction_results)
      let errors: any[] = [];
      if (source === 'extraction') {
        errors = await ValidationErrorDB.findPendingByExtractionId(id);
      }

      return res.status(200).json({
        extraction: {
          ...extraction,
          source // Indica de qué tabla viene
        },
        errors,
        errorsCount: errors.length
      });

    } catch (error: any) {
      console.error('Error al obtener extracción:', error);
      return res.status(500).json({
        error: 'Error al obtener extracción',
        message: error.message
      });
    }
  }

  // PATCH /api/extractions/:id - Actualizar extracción
  if (req.method === 'PATCH') {
    try {
      const extraction = await ExtractionResultDB.findById(id);

      if (!extraction) {
        return res.status(404).json({ error: 'Extracción no encontrada' });
      }

      // Verificar permisos
      if (user.role !== 'admin' && extraction.user_id !== user.userId) {
        return res.status(403).json({ error: 'No tienes permiso para modificar esta extracción' });
      }

      const { extractedData, validationStatus, rejectionReason } = req.body;

      // Actualizar datos extraídos
      if (extractedData) {
        await ExtractionResultDB.updateExtractedData(id, extractedData);
      }

      // Actualizar estado de validación
      if (validationStatus) {
        await ExtractionResultDB.updateValidationStatus(id, validationStatus, rejectionReason);
      }

      // Obtener extracción actualizada
      const updatedExtraction = await ExtractionResultDB.findById(id);

      return res.status(200).json({
        success: true,
        extraction: updatedExtraction
      });

    } catch (error: any) {
      console.error('Error al actualizar extracción:', error);
      return res.status(500).json({
        error: 'Error al actualizar extracción',
        message: error.message
      });
    }
  }

  // DELETE /api/extractions/:id - Eliminar extracción
  if (req.method === 'DELETE') {
    try {
      const extraction = await ExtractionResultDB.findById(id);

      if (!extraction) {
        return res.status(404).json({ error: 'Extracción no encontrada' });
      }

      // Verificar permisos
      if (user.role !== 'admin' && extraction.user_id !== user.userId) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta extracción' });
      }

      const deleted = await ExtractionResultDB.delete(id, user.userId);

      if (!deleted) {
        return res.status(500).json({ error: 'No se pudo eliminar la extracción' });
      }

      return res.status(200).json({
        success: true,
        message: 'Extracción eliminada correctamente'
      });

    } catch (error: any) {
      console.error('Error al eliminar extracción:', error);
      return res.status(500).json({
        error: 'Error al eliminar extracción',
        message: error.message
      });
    }
  }

  // Método no permitido
  return res.status(405).json({ error: 'Método no permitido' });
}
