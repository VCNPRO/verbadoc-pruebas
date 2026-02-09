/**
 * RAG UPLOAD BLOB - Subida de archivos grandes por chunks
 * api/rag/upload-blob.ts
 *
 * Usa multipart upload de @vercel/blob para subir archivos >4.5MB
 * en trozos que caben dentro del limite de body de Vercel.
 *
 * Acciones:
 *   action: 'create'   → crea multipart upload, retorna { uploadId, key }
 *   action: 'part'     → sube un chunk, retorna { partNumber, etag }
 *   action: 'complete'  → finaliza upload, retorna { url }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createMultipartUpload,
  uploadPart,
  completeMultipartUpload,
} from '@vercel/blob';
import jwt from 'jsonwebtoken';

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

  const auth = verifyAuth(req);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  try {
    const { action } = req.body;

    if (action === 'create') {
      const { filename, fileType } = req.body;
      const pathname = `rag-documents/${auth.userId}/${Date.now()}-${filename}`;
      const multipart = await createMultipartUpload(pathname, {
        access: 'public',
        contentType: fileType || 'application/octet-stream',
      });
      console.log(`📤 [Blob Multipart] Creado: ${pathname}`);
      return res.status(200).json({
        uploadId: multipart.uploadId,
        key: multipart.key,
      });
    }

    if (action === 'part') {
      const { uploadId, key, partNumber, chunkBase64 } = req.body;
      const buffer = Buffer.from(chunkBase64, 'base64');
      const part = await uploadPart(key, buffer, {
        access: 'public',
        uploadId,
        partNumber,
      });
      return res.status(200).json({
        partNumber: part.partNumber,
        etag: part.etag,
      });
    }

    if (action === 'complete') {
      const { uploadId, key, parts } = req.body;
      const blob = await completeMultipartUpload(key, uploadId, parts, {
        access: 'public',
      });
      console.log(`✅ [Blob Multipart] Completado: ${blob.url}`);
      return res.status(200).json({ url: blob.url });
    }

    return res.status(400).json({ error: 'Acción no válida. Use: create, part, complete' });
  } catch (error: any) {
    console.error('[Blob Upload] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
