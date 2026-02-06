/**
 * RAG ASK ENDPOINT - "Preguntale al Documento"
 * api/rag/ask.ts
 *
 * Semantic search and question answering over user's documents
 *
 * POST /api/rag/ask
 * Body: { query: string, documentIds?: string[], topK?: number }
 * Returns: { answer: string, sources: [...], confidence: number }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth } from '../lib/auth.js';
import { AccessLogDB, getClientIP, getUserAgent } from '../lib/access-log.js';
import {
  ragQuery,
  logRagQuery,
  getRagQueryHistory,
} from '../lib/ragService.js';

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
      message: 'Debes iniciar sesion para usar esta funcion',
    });
  }

  const userId = auth.userId;
  const ipAddress = getClientIP(req) || undefined;
  const userAgent = getUserAgent(req) || undefined;

  try {
    // GET: Return query history
    if (req.method === 'GET') {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await getRagQueryHistory(userId, limit);

      return res.status(200).json({
        success: true,
        history,
        count: history.length,
      });
    }

    // POST: Process RAG query
    if (req.method === 'POST') {
      const { query, documentIds, projectId, folderId, topK = 5, language = 'es' } = req.body;

      // Validate query
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          error: 'Query requerida',
          message: 'Debes proporcionar una pregunta',
        });
      }

      if (query.length > 2000) {
        return res.status(400).json({
          error: 'Query demasiado larga',
          message: 'La pregunta no puede exceder 2000 caracteres',
        });
      }

      // Validate topK
      const effectiveTopK = Math.min(Math.max(1, topK), 20);

      console.log(`[RAG/Ask] User ${userId} query: "${query.substring(0, 100)}..."`);

      // Validar idioma (solo los 9 soportados)
      const supportedLanguages = ['es', 'ca', 'gl', 'eu', 'pt', 'fr', 'en', 'it', 'de'];
      const effectiveLanguage = supportedLanguages.includes(language) ? language : 'es';

      // Execute RAG query
      const startTime = Date.now();
      const result = await ragQuery(
        query.trim(),
        userId,
        {
          documentIds: documentIds || undefined,
          folderId: folderId || undefined,
        },
        effectiveTopK,
        effectiveLanguage
      );
      const processingTime = Date.now() - startTime;

      // Log query for audit (GDPR/ENS compliance)
      const documentIdsUsed = result.sources.map(s => s.documentId);
      await logRagQuery(
        userId,
        query,
        result.answer,
        documentIdsUsed,
        result.confidence,
        ipAddress,
        userAgent
      );

      // Log access for security audit
      await AccessLogDB.log({
        userId,
        action: 'rag_query' as any, // Extended action type
        resourceType: 'rag',
        ipAddress,
        userAgent,
        success: true,
        metadata: {
          queryLength: query.length,
          sourcesCount: result.sources.length,
          confidence: result.confidence,
          processingTimeMs: processingTime,
        },
      });

      return res.status(200).json({
        success: true,
        answer: result.answer,
        sources: result.sources,
        confidence: result.confidence,
        processingTimeMs: processingTime,
        tokensUsed: result.tokensUsed,
      });
    }

    return res.status(405).json({
      error: 'Metodo no permitido',
      message: 'Usa POST para consultas o GET para historial',
    });

  } catch (error: any) {
    console.error('[RAG/Ask] Error:', error);

    // Log failed attempt
    await AccessLogDB.log({
      userId,
      action: 'rag_query' as any,
      resourceType: 'rag',
      ipAddress,
      userAgent,
      success: false,
      errorMessage: error.message,
    });

    // Handle specific errors
    if (error.message?.includes('PINECONE_API_KEY')) {
      return res.status(503).json({
        error: 'Servicio no disponible',
        message: 'El servicio RAG no esta configurado correctamente',
      });
    }

    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      return res.status(429).json({
        error: 'Limite alcanzado',
        message: 'Demasiadas consultas. Intenta de nuevo en unos segundos.',
      });
    }

    return res.status(500).json({
      error: 'Error interno',
      message: 'Error al procesar la consulta. Intenta de nuevo.',
    });
  }
}
