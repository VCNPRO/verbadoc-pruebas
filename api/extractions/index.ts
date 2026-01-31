/**
 * API ENDPOINT: /api/extractions
 * Maneja CRUD de extracciones de formularios FUNDAE
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { sql } from '@vercel/postgres';

// Import con extensión .js explícita para Vercel serverless
import { ExtractionResultDB } from '../lib/extractionDB.js';
import ValidationService from '../_lib/validationService.js';
import EmailService from '../_lib/emailService.js';
import { AccessLogDB } from '../lib/access-log.js';
import { calculateConfidenceScore } from '../_lib/confidenceService.js';
import { verifyExtraction, mergeWithVerification, type VerificationResult } from '../_lib/doubleVerificationService.js';
import { loadCityCodesCatalog } from '../_lib/cityCodes.js';

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
              COUNT(*) FILTER (WHERE e.validation_errors_count > 0 OR e.validation_status = 'needs_review') as needs_review,
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

  // POST /api/extractions - Crear nueva extracción
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

      // Validar campos requeridos
      if (!filename || !extractedData || !modelUsed) {
        return res.status(400).json({
          error: 'Faltan campos requeridos: filename, extractedData, modelUsed'
        });
      }

      // =====================================================
      // PRE-VALIDACIÓN: Verificar campos críticos FUNDAE
      // =====================================================
      console.log('🔍 Pre-validación: Verificando campos críticos FUNDAE...');

      // Asegurar que extractedData sea un objeto
      const dataObj = typeof extractedData === 'string' ? JSON.parse(extractedData) : extractedData;

      // 🔥 NORMALIZACIÓN DE CAMPOS: Buscar campos por múltiples patrones
      // Esto permite que plantillas con nombres como "1. Nº expediente" funcionen
      const findFieldValue = (obj: any, patterns: string[]): string => {
        // Primero buscar por nombre exacto
        for (const pattern of patterns) {
          if (obj[pattern]) return String(obj[pattern]).trim();
        }
        // Luego buscar por coincidencia parcial (case-insensitive)
        const keys = Object.keys(obj);
        for (const pattern of patterns) {
          const patternLower = pattern.toLowerCase();
          const matchingKey = keys.find(k => k.toLowerCase().includes(patternLower));
          if (matchingKey && obj[matchingKey]) {
            return String(obj[matchingKey]).trim();
          }
        }
        return '';
      };

      const rawExpediente = findFieldValue(dataObj, ['numero_expediente', 'expediente', 'nº expediente', 'n expediente', 'num_expediente']);
      const rawAccion = findFieldValue(dataObj, ['numero_accion', 'accion', 'nº acción', 'nº accion', 'n accion', 'num_accion']);
      const rawGrupo = findFieldValue(dataObj, ['numero_grupo', 'grupo', 'nº grupo', 'n grupo', 'num_grupo']);

      console.log(`🔍 Campos extraídos: expediente="${rawExpediente}", accion="${rawAccion}", grupo="${rawGrupo}"`);

      // 🔥 NORMALIZAR: Asegurar que los campos estén con nombres estándar
      if (rawExpediente && !dataObj.numero_expediente) dataObj.numero_expediente = rawExpediente;
      if (rawAccion && !dataObj.numero_accion) dataObj.numero_accion = rawAccion;
      if (rawGrupo && !dataObj.numero_grupo) dataObj.numero_grupo = rawGrupo;

      // 1. Verificar que existan los campos críticos
      const missingFields: string[] = [];
      if (!rawExpediente) missingFields.push('Nº Expediente');
      if (!rawAccion) missingFields.push('Nº Acción');
      if (!rawGrupo) missingFields.push('Nº Grupo');

      if (missingFields.length > 0) {
        console.log('❌ Pre-validación: Faltan campos críticos:', missingFields);

        // Registrar como no procesable y obtener el ID
        let unprocessableId = null;
        try {
          const result = await sql`
            INSERT INTO unprocessable_documents (
              user_id, filename, rejection_category, rejection_reason,
              extracted_data, numero_expediente, numero_accion, numero_grupo,
              file_size_bytes, file_type, pdf_blob_url
            ) VALUES (
              ${user.userId}::UUID,
              ${filename}::VARCHAR,
              'campos_faltantes'::VARCHAR,
              ${`Faltan campos críticos: ${missingFields.join(', ')}`}::TEXT,
              ${JSON.stringify(dataObj)}::JSONB,
              ${rawExpediente || null},
              ${rawAccion || null},
              ${rawGrupo || null},
              ${fileSizeBytes || null},
              ${fileType || 'application/pdf'},
              ${fileUrl || null}
            )
            RETURNING id
          `;
          unprocessableId = result.rows[0]?.id;
          console.log('✅ Documento registrado como no procesable: campos_faltantes, ID:', unprocessableId);
        } catch (unprocessableError) {
          console.error('⚠️ Error al registrar no procesable:', unprocessableError);
        }

        return res.status(422).json({
          error: 'Documento no procesable',
          reason: `Faltan campos críticos: ${missingFields.join(', ')}`,
          category: 'campos_faltantes',
          missingFields,
          canProcess: false,
          unprocessableId // ID para subir el PDF
        });
      }

      // 2. Buscar en reference_data - BÚSQUEDA EN 2 PASOS (SOLUCIÓN DEFINITIVA)
      console.log('🔍 Buscando en reference_data:', { rawExpediente, rawAccion, rawGrupo });

      // PASO 1: Obtener TODAS las filas con el mismo expediente
      const allExpedienteRows = await sql`
        SELECT * FROM reference_data
        WHERE is_active = true
        AND UPPER(TRIM(data->>'numero_expediente')) = UPPER(TRIM(${rawExpediente}))
      `;

      console.log(`📊 Encontradas ${allExpedienteRows.rows.length} filas con expediente ${rawExpediente}`);

      // 🔥 DEBUG: Mostrar todas las filas encontradas
      for (let i = 0; i < allExpedienteRows.rows.length; i++) {
        const row = allExpedienteRows.rows[i];
        console.log(`   Fila ${i + 1}: Acción="${row.data?.d_cod_accion_formativa}" Grupo="${row.data?.d_cod_grupo}"`);

        // 🔥 DEBUG: Mostrar TODOS los campos disponibles que contengan "grupo" o "cod"
        const allKeys = Object.keys(row.data || {});
        const relevantKeys = allKeys.filter(k =>
          k.toLowerCase().includes('grupo') ||
          k.toLowerCase().includes('cod') ||
          k.toLowerCase().includes('accion')
        );
        console.log(`   📋 Campos disponibles con 'grupo/cod/accion':`, relevantKeys);
      }

      if (allExpedienteRows.rows.length === 0) {
        console.log('❌ Expediente no encontrado en Excel de referencia');

        let unprocessableId = null;
        try {
          const result = await sql`
            INSERT INTO unprocessable_documents (
              user_id, filename, rejection_category, rejection_reason,
              extracted_data, numero_expediente, numero_accion, numero_grupo,
              file_size_bytes, file_type, pdf_blob_url
            ) VALUES (
              ${user.userId}::UUID,
              ${filename}::VARCHAR,
              'sin_referencia'::VARCHAR,
              ${'Expediente no existe en Excel de referencia: ' + rawExpediente}::TEXT,
              ${JSON.stringify(dataObj)}::JSONB,
              ${rawExpediente},
              ${rawAccion || null},
              ${rawGrupo || null},
              ${fileSizeBytes || null},
              ${fileType || 'application/pdf'},
              ${fileUrl || null}
            )
            RETURNING id
          `;
          unprocessableId = result.rows[0]?.id;
          console.log('✅ Documento registrado como no procesable: sin_referencia (expediente no existe), ID:', unprocessableId);
        } catch (unprocessableError) {
          console.error('⚠️ Error al registrar no procesable:', unprocessableError);
        }

        return res.status(422).json({
          error: 'Documento no procesable',
          reason: 'Expediente no existe en Excel de referencia',
          category: 'sin_referencia',
          canProcess: false,
          unprocessableId,
          extractedData: {
            expediente: rawExpediente,
            accion: rawAccion,
            grupo: rawGrupo
          }
        });
      }

      // PASO 2: Buscar cuál fila coincide con Acción Y Grupo
      const cleanAccion = rawAccion.replace(/^(as*-s*|a|accions*)/i, '').trim();
      const cleanGrupo = rawGrupo.replace(/^(gs*-s*|g|grupos*)/i, '').trim();
      const paddedAccion = cleanAccion.padStart(3, '0');
      const paddedGrupo = cleanGrupo.padStart(2, '0');

      console.log('🔍 Buscando coincidencia exacta con:', { cleanAccion, cleanGrupo, paddedAccion, paddedGrupo });

      const matchesAccion = (row: any) => {
        // 🔥 CRÍTICO: Buscar en mayúsculas Y minúsculas
        const dataAccion = row.data?.d_cod_accion_formativa || row.data?.D_COD_ACCION_FORMATIVA || row.data?.id_accion_formativa || '';
        const dataAccionStr = String(dataAccion).trim();

        // 🔥 CRÍTICO: Extraer SOLO números (obviar letras "a", "a-", etc.)
        const accionNumeros = dataAccionStr.replace(/[^\d]/g, '');

        // 🔥 DEBUG: Log para ver qué está comparando
        const matches = accionNumeros === cleanAccion || accionNumeros === paddedAccion;
        console.log(`   📊 Acción: "${dataAccionStr}" → números: "${accionNumeros}" vs PDF: "${cleanAccion}"/"${paddedAccion}" → ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);

        // Comparar solo números
        return matches;
      };

      const matchesGrupo = (row: any) => {
        // 🔥 CRÍTICO: Buscar en D_COD_GRUPO (columna F) en mayúsculas Y minúsculas
        const dCodGrupo = row.data?.d_cod_grupo || row.data?.D_COD_GRUPO || row.data?.codigo_grupo_detalle || row.data?.num_grupo || '';
        const dataGrupoStr = String(dCodGrupo).trim();

        // 🔥 CRÍTICO: Extraer SOLO números (obviar letras "g", "g-", etc.)
        const grupoNumeros = dataGrupoStr.replace(/[^\d]/g, '');

        // 🔥 DEBUG: Log para ver qué está comparando
        const matches = grupoNumeros === cleanGrupo || grupoNumeros === paddedGrupo;
        console.log(`   📊 Grupo: "${dataGrupoStr}" → números: "${grupoNumeros}" vs PDF: "${cleanGrupo}"/"${paddedGrupo}" → ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);

        // Comparar solo números
        return matches;
      };

      let matchingRow = null;
      for (const row of allExpedienteRows.rows) {
        if (matchesAccion(row) && matchesGrupo(row)) {
          matchingRow = row;
          console.log('✅ Encontrada coincidencia exacta en fila:', row.id);
          break;
        }
      }

      let referenceData = null;
      let isUnprocessable = false;
      let rejectionReason = null;

      if (!matchingRow) {
        console.log('⚠️ Pre-validación: Expediente existe pero no coinciden Acción/Grupo');
        isUnprocessable = true;
        rejectionReason = `Expediente existe pero no coinciden los campos. Expediente: ${rawExpediente}, Acción: ${rawAccion} (esperada), Grupo: ${rawGrupo} (esperado)`;

        let unprocessableId = null;
        try {
          const result = await sql`
            INSERT INTO unprocessable_documents (
              user_id, filename, rejection_category, rejection_reason,
              extracted_data, numero_expediente, numero_accion, numero_grupo,
              file_size_bytes, file_type, pdf_blob_url
            ) VALUES (
              ${user.userId}::UUID,
              ${filename}::VARCHAR,
              'sin_referencia'::VARCHAR,
              ${rejectionReason}::TEXT,
              ${JSON.stringify(dataObj)}::JSONB,
              ${rawExpediente},
              ${rawAccion},
              ${rawGrupo},
              ${fileSizeBytes || null},
              ${fileType || 'application/pdf'},
              ${fileUrl || null}
            )
            RETURNING id
          `;
          unprocessableId = result.rows[0]?.id;
          console.log('✅ Documento registrado como no procesable: sin_referencia, ID:', unprocessableId);
        } catch (unprocessableError) {
          console.error('⚠️ Error al registrar no procesable:', unprocessableError);
        }

        return res.status(422).json({
          error: 'Documento no procesable',
          reason: rejectionReason,
          category: 'sin_referencia',
          canProcess: false,
          unprocessableId,
          extractedData: {
            expediente: rawExpediente,
            accion: rawAccion,
            grupo: rawGrupo
          }
        });
      } else {
        console.log('✅ Pre-validación: Documento encontrado en Excel de referencia');
        referenceData = matchingRow.data;
        
        const officialCif = referenceData.nif_empresa || referenceData.cif;
        const officialRazonSocial = referenceData.razon_social || referenceData.empresa || referenceData.d_entidad;
        
        dataObj.cif_empresa = officialCif;
        dataObj.razon_social = officialRazonSocial;
        dataObj.numero_expediente = referenceData.numero_expediente;
      }

      // 3. Traducción de ciudades... (el resto sigue igual)
      try {
        const cityCatalog = loadCityCodesCatalog();
        const extractedCity = String(dataObj.ciudad || dataObj.poblacion || '').toUpperCase().trim();

        if (extractedCity && cityCatalog[extractedCity]) {
          dataObj.ciudad = cityCatalog[extractedCity];
          if (dataObj.poblacion) dataObj.poblacion = cityCatalog[extractedCity];
        }
      } catch (cityError) {}

      // =====================================================
      // 4. DETECCIÓN DE FORMULARIOS INCOMPLETOS
      // =====================================================
      // Lista de TODOS los campos esperados en un formulario FUNDAE completo
      const CAMPOS_ESPERADOS = [
        // Campos de cabecera
        'numero_expediente', 'perfil', 'cif_empresa', 'numero_accion', 'numero_grupo',
        'denominacion_aaff', 'modalidad',
        // Datos personales
        'edad', 'sexo', 'lugar_trabajo', 'titulacion_codigo', 'categoria_profesional',
        'horario_curso', 'porcentaje_jornada', 'tamano_empresa',
        // Valoraciones página 2
        'valoracion_1_1', 'valoracion_1_2',
        'valoracion_2_1', 'valoracion_2_2',
        'valoracion_3_1', 'valoracion_3_2',
        'valoracion_4_1_formadores', 'valoracion_4_1_tutores',
        'valoracion_4_2_formadores', 'valoracion_4_2_tutores',
        'valoracion_5_1', 'valoracion_5_2',
        'valoracion_6_1', 'valoracion_6_2',
        'valoracion_7_1', 'valoracion_7_2',
        'valoracion_8_1', 'valoracion_8_2',
        'valoracion_9_1', 'valoracion_9_2', 'valoracion_9_3', 'valoracion_9_4', 'valoracion_9_5',
        'valoracion_10',
        // Pregunta final
        'recomendaria_curso',
        // Campos finales
        'fecha_cumplimentacion', 'sugerencias'
      ];

      // Detectar campos que NO EXISTEN en la extracción (no confundir con NC)
      // Un campo "no existe" si no está presente como key en el objeto extraído
      const camposFaltantes = CAMPOS_ESPERADOS.filter(field => {
        return !(field in dataObj);
      });

      const totalCamposEsperados = CAMPOS_ESPERADOS.length;
      const camposExtraidos = totalCamposEsperados - camposFaltantes.length;
      const porcentajeFaltantes = (camposFaltantes.length / totalCamposEsperados) * 100;

      console.log(`📋 Campos extraídos: ${camposExtraidos}/${totalCamposEsperados} (faltan ${camposFaltantes.length})`);

      // Si falta CUALQUIER campo, el formulario está físicamente incompleto
      if (camposFaltantes.length > 0) {
        console.log(`⚠️ Formulario INCOMPLETO detectado: faltan ${camposFaltantes.length} campos`);
        console.log(`   Campos faltantes: ${camposFaltantes.slice(0, 10).join(', ')}${camposFaltantes.length > 10 ? '...' : ''}`);

        let unprocessableId = null;
        try {
          const result = await sql`
            INSERT INTO unprocessable_documents (
              user_id, filename, rejection_category, rejection_reason,
              extracted_data, numero_expediente, numero_accion, numero_grupo,
              file_size_bytes, file_type, pdf_blob_url
            ) VALUES (
              ${user.userId}::UUID,
              ${filename}::VARCHAR,
              'incompleto'::VARCHAR,
              ${`Formulario físicamente incompleto: faltan ${camposFaltantes.length} de ${totalCamposEsperados} campos (${Math.round(porcentajeFaltantes)}%). Campos no encontrados: ${camposFaltantes.slice(0, 8).join(', ')}${camposFaltantes.length > 8 ? '...' : ''}`}::TEXT,
              ${JSON.stringify(dataObj)}::JSONB,
              ${rawExpediente},
              ${rawAccion || null},
              ${rawGrupo || null},
              ${fileSizeBytes || null},
              ${fileType || 'application/pdf'},
              ${fileUrl || null}
            )
            RETURNING id
          `;
          unprocessableId = result.rows[0]?.id;
          console.log(`✅ Documento registrado como no procesable: incompleto, ID:`, unprocessableId);
        } catch (unprocessableError) {
          console.error('⚠️ Error al registrar no procesable:', unprocessableError);
        }

        return res.status(422).json({
          error: 'Documento no procesable',
          reason: `Formulario físicamente incompleto - faltan ${camposFaltantes.length} campos`,
          category: 'incompleto',
          canProcess: false,
          unprocessableId,
          extractedData: {
            expediente: rawExpediente,
            accion: rawAccion,
            grupo: rawGrupo,
            camposExtraidos: camposExtraidos,
            totalCamposEsperados: totalCamposEsperados,
            camposFaltantes: camposFaltantes
          }
        });
      }

      // 🔒 DOBLE VERIFICACIÓN (si se proporcionaron datos de verificación)
      let verificationResult: VerificationResult | null = null;
      if (verificationData && typeof verificationData === 'object') {
        console.log('🔒 Ejecutando DOBLE VERIFICACIÓN de campos críticos...');
        verificationResult = verifyExtraction(dataObj, verificationData);
        console.log(`🔒 Verificación: ${verificationResult.verified ? '✅ EXITOSA' : '⚠️ DISCREPANCIAS'}`);
        console.log(`   Campos coincidentes: ${verificationResult.matchingFields.join(', ') || 'ninguno'}`);

        if (verificationResult.discrepantFields.length > 0) {
          console.log(`   ⚠️ Discrepancias detectadas:`);
          for (const d of verificationResult.discrepantFields) {
            console.log(`      ${d.field}: original="${d.original}" vs verificación="${d.verification}"`);
          }

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

      // 🎯 CALCULAR CONFIANZA REAL (no usar el valor pasado desde cliente)
      console.log('📊 Calculando confidence_score REAL...');
      const confidenceResult = calculateConfidenceScore(dataObj);

      // Ajustar confianza si hay discrepancias de verificación
      let realConfidenceScore = confidenceResult.score;
      if (verificationResult && !verificationResult.verified) {
        // Reducir confianza si hay discrepancias no resueltas
        const penalty = verificationResult.discrepantFields.length * 0.1;
        realConfidenceScore = Math.max(0.3, realConfidenceScore - penalty);
        console.log(`📊 Confianza ajustada por discrepancias: ${Math.round(realConfidenceScore * 100)}%`);
      }

      console.log(`📊 Confianza final: ${Math.round(realConfidenceScore * 100)}% (${confidenceResult.level})`);
      if (confidenceResult.details.missingCritical.length > 0) {
        console.log(`   ⚠️ Campos críticos faltantes: ${confidenceResult.details.missingCritical.join(', ')}`);
      }
      if (confidenceResult.details.invalidFormats.length > 0) {
        console.log(`   ⚠️ Formatos inválidos: ${confidenceResult.details.invalidFormats.join(', ')}`);
      }

      // Crear extracción en BD con confianza REAL
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
        confidenceScore: realConfidenceScore // 🎯 Score REAL calculado
      });

      console.log('✅ Extracción creada:', extraction.id);

      // Ejecutar validación automática
      let validationResult = { executed: false, totalErrors: 0, criticalErrors: 0, errors: [] as any[] };
      let masterExcelRowId = null;

      try {
        console.log('🔍 Ejecutando validación automática...');
        const { errors, criticalCount } = await ValidationService.validateAndSave(
          extraction.id,
          dataObj
        );

        // Si falló la pre-validación de referencia, añadir ese error manualmente
        let finalCriticalCount = criticalCount;
        if (isUnprocessable) {
          await sql`
            INSERT INTO validation_errors (
              extraction_id, field_name, error_type, error_message, severity, status
            ) VALUES (
              ${extraction.id}, 'numero_expediente', 'sin_referencia', ${rejectionReason}, 'critical', 'pending'
            )
          `;
          finalCriticalCount++;
        }

        // Actualizar estado
        // LÓGICA FUNDAE: Si campos básicos OK pero hay errores → Revisión
        const basicFieldPatterns = ['expediente', 'accion', 'grupo'];
        const basicFieldsOK = basicFieldPatterns.every(pattern => {
          const matchingField = Object.keys(dataObj).find(key =>
            key.toLowerCase().includes(pattern)
          );
          if (!matchingField) return false;
          const value = dataObj[matchingField];
          return value && value !== '' && value !== null && value !== undefined;
        });

        let newStatus: 'valid' | 'needs_review' | 'pending' = 'valid';

        // Si campos básicos OK y hay errores → Revisión
        if (basicFieldsOK && errors.length > 0) {
          newStatus = 'needs_review';
        }
        // Si hay errores críticos → Revisión
        else if (finalCriticalCount > 0) {
          newStatus = 'needs_review';
        }
        // Si hay errores pero campos básicos fallan → Pending
        else if (errors.length > 0) {
          newStatus = 'pending';
        }

        // Si el formulario es horizontal (landscape), forzar revisión
        if (dataObj._landscape === true && newStatus === 'valid') {
          newStatus = 'needs_review';
          console.log('[validacion] Formulario horizontal detectado → needs_review');
        }

        console.log(`📊 Validación: ${errors.length} errores, campos básicos OK: ${basicFieldsOK}, estado: ${newStatus}`);

        await ExtractionResultDB.update(extraction.id, {
          status: newStatus,
          rejectionReason: isUnprocessable ? rejectionReason : undefined,
          validationErrorsCount: errors.length
        });

        // Solo añadir al Excel Master si es realmente VÁLIDO (con referencia)
        if (newStatus === 'valid' && !isUnprocessable) {
          try {
            const addRowResult = await sql`
              SELECT add_master_excel_row(
                ${user.userId}::UUID,
                ${extraction.id}::UUID,
                ${JSON.stringify(dataObj)}::JSONB,
                ${filename},
                'approved',
                true,
                0
              ) as new_id
            `;
            masterExcelRowId = addRowResult.rows[0].new_id;
          } catch (excelError: any) {
            console.error('⚠️ Error al añadir al Excel master:', excelError.message);
          }
        }

        validationResult = {
          executed: true,
          totalErrors: errors.length + (isUnprocessable ? 1 : 0),
          criticalErrors: finalCriticalCount,
          errors: errors.slice(0, 5)
        };
      } catch (validationError) {
        console.error('⚠️ Error en validación:', validationError);
      }

      // --- TRACKING: Incrementar total_extractions por campo ---
      try {
        const fieldNames = Object.keys(dataObj).filter(k => !k.startsWith('_'));
        for (const fieldName of fieldNames) {
          await sql`
            INSERT INTO field_correction_stats (field_name, total_extractions, updated_at)
            VALUES (${fieldName}, 1, NOW())
            ON CONFLICT (field_name)
            DO UPDATE SET
              total_extractions = field_correction_stats.total_extractions + 1,
              updated_at = NOW()
          `;
        }
        console.log(`📊 Tracking: ${fieldNames.length} campos registrados en field_correction_stats`);
      } catch (trackingError) {
        console.error('⚠️ Error en tracking (no afecta extracción):', trackingError);
      }

      return res.status(201).json({
        success: true,
        extraction,
        masterExcelRowId,
        validation: validationResult,
        confidence: {
          score: realConfidenceScore,
          percentage: Math.round(realConfidenceScore * 100),
          level: realConfidenceScore >= 0.85 ? 'high' : realConfidenceScore >= 0.65 ? 'medium' : 'low',
          recommendation: confidenceResult.recommendation
        },
        verification: verificationResult ? {
          verified: verificationResult.verified,
          matchingFields: verificationResult.matchingFields,
          discrepancies: verificationResult.discrepantFields.length,
          confidence: verificationResult.confidence
        } : null
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
