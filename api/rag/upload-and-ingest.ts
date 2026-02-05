/**
 * RAG UPLOAD AND INGEST ENDPOINT
 * api/rag/upload-and-ingest.ts
 *
 * Endpoint simplificado para:
 * 1. Guardar documento en BD (sin extracción de campos)
 * 2. Ingestar automáticamente al sistema RAG
 *
 * POST /api/rag/upload-and-ingest
 * Body: { filename, fileBase64, fileType, fileSizeBytes }
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

// Extraer texto de PDF usando una llamada simple a Gemini
async function extractTextFromPdf(base64Data: string, mimeType: string): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('API key no configurada');

  const client = new GoogleGenAI({ apiKey });

  const result = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: 'Extrae TODO el texto de este documento. Devuelve solo el texto plano, sin formateo ni comentarios adicionales.' }
        ]
      }
    ]
  });

  return result.text || '';
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

    // 2. Guardar referencia en extraction_results (para mantener compatibilidad)
    const docResult = await sql`
      INSERT INTO extraction_results (
        user_id, filename, extracted_data, model_used,
        pdf_blob_url, file_type, file_size_bytes,
        confidence_score, validation_status, folder_id
      ) VALUES (
        ${auth.userId}::uuid,
        ${filename},
        ${{ _ragDocument: true, _noExtraction: true }}::jsonb,
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

    // 3. Extraer texto del PDF
    console.log(`📝 [RAG Upload] Extrayendo texto...`);
    const extractedText = await extractTextFromPdf(fileBase64, fileType || 'application/pdf');

    if (!extractedText || extractedText.trim().length < 10) {
      console.warn(`⚠️ [RAG Upload] Poco texto extraído de ${filename}`);
    }

    // 4. Ingestar al sistema RAG
    console.log(`🔄 [RAG Upload] Ingesta en curso...`);
    const ingestResult = await ingestDocument(
      documentId,
      filename,
      extractedText,
      auth.userId,
      { originalUrl: blob.url, fileType }
    );

    console.log(`✅ [RAG Upload] Ingesta completada: ${ingestResult.chunksCreated} chunks`);

    return res.status(200).json({
      success: true,
      documentId,
      filename,
      folderId: resolvedFolderId,
      blobUrl: blob.url,
      ingestion: {
        chunksCreated: ingestResult.chunksCreated,
        vectorsUploaded: ingestResult.vectorsUploaded
      },
      message: `Documento "${filename}" listo para consultas`
    });

  } catch (error: any) {
    console.error('[RAG Upload] Error:', error);
    return res.status(500).json({
      error: 'Error procesando documento',
      message: error.message
    });
  }
}
