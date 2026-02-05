/**
 * RAG UPDATE DESCRIPTION ENDPOINT
 * api/rag/update-description.ts
 *
 * Permite editar la descripcion generada por IA de un documento RAG
 * y re-ingestar con el texto corregido.
 *
 * POST /api/rag/update-description
 * Body: { documentId, description }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import { deleteByDocumentId, ingestDocument } from '../lib/ragService.js';

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const auth = verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { documentId, description } = req.body;

    if (!documentId || typeof description !== 'string') {
      return res.status(400).json({ error: 'Faltan campos: documentId, description' });
    }

    // Verificar que el documento existe y pertenece al usuario
    const doc = await sql`
      SELECT id, filename, extracted_data, pdf_blob_url, file_type
      FROM extraction_results
      WHERE id = ${documentId}::uuid AND user_id = ${auth.userId}::uuid
      LIMIT 1
    `;

    if (doc.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const existingData = doc.rows[0].extracted_data || {};
    const filename = doc.rows[0].filename;
    const blobUrl = doc.rows[0].pdf_blob_url;
    const fileType = doc.rows[0].file_type;

    // Actualizar extracted_data con la nueva descripcion
    const updatedData = {
      ...existingData,
      _ragDocument: true,
      description: description.trim(),
    };

    await sql`
      UPDATE extraction_results
      SET extracted_data = ${JSON.stringify(updatedData)}::jsonb,
          updated_at = NOW()
      WHERE id = ${documentId}::uuid AND user_id = ${auth.userId}::uuid
    `;

    console.log(`[RAG Update] Descripcion actualizada para ${documentId}`);

    // Eliminar embeddings antiguos
    await deleteByDocumentId(documentId);
    console.log(`[RAG Update] Embeddings antiguos eliminados`);

    // Re-ingestar con texto corregido
    const ingestResult = await ingestDocument(
      documentId,
      filename,
      description.trim(),
      auth.userId,
      { originalUrl: blobUrl, fileType, isImage: existingData.isImage }
    );

    console.log(`[RAG Update] Re-ingesta completada: ${ingestResult.chunksCreated} chunks`);

    return res.status(200).json({
      success: true,
      documentId,
      description: description.trim(),
      ingestion: {
        chunksCreated: ingestResult.chunksCreated,
        vectorsUploaded: ingestResult.vectorsUploaded
      },
      message: 'Descripcion actualizada y re-ingestada'
    });

  } catch (error: any) {
    console.error('[RAG Update] Error:', error);
    return res.status(500).json({
      error: 'Error actualizando descripcion',
      message: error.message
    });
  }
}
