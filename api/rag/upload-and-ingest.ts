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
    const { filename, fileBase64, fileType, fileSizeBytes, folderId, folderName } = req.body;

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
    try {
      extractedText = await extractContent(fileBase64, fileType || 'application/pdf');
      console.log(`[RAG Upload] Contenido extraido: ${extractedText?.length || 0} chars`);
    } catch (extractError: any) {
      console.error(`[RAG Upload] Error extrayendo contenido: ${extractError.message}`);
      extractedText = `[Error de extraccion: ${extractError.message}]`;
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

    const docResult = await sql`
      INSERT INTO extraction_results (
        user_id, filename, extracted_data, model_used,
        pdf_blob_url, file_type, file_size_bytes,
        confidence_score, validation_status, folder_id
      ) VALUES (
        ${auth.userId}::uuid,
        ${filename},
        ${extractedDataObj}::jsonb,
        'rag-direct',
        ${blob.url},
        ${fileType || 'application/pdf'},
        ${fileSizeBytes || buffer.length},
        1.0,
        'valid',
        ${resolvedFolderId}::uuid
      )
      RETURNING id
    `;

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
