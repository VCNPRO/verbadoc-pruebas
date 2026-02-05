/**
 * RAG INGEST ENDPOINT - Document Ingestion
 * api/rag/ingest.ts
 *
 * Ingest a single document into the RAG system
 * Creates chunks, generates embeddings, uploads to Pinecone
 *
 * POST /api/rag/ingest
 * Body: { documentId: string }
 * Returns: { success: boolean, chunksCreated: number, vectorsUploaded: number }
 *
 * Security: Admin/Reviewer only
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth, verifyAdmin } from '../lib/auth.js';
import { AccessLogDB, getClientIP, getUserAgent } from '../lib/access-log.js';
import { ExtractionResultDB } from '../lib/extractionDB.js';
import { ingestDocument, deleteByDocumentId } from '../lib/ragService.js';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify authentication
  const auth = verifyRequestAuth(req);
  if (!auth) {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Debes iniciar sesion',
    });
  }

  // Verify admin or reviewer role
  const isAdmin = await verifyAdmin(req);
  const isReviewer = auth.role === 'reviewer' || auth.role === 'admin';

  if (!isAdmin && !isReviewer) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Solo administradores y revisores pueden ingestar documentos',
    });
  }

  const userId = auth.userId;
  const ipAddress = getClientIP(req) || undefined;
  const userAgent = getUserAgent(req) || undefined;

  try {
    // DELETE: Remove document from RAG index
    if (req.method === 'DELETE') {
      const { documentId } = req.body;

      if (!documentId) {
        return res.status(400).json({
          error: 'documentId requerido',
          message: 'Debes proporcionar el ID del documento',
        });
      }

      // Delete from Pinecone
      await deleteByDocumentId(documentId);

      // Delete chunk records from database
      await sql`
        DELETE FROM rag_document_chunks
        WHERE document_id = ${documentId}::uuid
      `;

      // Log action
      await AccessLogDB.log({
        userId,
        action: 'rag_delete' as any,
        resourceType: 'document',
        resourceId: documentId,
        ipAddress,
        userAgent,
        success: true,
      });

      return res.status(200).json({
        success: true,
        message: 'Documento eliminado del indice RAG',
        documentId,
      });
    }

    // POST: Ingest document
    if (req.method === 'POST') {
      const { documentId, forceReindex = false } = req.body;

      if (!documentId) {
        return res.status(400).json({
          error: 'documentId requerido',
          message: 'Debes proporcionar el ID del documento a ingestar',
        });
      }

      // Get document from database
      const document = await ExtractionResultDB.findById(documentId);

      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
          message: 'El documento especificado no existe',
        });
      }

      // Security check: Only allow ingesting own documents or if admin
      if (document.user_id !== userId && !isAdmin) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tienes permiso para ingestar este documento',
        });
      }

      // Check if already indexed
      if (!forceReindex) {
        const existingChunks = await sql`
          SELECT COUNT(*) as count FROM rag_document_chunks
          WHERE document_id = ${documentId}::uuid
        `;

        if (parseInt(existingChunks.rows[0].count) > 0) {
          return res.status(409).json({
            error: 'Documento ya indexado',
            message: 'Este documento ya esta en el indice RAG. Usa forceReindex: true para reindexar.',
            chunksExisting: parseInt(existingChunks.rows[0].count),
          });
        }
      }

      // Extract text content from the document
      // The extracted_data should contain the text from OCR processing
      let textContent = '';

      if (document.extracted_data) {
        // Try to extract text from various possible fields
        const data = typeof document.extracted_data === 'string'
          ? JSON.parse(document.extracted_data)
          : document.extracted_data;

        // Common text fields in extracted data
        const textFields = ['texto', 'text', 'contenido', 'content', 'transcripcion', 'transcription', 'ocr_text'];

        for (const field of textFields) {
          if (data[field] && typeof data[field] === 'string') {
            textContent += data[field] + '\n\n';
          }
        }

        // If no specific text field, try to concatenate all string values
        if (!textContent) {
          const extractTextFromObject = (obj: any, depth = 0): string => {
            if (depth > 5) return ''; // Prevent infinite recursion

            let text = '';
            for (const [key, value] of Object.entries(obj)) {
              if (typeof value === 'string' && value.length > 20) {
                text += value + '\n';
              } else if (typeof value === 'object' && value !== null) {
                text += extractTextFromObject(value, depth + 1);
              }
            }
            return text;
          };

          textContent = extractTextFromObject(data);
        }
      }

      if (!textContent || textContent.trim().length < 50) {
        return res.status(400).json({
          error: 'Contenido insuficiente',
          message: 'El documento no tiene suficiente texto extraido para indexar',
          textLength: textContent?.length || 0,
        });
      }

      console.log(`[RAG/Ingest] Ingesting document ${documentId}, text length: ${textContent.length}`);

      // If force reindex, delete existing
      if (forceReindex) {
        await deleteByDocumentId(documentId);
        await sql`
          DELETE FROM rag_document_chunks
          WHERE document_id = ${documentId}::uuid
        `;
      }

      // Perform ingestion
      const startTime = Date.now();
      const result = await ingestDocument(
        documentId,
        document.filename,
        textContent,
        document.user_id,
        {
          fileType: document.file_type,
          pageCount: document.page_count,
          validationStatus: document.validation_status,
        }
      );
      const processingTime = Date.now() - startTime;

      // Log action
      await AccessLogDB.log({
        userId,
        action: 'rag_ingest' as any,
        resourceType: 'document',
        resourceId: documentId,
        resourceName: document.filename,
        ipAddress,
        userAgent,
        success: true,
        metadata: {
          chunksCreated: result.chunksCreated,
          vectorsUploaded: result.vectorsUploaded,
          textLength: textContent.length,
          processingTimeMs: processingTime,
        },
      });

      return res.status(200).json({
        success: true,
        documentId,
        filename: document.filename,
        chunksCreated: result.chunksCreated,
        vectorsUploaded: result.vectorsUploaded,
        textLength: textContent.length,
        processingTimeMs: processingTime,
      });
    }

    return res.status(405).json({
      error: 'Metodo no permitido',
      message: 'Usa POST para ingestar o DELETE para eliminar',
    });

  } catch (error: any) {
    console.error('[RAG/Ingest] Error:', error);

    // Log failed attempt
    await AccessLogDB.log({
      userId,
      action: 'rag_ingest' as any,
      resourceType: 'document',
      resourceId: req.body?.documentId,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: error.message,
    });

    if (error.message?.includes('PINECONE_API_KEY')) {
      return res.status(503).json({
        error: 'Servicio no disponible',
        message: 'El servicio RAG no esta configurado correctamente',
      });
    }

    return res.status(500).json({
      error: 'Error interno',
      message: 'Error al procesar el documento',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
