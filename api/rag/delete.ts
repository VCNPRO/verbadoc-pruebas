/**
 * RAG DELETE ENDPOINT - GDPR Right to be Forgotten
 * api/rag/delete.ts
 *
 * Endpoint para eliminar embeddings de documentos/usuarios
 * Cumplimiento RGPD Art. 17 (Derecho al olvido)
 *
 * DELETE /api/rag/delete
 * Body: {
 *   type: 'document' | 'user',
 *   documentId?: string,  // Required if type='document'
 *   userId?: string,      // Required if type='user' (admin only)
 *   reason?: string       // Audit trail
 * }
 *
 * Security: Authenticated users can delete own data, admin can delete any
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth, verifyAdmin } from '../lib/auth.js';
import { AccessLogDB, getClientIP, getUserAgent } from '../lib/access-log.js';
import { deleteByDocumentId, deleteByUserId } from '../lib/ragService.js';
import { ExtractionResultDB } from '../lib/extractionDB.js';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only DELETE or POST (for compatibility)
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Metodo no permitido',
      message: 'Usa DELETE para eliminar datos',
    });
  }

  // Verify authentication
  const auth = verifyRequestAuth(req);
  if (!auth) {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Debes iniciar sesion',
    });
  }

  const requestingUserId = auth.userId;
  const isAdmin = await verifyAdmin(req);
  const ipAddress = getClientIP(req) || undefined;
  const userAgent = getUserAgent(req) || undefined;

  try {
    const { type, documentId, userId, reason } = req.body;

    // Validate request type
    if (!type || !['document', 'user'].includes(type)) {
      return res.status(400).json({
        error: 'Tipo invalido',
        message: 'El tipo debe ser "document" o "user"',
      });
    }

    // ==================================
    // DELETE BY DOCUMENT
    // ==================================
    if (type === 'document') {
      if (!documentId) {
        return res.status(400).json({
          error: 'documentId requerido',
          message: 'Debes proporcionar el ID del documento',
        });
      }

      // Verify document exists and user has access
      const document = await ExtractionResultDB.findById(documentId);

      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
          message: 'El documento especificado no existe',
        });
      }

      // Security check: Only owner or admin can delete
      if (document.user_id !== requestingUserId && !isAdmin) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tienes permiso para eliminar este documento del indice',
        });
      }

      console.log(`[RAG/Delete] Deleting document ${documentId} from RAG index`);

      // Delete from Pinecone
      await deleteByDocumentId(documentId);

      // Delete chunk records from database
      const deleteResult = await sql`
        DELETE FROM rag_document_chunks
        WHERE document_id = ${documentId}::uuid
        RETURNING id
      `;

      const chunksDeleted = deleteResult.rowCount || 0;

      // Log action for audit (RGPD compliance)
      await AccessLogDB.log({
        userId: requestingUserId,
        action: 'rag_delete',
        resourceType: 'document',
        resourceId: documentId,
        resourceName: document.filename,
        ipAddress,
        userAgent,
        success: true,
        metadata: {
          deleteType: 'document',
          chunksDeleted,
          reason: reason || 'User request',
          gdprCompliance: true,
        },
      });

      return res.status(200).json({
        success: true,
        type: 'document',
        documentId,
        filename: document.filename,
        chunksDeleted,
        message: 'Documento eliminado del indice RAG',
      });
    }

    // ==================================
    // DELETE BY USER (Admin only)
    // ==================================
    if (type === 'user') {
      const targetUserId = userId || requestingUserId;

      // If deleting another user's data, must be admin
      if (targetUserId !== requestingUserId && !isAdmin) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'Solo administradores pueden eliminar datos de otros usuarios',
        });
      }

      console.log(`[RAG/Delete] Deleting all RAG data for user ${targetUserId}`);

      // Delete from Pinecone
      await deleteByUserId(targetUserId);

      // Delete all chunk records for user's documents
      const deleteChunksResult = await sql`
        DELETE FROM rag_document_chunks
        WHERE document_id IN (
          SELECT id FROM extraction_results WHERE user_id = ${targetUserId}::uuid
        )
        RETURNING id
      `;

      const chunksDeleted = deleteChunksResult.rowCount || 0;

      // Delete all query history for the user
      const deleteQueriesResult = await sql`
        DELETE FROM rag_queries
        WHERE user_id = ${targetUserId}::uuid
        RETURNING id
      `;

      const queriesDeleted = deleteQueriesResult.rowCount || 0;

      // Log action for audit (RGPD compliance)
      await AccessLogDB.log({
        userId: requestingUserId,
        action: 'rag_delete',
        resourceType: 'user',
        resourceId: targetUserId,
        ipAddress,
        userAgent,
        success: true,
        metadata: {
          deleteType: 'user',
          targetUserId,
          chunksDeleted,
          queriesDeleted,
          reason: reason || 'GDPR Right to be Forgotten request',
          gdprCompliance: true,
          gdprArticle: 'Art. 17',
        },
      });

      return res.status(200).json({
        success: true,
        type: 'user',
        userId: targetUserId,
        chunksDeleted,
        queriesDeleted,
        message: 'Todos los datos RAG del usuario han sido eliminados',
        gdprCompliance: {
          article: 'Art. 17',
          rightToErasure: true,
        },
      });
    }

    // Should not reach here
    return res.status(400).json({
      error: 'Solicitud invalida',
      message: 'No se pudo procesar la solicitud',
    });

  } catch (error: any) {
    console.error('[RAG/Delete] Error:', error);

    // Log failed attempt
    await AccessLogDB.log({
      userId: requestingUserId,
      action: 'rag_delete',
      resourceType: req.body?.type || 'unknown',
      resourceId: req.body?.documentId || req.body?.userId,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: error.message,
    });

    return res.status(500).json({
      error: 'Error interno',
      message: 'Error al eliminar datos del indice RAG',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
