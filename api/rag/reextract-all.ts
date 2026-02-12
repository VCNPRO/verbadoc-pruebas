/**
 * RAG RE-EXTRACT & RE-INGEST ALL
 * api/rag/reextract-all.ts
 *
 * Endpoint de migración: re-extrae contenido de todos los documentos RAG
 * con los nuevos prompts (marcadores de página, OCR estructurado) y re-ingesta.
 *
 * Soporta ejecución incremental: marca documentos procesados con _reextracted=true
 * y los salta en siguientes ejecuciones.
 *
 * POST /api/rag/reextract-all
 * Body: { dryRun?: boolean, limit?: number, forceAll?: boolean }
 *
 * Ejecutar múltiples veces hasta que pending = 0.
 *
 * Security: Admin only
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import { ingestDocument, deleteByDocumentId } from '../lib/ragService.js';
import { trackGeminiCall } from '../lib/usageTracker.js';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
  maxDuration: 300,
};

// Verificar autenticación admin
function verifyAdmin(req: VercelRequest): { userId: string; role: string } | null {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const role = decoded.role;
    if (role !== 'admin') return null;
    return { userId: decoded.id || decoded.userId, role };
  } catch {
    return null;
  }
}

// Tipos MIME
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/webp', 'image/gif', 'image/bmp'];
const AUDIO_MIME_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'audio/flac', 'audio/x-flac', 'audio/aac',
];

function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes((mimeType || '').toLowerCase());
}
function isAudioMimeType(mimeType: string): boolean {
  return AUDIO_MIME_TYPES.includes((mimeType || '').toLowerCase());
}

// Re-extraer contenido con nuevos prompts
async function reExtractContent(base64Data: string, mimeType: string): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('API key no configurada');

  const client = new GoogleGenAI({ apiKey });
  const isImage = isImageMimeType(mimeType);
  const isAudio = isAudioMimeType(mimeType);

  let prompt: string;

  if (isAudio) {
    prompt = `Transcribe este archivo de audio de forma completa y detallada.

INSTRUCCIONES:
1. Transcribe TODO el contenido hablado del audio, palabra por palabra.
2. Si hay varios interlocutores, identifícalos como "Interlocutor 1:", "Interlocutor 2:", etc.
3. Incluye indicaciones de contexto entre corchetes cuando sea relevante: [musica de fondo], [silencio], [ruido], [risas], etc.
4. Si el audio contiene informacion tecnica, nombres propios o cifras, transcribelos con precision.
5. Al final, incluye un breve resumen del contenido del audio (2-3 frases).

Devuelve el resultado como texto plano. Escribe en el idioma original del audio.`;
  } else if (isImage) {
    prompt = `Analiza esta imagen en detalle. Devuelve el resultado con las siguientes secciones claramente separadas:

[DATOS_VISIBLES]
Transcribe literalmente TODO el texto visible en la imagen: nombres, fechas, codigos, dedicatorias, pies de foto, sellos, etiquetas, inscripciones, numeros, firmas, marcos con texto (muy comun en fotografias antiguas con marco blanco), carteles, documentos visibles, cualquier caracter legible. Si no hay texto visible, escribe "Sin texto visible".

[DESCRIPCION]
Describe detalladamente todo lo que ves en la imagen: personas (edad aproximada, vestimenta, posicion), objetos, entorno, colores, epoca estimada, estado de la imagen, y cualquier elemento relevante.

IMPORTANTE: La seccion [DATOS_VISIBLES] es critica para la busqueda posterior. Incluye absolutamente todo texto legible, por pequeno que sea. Escribe en espanol.`;
  } else {
    prompt = 'Extrae TODO el texto de este documento. Al inicio de cada pagina nueva, incluye un marcador con el formato exacto: [Página X] (donde X es el numero de pagina). Devuelve solo el texto plano con estos marcadores de pagina, sin otro formateo ni comentarios adicionales.';
  }

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

  // Track usage (non-blocking)
  trackGeminiCall(result, { eventType: 'rag_ingest', eventSubtype: 'reextract_content', modelId: 'gemini-2.0-flash' });

  try {
    return result.text || '';
  } catch {
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

  const auth = verifyAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Solo administradores' });

  try {
    const { dryRun = false, limit = 15, forceAll = false } = req.body || {};

    // 1. Obtener documentos RAG PENDIENTES (no re-procesados aún)
    // Los ya procesados tienen _reextracted: true en extracted_data
    let docs;
    if (forceAll) {
      docs = await sql`
        SELECT DISTINCT
          er.id, er.filename, er.file_type, er.pdf_blob_url,
          er.extracted_data, er.user_id
        FROM extraction_results er
        INNER JOIN rag_embeddings re ON re.document_id = er.id
        ORDER BY er.filename
      `;
    } else {
      docs = await sql`
        SELECT DISTINCT
          er.id, er.filename, er.file_type, er.pdf_blob_url,
          er.extracted_data, er.user_id
        FROM extraction_results er
        INNER JOIN rag_embeddings re ON re.document_id = er.id
        WHERE NOT COALESCE((er.extracted_data->>'_reextracted')::boolean, false)
        ORDER BY er.filename
      `;
    }

    const pendingDocs = docs.rows.length;

    // Contar total (incluyendo ya procesados)
    const totalResult = await sql`
      SELECT COUNT(DISTINCT er.id) as total
      FROM extraction_results er
      INNER JOIN rag_embeddings re ON re.document_id = er.id
    `;
    const totalDocs = parseInt(totalResult.rows[0].total);
    const alreadyDone = totalDocs - pendingDocs;

    console.log(`[ReExtract] Total: ${totalDocs}, Ya procesados: ${alreadyDone}, Pendientes: ${pendingDocs}`);

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        totalDocuments: totalDocs,
        alreadyProcessed: alreadyDone,
        pending: pendingDocs,
        willProcess: Math.min(pendingDocs, limit),
        documents: docs.rows.slice(0, limit).map(d => ({
          id: d.id,
          filename: d.filename,
          fileType: d.file_type,
          hasBlobUrl: !!d.pdf_blob_url,
        })),
      });
    }

    if (pendingDocs === 0) {
      return res.status(200).json({
        success: true,
        message: 'Todos los documentos ya han sido re-procesados',
        totalDocuments: totalDocs,
        alreadyProcessed: alreadyDone,
        pending: 0,
      });
    }

    // Limitar a `limit` documentos por ejecución
    const effectiveLimit = Math.min(Math.max(1, limit), 20);
    const docsToProcess = docs.rows.slice(0, effectiveLimit);

    const results: Array<{
      id: string;
      filename: string;
      success: boolean;
      chunks?: number;
      error?: string;
    }> = [];

    for (const doc of docsToProcess) {
      const startTime = Date.now();
      try {
        const blobUrl = doc.pdf_blob_url || doc.extracted_data?.blobUrl;

        if (!blobUrl) {
          // Sin blob URL: re-ingestar con texto existente + marcar como procesado
          const data = doc.extracted_data || {};
          const existingText = data.transcription || data.description || '';

          if (existingText && existingText.length > 10) {
            await deleteByDocumentId(doc.id);
            const isImage = isImageMimeType(doc.file_type || '');
            const isAudio = isAudioMimeType(doc.file_type || '');
            const result = await ingestDocument(
              doc.id, doc.filename, existingText, doc.user_id,
              { fileType: doc.file_type, isImage, isAudio }
            );
            // Marcar como procesado
            await sql`
              UPDATE extraction_results
              SET extracted_data = jsonb_set(COALESCE(extracted_data, '{}'::jsonb), '{_reextracted}', 'true')
              WHERE id = ${doc.id}::uuid
            `;
            results.push({ id: doc.id, filename: doc.filename, success: true, chunks: result.chunksCreated });
          } else {
            // Marcar como procesado aunque falle (para no reintentar infinitamente)
            await sql`
              UPDATE extraction_results
              SET extracted_data = jsonb_set(COALESCE(extracted_data, '{}'::jsonb), '{_reextracted}', 'true')
              WHERE id = ${doc.id}::uuid
            `;
            results.push({ id: doc.id, filename: doc.filename, success: false, error: 'Sin blob URL ni texto' });
          }
          continue;
        }

        // Descargar archivo de Blob Storage
        console.log(`[ReExtract] Descargando ${doc.filename}...`);
        const blobResponse = await fetch(blobUrl);
        if (!blobResponse.ok) {
          await sql`
            UPDATE extraction_results
            SET extracted_data = jsonb_set(COALESCE(extracted_data, '{}'::jsonb), '{_reextracted}', 'true')
            WHERE id = ${doc.id}::uuid
          `;
          results.push({ id: doc.id, filename: doc.filename, success: false, error: `Blob fetch error: ${blobResponse.status}` });
          continue;
        }

        const blobBuffer = Buffer.from(await blobResponse.arrayBuffer());
        const base64Data = blobBuffer.toString('base64');
        const mimeType = doc.file_type || 'application/pdf';

        // Re-extraer con nuevos prompts
        console.log(`[ReExtract] Re-extrayendo ${doc.filename} (${mimeType})...`);
        const newText = await reExtractContent(base64Data, mimeType);

        if (!newText || newText.trim().length < 10) {
          await sql`
            UPDATE extraction_results
            SET extracted_data = jsonb_set(COALESCE(extracted_data, '{}'::jsonb), '{_reextracted}', 'true')
            WHERE id = ${doc.id}::uuid
          `;
          results.push({ id: doc.id, filename: doc.filename, success: false, error: 'Re-extracción vacía' });
          continue;
        }

        // Extraer OCR metadata para imágenes
        const isImage = isImageMimeType(mimeType);
        const isAudio = isAudioMimeType(mimeType);
        let ocrMetadata = '';
        if (isImage) {
          const datosMatch = newText.match(/\[DATOS_VISIBLES\]\s*([\s\S]*?)(?:\[DESCRIPCION\]|$)/i);
          if (datosMatch && datosMatch[1]) {
            ocrMetadata = datosMatch[1].trim();
            if (ocrMetadata.toLowerCase() === 'sin texto visible') ocrMetadata = '';
          }
        }

        // Actualizar extracted_data en BD con nuevo texto + marcar procesado
        const updatedData = {
          ...(doc.extracted_data || {}),
          _ragDocument: true,
          _reextracted: true,
          description: newText,
          ...(ocrMetadata ? { ocr_text: ocrMetadata } : {}),
          ...(isAudio ? { transcription: newText, isAudio: true } : {}),
          isImage,
          blobUrl,
        };

        await sql`
          UPDATE extraction_results
          SET extracted_data = ${updatedData}::jsonb
          WHERE id = ${doc.id}::uuid
        `;

        // Borrar embeddings antiguos y re-ingestar
        await deleteByDocumentId(doc.id);
        const result = await ingestDocument(
          doc.id, doc.filename, newText, doc.user_id,
          { fileType: mimeType, isImage, isAudio, originalUrl: blobUrl }
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [ReExtract] ${doc.filename}: ${result.chunksCreated} chunks (${elapsed}s)`);
        results.push({ id: doc.id, filename: doc.filename, success: true, chunks: result.chunksCreated });

      } catch (docErr: any) {
        console.error(`❌ [ReExtract] Error con ${doc.filename}: ${docErr.message}`);
        // Marcar como procesado para no reintentar
        try {
          await sql`
            UPDATE extraction_results
            SET extracted_data = jsonb_set(COALESCE(extracted_data, '{}'::jsonb), '{_reextracted}', 'true')
            WHERE id = ${doc.id}::uuid
          `;
        } catch {}
        results.push({ id: doc.id, filename: doc.filename, success: false, error: docErr.message });
      }

      // Pausa entre documentos para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    const processed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const remainingPending = pendingDocs - docsToProcess.length;

    console.log(`[ReExtract] Lote completado: ${processed} OK, ${failed} errores. Pendientes: ${remainingPending}`);

    return res.status(200).json({
      success: true,
      totalDocuments: totalDocs,
      alreadyProcessed: alreadyDone + docsToProcess.length,
      pending: remainingPending,
      thisRun: { processed, failed, total: docsToProcess.length },
      results,
      message: remainingPending > 0
        ? `Procesados ${docsToProcess.length}/${pendingDocs} pendientes. Ejecuta de nuevo para continuar (quedan ${remainingPending}).`
        : 'Todos los documentos han sido re-procesados.',
    });

  } catch (error: any) {
    console.error('[ReExtract] Error general:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
