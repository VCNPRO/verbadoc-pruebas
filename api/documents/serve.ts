/**
 * DOCUMENT PROXY - Acceso autenticado a documentos
 * api/documents/serve.ts
 *
 * Endpoint seguro que verifica autenticación y permisos antes de
 * servir documentos almacenados en Vercel Blob.
 * Nunca se expone la URL real del Blob al frontend.
 *
 * GET /api/documents/serve?id=<document_id>
 * GET /api/documents/serve?id=<document_id>&download=1 (forzar descarga)
 *
 * Seguridad:
 * - Requiere JWT válido (cookie auth-token)
 * - Verifica que el usuario pertenezca al mismo client_id
 * - No expone la URL de Vercel Blob en el frontend
 * - Logs de acceso para auditoría
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyRequestAuth } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  // 1. Verificar autenticación
  const auth = verifyRequestAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
  }

  // 2. Obtener parámetros
  const documentId = req.query.id as string;
  const forceDownload = req.query.download === '1';

  if (!documentId) {
    return res.status(400).json({ error: 'Falta parámetro: id' });
  }

  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(documentId)) {
    return res.status(400).json({ error: 'ID de documento inválido' });
  }

  try {
    // 3. Buscar documento en extraction_results
    let result = await sql`
      SELECT
        e.id,
        e.pdf_blob_url,
        e.filename,
        e.file_type,
        e.user_id,
        u.client_id as owner_client_id
      FROM extraction_results e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = ${documentId}::uuid
      LIMIT 1
    `;

    // Fallback: buscar en unprocessable_documents
    if (result.rows.length === 0) {
      result = await sql`
        SELECT
          ud.id,
          ud.pdf_blob_url,
          ud.filename,
          NULL::text as file_type,
          ud.user_id,
          usr.client_id as owner_client_id
        FROM unprocessable_documents ud
        JOIN users usr ON ud.user_id = usr.id
        WHERE ud.id = ${documentId}::uuid
        LIMIT 1
      `;
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const doc = result.rows[0];

    // 4. Verificar que el usuario tiene acceso
    // Mismo usuario → acceso directo
    // Diferente usuario → verificar mismo client_id
    if (doc.user_id !== auth.userId) {
      const userResult = await sql`
        SELECT client_id FROM users WHERE id = ${auth.userId}::uuid LIMIT 1
      `;
      const requesterClientId = userResult.rows[0]?.client_id;

      if (!requesterClientId || requesterClientId !== doc.owner_client_id) {
        console.warn(`[DocProxy] Acceso denegado: user=${auth.userId} intentó acceder a doc=${documentId} de user=${doc.user_id}`);
        return res.status(403).json({ error: 'Sin permiso para acceder a este documento' });
      }
    }

    // 5. Verificar que el documento tiene URL
    if (!doc.pdf_blob_url) {
      return res.status(404).json({ error: 'Documento sin archivo asociado' });
    }

    // 6. Fetch del blob y stream al cliente (no redirigir para no exponer URL)
    const blobResponse = await fetch(doc.pdf_blob_url);

    if (!blobResponse.ok) {
      console.error(`[DocProxy] Error fetching blob: ${blobResponse.status} para doc=${documentId}`);
      return res.status(502).json({ error: 'Error al recuperar el documento' });
    }

    // 7. Configurar headers de respuesta
    const contentType = doc.file_type || blobResponse.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // Cache corto (5 min) para no re-descargar en cada vista
    res.setHeader('Cache-Control', 'private, max-age=300');

    // Header de seguridad: no permitir framing desde otros sitios
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    if (forceDownload && doc.filename) {
      res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename || 'documento'}"`);
    }

    const contentLength = blobResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // 8. Stream del contenido
    const buffer = Buffer.from(await blobResponse.arrayBuffer());
    return res.status(200).send(buffer);

  } catch (error: any) {
    console.error(`[DocProxy] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error interno al servir documento' });
  }
}
