/**
 * RAG UPLOAD BLOB - Handler para subida directa del cliente a Vercel Blob
 * api/rag/upload-blob.ts
 *
 * Usa handleUpload de @vercel/blob/client para generar tokens
 * que permiten al navegador subir archivos directo a Vercel Blob,
 * sin pasar por el limite de 4.5MB del serverless function.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
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
    const jsonResponse = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        return {
          allowedContentTypes: [
            'application/pdf',
            'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/webp', 'image/gif', 'image/bmp',
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
            'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
            'audio/flac', 'audio/x-flac', 'audio/aac',
          ],
          maximumSizeInBytes: 100 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId: auth.userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(`✅ [Blob Upload] Completado: ${blob.pathname}`);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error: any) {
    console.error('[Blob Upload] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
