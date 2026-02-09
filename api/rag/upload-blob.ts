/**
 * RAG UPLOAD BLOB - Subida de archivos grandes a Vercel Blob
 * api/rag/upload-blob.ts
 *
 * Recibe archivo como base64 y lo sube a Vercel Blob.
 * Endpoint separado con sizeLimit alto para archivos grandes.
 * Retorna solo la URL del blob (sin ingesta).
 *
 * POST /api/rag/upload-blob
 * Body: { filename, fileBase64, fileType }
 * Response: { url }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};

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
    const { filename, fileBase64, fileType } = req.body;
    if (!filename || !fileBase64) {
      return res.status(400).json({ error: 'Faltan campos: filename, fileBase64' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const blob = await put(`rag-documents/${auth.userId}/${Date.now()}-${filename}`, buffer, {
      access: 'public',
      contentType: fileType || 'application/octet-stream'
    });

    console.log(`✅ [Blob Upload] ${filename} subido: ${blob.url} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);

    return res.status(200).json({ url: blob.url });
  } catch (error: any) {
    console.error('[Blob Upload] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
