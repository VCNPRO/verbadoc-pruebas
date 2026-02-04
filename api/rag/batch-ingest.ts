/**
 * RAG BATCH INGEST ENDPOINT - Mass Document Ingestion
 * api/rag/batch-ingest.ts
 *
 * Batch process multiple documents for RAG indexing
 * Designed for Normadat pilot: 5,000 PDFs
 *
 * POST /api/rag/batch-ingest
 * Body: {
 *   documentIds?: string[],     // Specific documents to process
 *   userId?: string,            // Process all docs for user (admin only)
 *   batchSize?: number,         // Docs per batch (default: 50)
 *   skipExisting?: boolean      // Skip already indexed docs (default: true)
 * }
 *
 * Returns: { success: boolean, processed: number, failed: number, results: [...] }
 *
 * Security: Admin only
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth, verifyAdmin } from '../lib/auth.js';
import { AccessLogDB, getClientIP, getUserAgent } from '../lib/access-log.js';
import { ExtractionResultDB } from '../lib/extractionDB.js';
import { ingestDocument, deleteByDocumentId } from '../lib/ragService.js';
import { sql } from '@vercel/postgres';

// Configuration for batch processing
const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

interface BatchResult {
  documentId: string;
  filename: string;
  success: boolean;
  chunksCreated?: number;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = RETRY_ATTEMPTS,
  delayMs: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`[RAG/Batch] Attempt ${attempt}/${maxAttempts} failed:`, error.message);

      if (attempt < maxAttempts) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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

  // Admin only for batch operations
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Solo administradores pueden ejecutar ingesta masiva',
    });
  }

  const adminUserId = auth.userId;
  const ipAddress = getClientIP(req) || undefined;
  const userAgent = getUserAgent(req) || undefined;

  try {
    // GET: Check batch processing status
    if (req.method === 'GET') {
      // Get statistics about indexed documents
      const stats = await sql`
        SELECT
          COUNT(DISTINCT document_id) as indexed_documents,
          COUNT(*) as total_chunks,
          MAX(created_at) as last_indexed
        FROM rag_document_chunks
      `;

      const totalDocuments = await sql`
        SELECT COUNT(*) as total FROM extraction_results
        WHERE validation_status IN ('valid', 'approved', 'needs_review')
      `;

      const indexedCount = parseInt(stats.rows[0]?.indexed_documents || '0');
      const totalCount = parseInt(totalDocuments.rows[0]?.total || '0');

      return res.status(200).json({
        success: true,
        stats: {
          indexedDocuments: indexedCount,
          totalDocuments: totalCount,
          totalChunks: parseInt(stats.rows[0]?.total_chunks || '0'),
          lastIndexed: stats.rows[0]?.last_indexed,
          percentageIndexed: totalCount > 0 ? Math.round((indexedCount / totalCount) * 100) : 0,
        },
      });
    }

    // POST: Execute batch ingestion
    if (req.method === 'POST') {
      const {
        documentIds,
        userId: targetUserId,
        batchSize = DEFAULT_BATCH_SIZE,
        skipExisting = true,
        validationStatusFilter = ['valid', 'approved'],
      } = req.body;

      const effectiveBatchSize = Math.min(Math.max(1, batchSize), MAX_BATCH_SIZE);

      console.log('[RAG/Batch] Starting batch ingestion', {
        documentIds: documentIds?.length,
        targetUserId,
        batchSize: effectiveBatchSize,
        skipExisting,
      });

      // Build document query
      let documents: any[] = [];

      if (documentIds && documentIds.length > 0) {
        // Specific documents
        const result = await sql`
          SELECT id, user_id, filename, extracted_data, file_type, page_count, validation_status
          FROM extraction_results
          WHERE id = ANY(${documentIds}::uuid[])
        `;
        documents = result.rows;
      } else if (targetUserId) {
        // All documents for a specific user
        const result = await sql`
          SELECT id, user_id, filename, extracted_data, file_type, page_count, validation_status
          FROM extraction_results
          WHERE user_id = ${targetUserId}::uuid
          AND validation_status = ANY(${validationStatusFilter}::text[])
          ORDER BY created_at DESC
        `;
        documents = result.rows;
      } else {
        // All valid documents (for full re-index)
        const result = await sql`
          SELECT id, user_id, filename, extracted_data, file_type, page_count, validation_status
          FROM extraction_results
          WHERE validation_status = ANY(${validationStatusFilter}::text[])
          ORDER BY created_at DESC
          LIMIT 5000
        `;
        documents = result.rows;
      }

      if (documents.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No hay documentos para procesar',
          processed: 0,
          failed: 0,
          results: [],
        });
      }

      // Filter out already indexed if skipExisting
      if (skipExisting) {
        const existingResult = await sql`
          SELECT DISTINCT document_id::text FROM rag_document_chunks
        `;
        const existingIds = new Set(existingResult.rows.map(r => r.document_id));
        documents = documents.filter(d => !existingIds.has(d.id));

        console.log(`[RAG/Batch] After filtering existing: ${documents.length} documents to process`);
      }

      // Process in batches
      const results: BatchResult[] = [];
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < documents.length; i += effectiveBatchSize) {
        const batch = documents.slice(i, i + effectiveBatchSize);
        console.log(`[RAG/Batch] Processing batch ${Math.floor(i / effectiveBatchSize) + 1}/${Math.ceil(documents.length / effectiveBatchSize)}`);

        // Process batch in parallel with retries
        const batchPromises = batch.map(async (doc): Promise<BatchResult> => {
          const startTime = Date.now();

          try {
            // Extract text content
            let textContent = '';
            if (doc.extracted_data) {
              const data = typeof doc.extracted_data === 'string'
                ? JSON.parse(doc.extracted_data)
                : doc.extracted_data;

              const textFields = ['texto', 'text', 'contenido', 'content', 'transcripcion', 'transcription', 'ocr_text'];
              for (const field of textFields) {
                if (data[field] && typeof data[field] === 'string') {
                  textContent += data[field] + '\n\n';
                }
              }

              // Fallback: concatenate all string values
              if (!textContent) {
                const extractText = (obj: any, depth = 0): string => {
                  if (depth > 5) return '';
                  let text = '';
                  for (const [, value] of Object.entries(obj)) {
                    if (typeof value === 'string' && value.length > 20) {
                      text += value + '\n';
                    } else if (typeof value === 'object' && value !== null) {
                      text += extractText(value, depth + 1);
                    }
                  }
                  return text;
                };
                textContent = extractText(data);
              }
            }

            if (!textContent || textContent.trim().length < 50) {
              return {
                documentId: doc.id,
                filename: doc.filename,
                success: false,
                error: 'Contenido insuficiente',
                processingTimeMs: Date.now() - startTime,
              };
            }

            // Ingest with retry
            const result = await withRetry(() =>
              ingestDocument(
                doc.id,
                doc.filename,
                textContent,
                doc.user_id,
                {
                  fileType: doc.file_type,
                  pageCount: doc.page_count,
                  validationStatus: doc.validation_status,
                }
              )
            );

            return {
              documentId: doc.id,
              filename: doc.filename,
              success: true,
              chunksCreated: result.chunksCreated,
              processingTimeMs: Date.now() - startTime,
            };

          } catch (error: any) {
            return {
              documentId: doc.id,
              filename: doc.filename,
              success: false,
              error: error.message,
              processingTimeMs: Date.now() - startTime,
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update counters
        batchResults.forEach(r => {
          if (r.success) processed++;
          else failed++;
        });

        // Small delay between batches to avoid rate limits
        if (i + effectiveBatchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Log action
      await AccessLogDB.log({
        userId: adminUserId,
        action: 'rag_batch_ingest' as any,
        resourceType: 'batch',
        ipAddress,
        userAgent,
        success: true,
        metadata: {
          totalDocuments: documents.length,
          processed,
          failed,
          batchSize: effectiveBatchSize,
          targetUserId: targetUserId || 'all',
        },
      });

      // Return results summary
      return res.status(200).json({
        success: true,
        totalDocuments: documents.length,
        processed,
        failed,
        results: results.slice(0, 100), // Limit results to avoid huge responses
        hasMoreResults: results.length > 100,
      });
    }

    return res.status(405).json({
      error: 'Metodo no permitido',
      message: 'Usa POST para iniciar ingesta masiva o GET para ver estadisticas',
    });

  } catch (error: any) {
    console.error('[RAG/Batch] Error:', error);

    // Log failed attempt
    await AccessLogDB.log({
      userId: adminUserId,
      action: 'rag_batch_ingest' as any,
      resourceType: 'batch',
      ipAddress,
      userAgent,
      success: false,
      errorMessage: error.message,
    });

    return res.status(500).json({
      error: 'Error interno',
      message: 'Error en el procesamiento masivo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
