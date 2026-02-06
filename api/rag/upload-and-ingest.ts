/**
 * RAG UPLOAD AND INGEST ENDPOINT
 * api/rag/upload-and-ingest.ts
 *
 * Endpoint simplificado para:
 * 1. Guardar documento en BD (sin extraccion de campos)
 * 2. Ingestar automaticamente al sistema RAG
 *
 * Soporta PDFs, imagenes (JPEG, PNG, TIFF) y texto.
 * Para imagenes: analisis visual + OCR combinados.
 *
 * POST /api/rag/upload-and-ingest
 * Body: { filename, fileBase64, fileType, fileSizeBytes, folderId?, folderName? }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import { put } from '@vercel/blob';
import { ingestDocument } from '../lib/ragService.js';

// Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return { userId: decoded.id || decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

// Tipos de imagen soportados
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/webp', 'image/gif', 'image/bmp'];

function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType.toLowerCase());
}

// Extraer contenido de un archivo usando Gemini (PDFs e imagenes)
async function extractContent(base64Data: string, mimeType: string): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('API key no configurada');

  const client = new GoogleGenAI({ apiKey });

  // Prompt diferente segun tipo de archivo
  const isImage = isImageMimeType(mimeType);

  const prompt = isImage
    ? `Analiza esta imagen en detalle. Realiza las dos tareas siguientes y devuelve el resultado como texto plano continuo:

1. DESCRIPCION VISUAL: Describe detalladamente todo lo que ves en la imagen: personas (edad aproximada, vestimenta, posicion), objetos, entorno, colores, epoca estimada, estado de la imagen, y cualquier elemento relevante.

2. TEXTO VISIBLE (OCR): Si hay texto visible en la imagen (carteles, documentos, inscripciones, fechas, nombres, pies de foto, sellos, etiquetas), transcribelo literalmente.

Combina ambas partes en un texto continuo y descriptivo. No uses listas ni formato markdown. Escribe en espanol.`
    : 'Extrae TODO el texto de este documento. Devuelve solo el texto plano, sin formateo ni comentarios adicionales.';

  const result = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      }
    ]
  });

  // Extraer texto de forma segura (result.text puede lanzar si la respuesta es bloqueada)
  try {
    return result.text || '';
  } catch {
    // Fallback: extraer de candidates directamente
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || '';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigins = ['https://www.verbadocpro.eu', 'https://verbadoc-europa-pro.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Verificar autenticación
  const auth = verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { filename, fileBase64, fileType, fileSizeBytes, folderId, folderName, transcription, extractionId } = req.body;

    // ==================== FLUJO B: extractionId sin fileBase64 ====================
    // Viene de EnhancedResultsPage: asignar carpeta a extraccion existente + ingestar si falta
    if (extractionId && !fileBase64) {
      console.log(`📂 [RAG Upload] Flujo B: asignar carpeta a extraccion ${extractionId}`);

      // Validar si extractionId es UUID valido (los IDs locales son "hist-..." y no son UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUuid = uuidRegex.test(extractionId);

      // 1. Buscar extraccion en BD (por UUID o por filename como fallback)
      let existing;
      if (isValidUuid) {
        existing = await sql`
          SELECT id, filename, extracted_data, user_id
          FROM extraction_results
          WHERE id = ${extractionId}::uuid AND user_id = ${auth.userId}::uuid
          LIMIT 1
        `;
      }

      // Fallback: buscar por filename si el ID no es UUID o no se encontro
      if ((!existing || existing.rows.length === 0) && filename) {
        console.log(`[RAG Upload] Flujo B: buscando por filename "${filename}"`);
        // Busqueda exacta primero
        existing = await sql`
          SELECT id, filename, extracted_data, user_id
          FROM extraction_results
          WHERE filename = ${filename} AND user_id = ${auth.userId}::uuid
          ORDER BY created_at DESC
          LIMIT 1
        `;

        // Si no encuentra, buscar con ILIKE (case insensitive, parcial)
        if (existing.rows.length === 0) {
          console.log(`[RAG Upload] Flujo B: busqueda exacta fallida, probando ILIKE...`);
          existing = await sql`
            SELECT id, filename, extracted_data, user_id
            FROM extraction_results
            WHERE filename ILIKE ${'%' + filename + '%'} AND user_id = ${auth.userId}::uuid
            ORDER BY created_at DESC
            LIMIT 1
          `;
        }
      }

      if (!existing || existing.rows.length === 0) {
        console.log(`[RAG Upload] Flujo B: documento no encontrado para extractionId=${extractionId}, filename=${filename}`);
        return res.status(404).json({
          error: 'Documento no encontrado en la base de datos.',
          details: 'Este documento aun no ha sido procesado. Primero extrae el documento o subelo directamente a la Biblioteca RAG desde el Lote de documentos.'
        });
      }

      const extraction = existing.rows[0];
      const realDocId = extraction.id;

      // 2. Resolver folder_id (crear carpeta si folderName)
      let resolvedFolderId: string | null = folderId || null;

      if (!resolvedFolderId && folderName && typeof folderName === 'string' && folderName.trim()) {
        const trimmedName = folderName.trim();
        const existingFolder = await sql`
          SELECT id FROM rag_folders
          WHERE user_id = ${auth.userId}::uuid AND name = ${trimmedName}
          LIMIT 1
        `;

        if (existingFolder.rows.length > 0) {
          resolvedFolderId = existingFolder.rows[0].id;
        } else {
          const newFolder = await sql`
            INSERT INTO rag_folders (user_id, name)
            VALUES (${auth.userId}::uuid, ${trimmedName})
            RETURNING id
          `;
          resolvedFolderId = newFolder.rows[0].id;
        }
      }

      // 3. Asignar folder_id a la extraccion
      if (resolvedFolderId) {
        try {
          await sql`
            UPDATE extraction_results SET folder_id = ${resolvedFolderId}::uuid
            WHERE id = ${realDocId}::uuid
          `;
        } catch (folderErr: any) {
          console.warn(`[RAG Upload] No se pudo asignar folder_id: ${folderErr.message}`);
        }
      }

      // 4. Comprobar si ya esta ingested
      const embeddingsCount = await sql`
        SELECT COUNT(*) as cnt FROM rag_embeddings WHERE document_id = ${realDocId}::uuid
      `;
      const alreadyIngested = parseInt(embeddingsCount.rows[0].cnt) > 0;

      if (!alreadyIngested) {
        // Extraer texto de extracted_data (puede ser transcripción, descripción, o datos extraídos)
        const extractedData = extraction.extracted_data;
        let textToIngest = '';
        if (typeof extractedData === 'object' && extractedData !== null) {
          // Prioridad: transcription > description > JSON stringificado
          textToIngest = extractedData.transcription || extractedData.description || JSON.stringify(extractedData);
        } else if (typeof extractedData === 'string') {
          textToIngest = extractedData;
        }

        if (textToIngest && textToIngest.trim().length > 10) {
          await ingestDocument(
            realDocId,
            extraction.filename || 'documento',
            textToIngest,
            auth.userId
          );
          console.log(`✅ [RAG Upload] Flujo B: ingesta completada para ${realDocId}`);
        }
      }

      return res.status(200).json({
        success: true,
        documentId: realDocId,
        folderId: resolvedFolderId,
        message: `Documento asociado a carpeta correctamente`
      });
    }

    // ==================== FLUJO A: subida normal con fileBase64 ====================
    if (!filename || !fileBase64) {
      return res.status(400).json({ error: 'Faltan campos: filename, fileBase64' });
    }

    console.log(`📄 [RAG Upload] Procesando: ${filename}`);

    // Resolver folder_id
    let resolvedFolderId: string | null = folderId || null;

    if (!resolvedFolderId && folderName && typeof folderName === 'string' && folderName.trim()) {
      const trimmedName = folderName.trim();
      const existing = await sql`
        SELECT id FROM rag_folders
        WHERE user_id = ${auth.userId}::uuid AND name = ${trimmedName}
        LIMIT 1
      `;

      if (existing.rows.length > 0) {
        resolvedFolderId = existing.rows[0].id;
      } else {
        const newFolder = await sql`
          INSERT INTO rag_folders (user_id, name)
          VALUES (${auth.userId}::uuid, ${trimmedName})
          RETURNING id
        `;
        resolvedFolderId = newFolder.rows[0].id;
      }
    }

    // 1. Subir archivo a Vercel Blob
    const buffer = Buffer.from(fileBase64, 'base64');
    const blob = await put(`rag-documents/${auth.userId}/${Date.now()}-${filename}`, buffer, {
      access: 'public',
      contentType: fileType || 'application/pdf'
    });

    console.log(`✅ [RAG Upload] Archivo subido: ${blob.url}`);

    // 2. Extraer contenido ANTES de guardar (texto para PDFs, descripcion visual + OCR para imagenes)
    const isImage = isImageMimeType(fileType || '');
    console.log(`[RAG Upload] Extrayendo contenido (${isImage ? 'imagen' : 'documento'})...`);

    let extractedText = '';
    if (transcription && typeof transcription === 'string' && transcription.trim().length > 10) {
      extractedText = transcription;
      console.log(`[RAG Upload] Usando transcripcion previa: ${extractedText.length} chars`);
    } else {
      try {
        extractedText = await extractContent(fileBase64, fileType || 'application/pdf');
        console.log(`[RAG Upload] Contenido extraido: ${extractedText?.length || 0} chars`);
      } catch (extractError: any) {
        console.error(`[RAG Upload] Error extrayendo contenido: ${extractError.message}`);
        extractedText = `[Error de extraccion: ${extractError.message}]`;
      }
    }

    if (!extractedText || extractedText.trim().length < 10) {
      console.warn(`[RAG Upload] Poco contenido extraido de ${filename} (${extractedText?.length || 0} chars)`);
    }

    // 3. Guardar referencia en extraction_results CON la descripcion generada
    const extractedDataObj = {
      _ragDocument: true,
      description: extractedText || '',
      isImage,
      blobUrl: blob.url
    };

    // INSERT sin folder_id (puede no existir la columna)
    const docResult = await sql`
      INSERT INTO extraction_results (
        user_id, filename, extracted_data, model_used,
        pdf_blob_url, file_type, file_size_bytes,
        confidence_score, validation_status
      ) VALUES (
        ${auth.userId}::uuid,
        ${filename},
        ${extractedDataObj}::jsonb,
        'rag-direct',
        ${blob.url},
        ${fileType || 'application/pdf'},
        ${fileSizeBytes || buffer.length},
        1.0,
        'valid'
      )
      RETURNING id
    `;

    // Intentar asignar folder_id si la columna existe
    if (resolvedFolderId) {
      try {
        await sql`
          UPDATE extraction_results SET folder_id = ${resolvedFolderId}::uuid
          WHERE id = ${docResult.rows[0].id}::uuid
        `;
      } catch (folderErr: any) {
        console.warn(`[RAG Upload] No se pudo asignar folder_id (columna puede no existir): ${folderErr.message}`);
      }
    }

    const documentId = docResult.rows[0].id;
    console.log(`✅ [RAG Upload] Documento guardado: ${documentId}`);

    // 4. Ingestar al sistema RAG
    console.log(`[RAG Upload] Ingesta en curso...`);
    const ingestResult = await ingestDocument(
      documentId,
      filename,
      extractedText,
      auth.userId,
      { originalUrl: blob.url, fileType, isImage }
    );

    console.log(`✅ [RAG Upload] Ingesta completada: ${ingestResult.chunksCreated} chunks`);

    return res.status(200).json({
      success: true,
      documentId,
      filename,
      folderId: resolvedFolderId,
      blobUrl: blob.url,
      description: extractedText,
      isImage,
      ingestion: {
        chunksCreated: ingestResult.chunksCreated,
        vectorsUploaded: ingestResult.vectorsUploaded
      },
      message: `Documento "${filename}" listo para consultas`
    });

  } catch (error: any) {
    console.error('[RAG Upload] Error completo:', error.message, error.stack?.substring(0, 500));
    return res.status(500).json({
      error: `Error procesando documento: ${error.message}`,
      message: error.message
    });
  }
}
