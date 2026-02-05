/**
 * API ENDPOINT: /api/extractions
 * Maneja CRUD de extracciones de documentos
 *
 * MODO GENÉRICO: Acepta cualquier tipo de documento (PDF, imágenes)
 * sin validación de esquema específico.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { sql } from '@vercel/postgres';

// Import con extensión .js explícita para Vercel serverless
import { ExtractionResultDB } from '../lib/extractionDB.js';
import { AccessLogDB } from '../lib/access-log.js';
import { calculateConfidenceScore } from '../_lib/confidenceService.js';
import { verifyExtraction, mergeWithVerification, type VerificationResult } from '../_lib/doubleVerificationService.js';

// Helper: Verificar autenticación y obtener client_id
async function verifyAuth(req: VercelRequest): Promise<{ userId: string; role: string; clientId: number | null } | null> {
  try {
    const token = req.cookies['auth-token'];
    if (!token) {
      return null;
    }

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
    console.error('❌ No autenticado en /api/extractions');
    return res.status(401).json({ error: 'No autenticado' });
  }

  console.log('✅ Usuario autenticado:', user.userId, '| client_id:', user.clientId);

  // GET /api/extractions - Listar extracciones del usuario (compartidas por client_id)
  if (req.method === 'GET') {
    try {
      console.log('📊 GET /api/extractions - userId:', user.userId, '| clientId:', user.clientId);
      const { limit = '10000', status, needsReview } = req.query;

      let extractions;

      // 🔥 COMPARTIR DATOS: Si tiene client_id, mostrar datos de todos los usuarios del mismo cliente
      // Si no tiene client_id, mostrar solo sus propios datos
      const useClientSharing = user.clientId !== null;

      try {
        if (needsReview === 'true') {
          console.log('🔍 Buscando extracciones que REQUIEREN REVISIÓN...');
          // 🔥 FILTRO "Requiere Revisión": errores de validación O status needs_review
          const errorsQuery = useClientSharing
            ? await sql`
                SELECT
                  e.id,
                  e.user_id,
                  e.filename,
                  e.extracted_data,
                  e.model_used,
                  e.pdf_blob_url,
                  e.file_type,
                  e.file_size_bytes,
                  e.page_count,
                  e.processing_time_ms,
                  e.confidence_score,
                  e.validation_status as status,
                  e.validation_errors_count,
                  e.rejection_reason,
                  e.created_at,
                  e.updated_at,
                  'extraction'::text as source
                FROM extraction_results e
                JOIN users u ON e.user_id = u.id
                WHERE u.client_id = ${user.clientId}
                  AND (e.validation_errors_count > 0 OR e.validation_status = 'needs_review')
                ORDER BY e.created_at DESC
                LIMIT ${parseInt(limit as string)}
              `
            : await sql`
                SELECT
                  id,
                  user_id,
                  filename,
                  extracted_data,
                  model_used,
                  pdf_blob_url,
                  file_type,
                  file_size_bytes,
                  page_count,
                  processing_time_ms,
                  confidence_score,
                  validation_status as status,
                  validation_errors_count,
                  rejection_reason,
                  created_at,
                  updated_at,
                  'extraction'::text as source
                FROM extraction_results
                WHERE user_id = ${user.userId}
                  AND (validation_errors_count > 0 OR validation_status = 'needs_review')
                ORDER BY created_at DESC
                LIMIT ${parseInt(limit as string)}
              `;
          extractions = errorsQuery.rows;
        } else if (status === 'rejected') {
          console.log('🔍 Buscando RECHAZADOS (unprocessable + extraction_results rejected)...');
          // 🔥 FILTRO "Rechazados": UNION de unprocessable_documents + extraction_results con status rejected
          const rejectedQuery = useClientSharing
            ? await sql`
                (
                  SELECT
                    d.id,
                    d.user_id,
                    d.filename,
                    d.extracted_data,
                    NULL::text as model_used,
                    d.pdf_blob_url,
                    d.file_type,
                    d.file_size_bytes,
                    0::integer as page_count,
                    NULL::integer as processing_time_ms,
                    NULL::numeric as confidence_score,
                    'rejected'::text as status,
                    0::integer as validation_errors_count,
                    d.rejection_reason,
                    d.created_at,
                    d.updated_at,
                    'unprocessable'::text as source
                  FROM unprocessable_documents d
                  JOIN users u ON d.user_id = u.id
                  WHERE u.client_id = ${user.clientId}
                )
                UNION ALL
                (
                  SELECT
                    e.id,
                    e.user_id,
                    e.filename,
                    e.extracted_data,
                    e.model_used,
                    e.pdf_blob_url,
                    e.file_type,
                    e.file_size_bytes,
                    e.page_count,
                    e.processing_time_ms,
                    e.confidence_score,
                    e.validation_status as status,
                    e.validation_errors_count,
                    e.rejection_reason,
                    e.created_at,
                    e.updated_at,
                    'extraction'::text as source
                  FROM extraction_results e
                  JOIN users u ON e.user_id = u.id
                  WHERE u.client_id = ${user.clientId}
                    AND e.validation_status = 'rejected'
                )
                ORDER BY created_at DESC
                LIMIT ${parseInt(limit as string)}
              `
            : await sql`
                (
                  SELECT
                    id,
                    user_id,
                    filename,
                    extracted_data,
                    NULL::text as model_used,
                    pdf_blob_url,
                    file_type,
                    file_size_bytes,
                    0::integer as page_count,
                    NULL::integer as processing_time_ms,
                    NULL::numeric as confidence_score,
                    'rejected'::text as status,
                    0::integer as validation_errors_count,
                    rejection_reason,
                    created_at,
                    updated_at,
                    'unprocessable'::text as source
                  FROM unprocessable_documents
                  WHERE user_id = ${user.userId}
                )
                UNION ALL
                (
                  SELECT
                    id,
                    user_id,
                    filename,
                    extracted_data,
                    model_used,
                    pdf_blob_url,
                    file_type,
                    file_size_bytes,
                    page_count,
                    processing_time_ms,
                    confidence_score,
                    validation_status as status,
                    validation_errors_count,
                    rejection_reason,
                    created_at,
                    updated_at,
                    'extraction'::text as source
                  FROM extraction_results
                  WHERE user_id = ${user.userId}
                    AND validation_status = 'rejected'
                )
                ORDER BY created_at DESC
                LIMIT ${parseInt(limit as string)}
              `;
          extractions = rejectedQuery.rows;
        } else if (status) {
          console.log('🔍 Buscando extracciones con status:', status);
          // Filtrar por status específico en extraction_results
          const statusQuery = useClientSharing
            ? await sql`
                SELECT
                  e.id,
                  e.user_id,
                  e.filename,
                  e.extracted_data,
                  e.model_used,
                  e.pdf_blob_url,
                  e.file_type,
                  e.file_size_bytes,
                  e.page_count,
                  e.processing_time_ms,
                  e.confidence_score,
                  e.validation_status as status,
                  e.validation_errors_count,
                  e.rejection_reason,
                  e.created_at,
                  e.updated_at,
                  'extraction'::text as source
                FROM extraction_results e
                JOIN users u ON e.user_id = u.id
                WHERE u.client_id = ${user.clientId}
                  AND e.validation_status = ${status as string}
                ORDER BY e.created_at DESC
                LIMIT ${parseInt(limit as string)}
              `
            : await sql`
                SELECT
                  id,
                  user_id,
                  filename,
                  extracted_data,
                  model_used,
                  pdf_blob_url,
                  file_type,
                  file_size_bytes,
                  page_count,
                  processing_time_ms,
                  confidence_score,
                  validation_status as status,
                  validation_errors_count,
                  rejection_reason,
                  created_at,
                  updated_at,
                  'extraction'::text as source
                FROM extraction_results
                WHERE user_id = ${user.userId}
                  AND validation_status = ${status as string}
                ORDER BY created_at DESC
                LIMIT ${parseInt(limit as string)}
              `;
          extractions = statusQuery.rows;
        } else {
          console.log('🔍 Buscando TODOS los documentos (extraction_results + unprocessable_documents)...');
          // 🔥 FILTRO "Todos": UNION de ambas tablas - COMPARTIDO POR CLIENT_ID
          const allQuery = useClientSharing
            ? await sql`
                (
                  SELECT
                    e.id,
                    e.user_id,
                    e.filename,
                    e.extracted_data,
                    e.model_used,
                    e.pdf_blob_url,
                    e.file_type,
                    e.file_size_bytes,
                    e.page_count,
                    e.processing_time_ms,
                    e.confidence_score,
                    e.validation_status as status,
                    e.validation_errors_count,
                    e.rejection_reason,
                    e.created_at,
                    e.updated_at,
                    'extraction' as source
                  FROM extraction_results e
                  JOIN users u ON e.user_id = u.id
                  WHERE u.client_id = ${user.clientId}
                )
                UNION ALL
                (
                  SELECT
                    d.id,
                    d.user_id,
                    d.filename,
                    d.extracted_data,
                    NULL::text as model_used,
                    d.pdf_blob_url,
                    d.file_type,
                    d.file_size_bytes,
                    0::integer as page_count,
                    NULL::integer as processing_time_ms,
                    NULL::numeric as confidence_score,
                    'rejected'::text as status,
                    0::integer as validation_errors_count,
                    d.rejection_reason,
                    d.created_at,
                    d.updated_at,
                    'unprocessable'::text as source
                  FROM unprocessable_documents d
                  JOIN users u ON d.user_id = u.id
                  WHERE u.client_id = ${user.clientId}
                )
                ORDER BY created_at DESC
                LIMIT ${parseInt(limit as string)}
              `
            : await sql`
                (
                  SELECT
                    id,
                    user_id,
                    filename,
                    extracted_data,
                    model_used,
                    pdf_blob_url,
                    file_type,
                    file_size_bytes,
                    page_count,
                    processing_time_ms,
                    confidence_score,
                    validation_status as status,
                    validation_errors_count,
                    rejection_reason,
                    created_at,
                    updated_at,
                    'extraction' as source
                  FROM extraction_results
                  WHERE user_id = ${user.userId}
                )
                UNION ALL
                (
                  SELECT
                    id,
                    user_id,
                    filename,
                    extracted_data,
                    NULL::text as model_used,
                    pdf_blob_url,
                    file_type,
                    file_size_bytes,
                    0::integer as page_count,
                    NULL::integer as processing_time_ms,
                    NULL::numeric as confidence_score,
                    'rejected'::text as status,
                    0::integer as validation_errors_count,
                    rejection_reason,
                    created_at,
                    updated_at,
                    'unprocessable'::text as source
                  FROM unprocessable_documents
                  WHERE user_id = ${user.userId}
                )
                ORDER BY created_at DESC
                LIMIT ${parseInt(limit as string)}
              `;
          extractions = allQuery.rows;
        }
        console.log('✅ Extracciones encontradas:', extractions.length, useClientSharing ? '(compartidas por client_id)' : '(solo usuario)');
      } catch (dbError: any) {
        console.error('❌ Error de base de datos:', dbError);
        return res.status(500).json({
          error: 'Error de base de datos al buscar extracciones',
          message: dbError.message,
          stack: process.env.NODE_ENV === 'development' ? dbError.stack : undefined
        });
      }

      // Obtener estadísticas (compartidas por client_id si aplica)
      let stats;
      try {
        console.log('📊 Obteniendo estadísticas...');
        if (useClientSharing && user.clientId) {
          // Estadísticas compartidas por client_id
          const extractionsResult = await sql`
            SELECT
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE e.validation_status = 'pending') as pending,
              COUNT(*) FILTER (WHERE e.validation_status = 'valid' OR e.validation_status = 'approved') as valid,
              COUNT(*) FILTER (WHERE (e.validation_errors_count > 0 OR e.validation_status = 'needs_review') AND e.validation_status NOT IN ('valid', 'approved', 'rejected')) as needs_review,
              COUNT(*) FILTER (WHERE e.validation_status = 'rejected') as rejected_extractions
            FROM extraction_results e
            JOIN users u ON e.user_id = u.id
            WHERE u.client_id = ${user.clientId}
          `;
          const rejectedResult = await sql`
            SELECT COUNT(*) as rejected
            FROM unprocessable_documents d
            JOIN users u ON d.user_id = u.id
            WHERE u.client_id = ${user.clientId}
          `;
          const extractionStats = extractionsResult.rows[0];
          const rejectedStats = rejectedResult.rows[0];
          const totalRejected = parseInt(extractionStats.rejected_extractions) + parseInt(rejectedStats.rejected);
          stats = {
            total: parseInt(extractionStats.total) + parseInt(rejectedStats.rejected),
            pending: parseInt(extractionStats.pending),
            valid: parseInt(extractionStats.valid),
            needsReview: parseInt(extractionStats.needs_review),
            rejected: totalRejected
          };
        } else {
          stats = await ExtractionResultDB.getStats(user.userId);
        }
        console.log('✅ Estadísticas obtenidas', useClientSharing ? '(compartidas)' : '');
      } catch (statsError: any) {
        console.error('⚠️ Error al obtener stats (no crítico):', statsError);
        stats = { total: 0, pending: 0, valid: 0, needsReview: 0, rejected: 0 };
      }

      // Log access to review page
      await AccessLogDB.logFromRequest({
        req,
        userId: user.userId,
        action: 'view_review',
        success: true,
        metadata: {
          count: extractions.length,
          needsReview: needsReview === 'true',
          status: status || 'all',
        },
      });

      return res.status(200).json({
        extractions,
        stats,
        count: extractions.length
      });

    } catch (error: any) {
      console.error('❌ Error general al obtener extracciones:', error);
      return res.status(500).json({
        error: 'Error al obtener extracciones',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // POST /api/extractions - Crear nueva extracción (MODO GENÉRICO)
  if (req.method === 'POST') {
    try {
      const {
        filename,
        extractedData,
        modelUsed,
        fileUrl,
        fileType,
        fileSizeBytes,
        pageCount,
        processingTimeMs,
        confidenceScore,
        verificationData // 🔒 Datos de doble verificación (opcional)
      } = req.body;

      // Validar campos requeridos básicos
      if (!filename || !extractedData || !modelUsed) {
        return res.status(400).json({
          error: 'Faltan campos requeridos: filename, extractedData, modelUsed'
        });
      }

      console.log('📄 POST /api/extractions - Modo genérico (sin validación FUNDAE)');
      console.log(`   Archivo: ${filename}, Modelo: ${modelUsed}`);

      // Asegurar que extractedData sea un objeto
      const dataObj = typeof extractedData === 'string' ? JSON.parse(extractedData) : extractedData;

      // 🔒 DOBLE VERIFICACIÓN (si se proporcionaron datos de verificación)
      let verificationResult: VerificationResult | null = null;
      if (verificationData && typeof verificationData === 'object') {
        console.log('🔒 Ejecutando DOBLE VERIFICACIÓN de campos...');
        verificationResult = verifyExtraction(dataObj, verificationData);
        console.log(`🔒 Verificación: ${verificationResult.verified ? '✅ EXITOSA' : '⚠️ DISCREPANCIAS'}`);

        if (verificationResult.discrepantFields.length > 0) {
          // Intentar merge inteligente
          const { mergedData, fieldsUpdated } = mergeWithVerification(
            dataObj,
            verificationData,
            verificationResult
          );

          if (fieldsUpdated.length > 0) {
            console.log(`   🔄 Campos actualizados por verificación: ${fieldsUpdated.join(', ')}`);
            Object.assign(dataObj, mergedData);
          }
        }
      }

      // Calcular confianza basada en campos extraídos
      let realConfidenceScore = confidenceScore || 0.7;
      try {
        const confidenceResult = calculateConfidenceScore(dataObj);
        realConfidenceScore = confidenceResult.score;

        // Ajustar confianza si hay discrepancias de verificación
        if (verificationResult && !verificationResult.verified) {
          const penalty = verificationResult.discrepantFields.length * 0.1;
          realConfidenceScore = Math.max(0.3, realConfidenceScore - penalty);
        }

        console.log(`📊 Confianza calculada: ${Math.round(realConfidenceScore * 100)}%`);
      } catch (confError) {
        console.log('⚠️ Error calculando confianza, usando valor por defecto');
      }

      // Crear extracción en BD
      const extraction = await ExtractionResultDB.create({
        userId: user.userId,
        filename,
        extractedData: dataObj,
        modelUsed,
        fileUrl,
        fileType,
        fileSizeBytes,
        pageCount,
        processingTimeMs,
        confidenceScore: realConfidenceScore
      });

      console.log('✅ Extracción creada:', extraction.id);

      // Estado por defecto: valid (sin validación FUNDAE)
      await ExtractionResultDB.update(extraction.id, {
        status: 'valid',
        validationErrorsCount: 0
      });

      // Log de acceso
      await AccessLogDB.logFromRequest({
        req,
        userId: user.userId,
        action: 'extract',
        resourceType: 'document',
        resourceId: extraction.id,
        resourceName: filename,
        success: true,
        metadata: {
          modelUsed,
          confidenceScore: realConfidenceScore,
          fieldsExtracted: Object.keys(dataObj).length,
          mode: 'generic' // Indicador de modo genérico
        }
      });

      return res.status(201).json({
        success: true,
        extraction,
        confidence: {
          score: realConfidenceScore,
          percentage: Math.round(realConfidenceScore * 100),
          level: realConfidenceScore >= 0.85 ? 'high' : realConfidenceScore >= 0.65 ? 'medium' : 'low'
        },
        verification: verificationResult ? {
          verified: verificationResult.verified,
          matchingFields: verificationResult.matchingFields,
          discrepancies: verificationResult.discrepantFields.length,
          confidence: verificationResult.confidence
        } : null,
        mode: 'generic'
      });

    } catch (error: any) {
      console.error('Error al crear extracción:', error);
      return res.status(500).json({
        error: 'Error al crear extracción',
        message: error.message
      });
    }
  }

  // Método no permitido
  return res.status(405).json({ error: 'Método no permitido' });
}
