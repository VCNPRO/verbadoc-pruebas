import { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';
import { sql } from '@vercel/postgres';

export const config = {
  api: {
    bodyParser: false, // Deshabilitado para recibir el stream del archivo
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Verificar Auth
    const token = req.cookies['auth-token'];
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.id || decoded.userId;

    // 2. Obtener datos
    const { unprocessableId, filename, contentType } = req.query;
    if (!unprocessableId || !filename) {
      return res.status(400).json({ error: 'Faltan parámetros unprocessableId o filename' });
    }

    console.log(`📤 Subiendo PDF para documento no procesable: ${unprocessableId}`);

    // 3. Subir a Vercel Blob (igual que extractions/upload)
    const blob = await put(`unprocessable/${unprocessableId}/${filename}`, req, {
      access: 'public',
      contentType: (contentType as string) || 'application/pdf',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log(`✅ PDF subido a Vercel Blob: ${blob.pathname}`);

    // 4. Actualizar la URL en la base de datos
    const dbUpdate = await sql`
      UPDATE unprocessable_documents
      SET
        pdf_blob_url = ${blob.url},
        updated_at = NOW()
      WHERE id = ${unprocessableId as string}::UUID
      AND user_id = ${userId as string}::UUID
    `;

    console.log(`📝 Filas actualizadas en BD (unprocessable_documents): ${dbUpdate.rowCount}`);

    if (dbUpdate.rowCount === 0) {
      console.warn(`⚠️ No se encontró el documento no procesable ${unprocessableId} para el usuario ${userId}`);
    }

    return res.status(200).json({
      success: true,
      url: blob.url,
      updated: dbUpdate.rowCount > 0
    });

  } catch (error: any) {
    console.error('❌ Error en subida a Blob para no procesable:', error);
    return res.status(500).json({ error: error.message });
  }
}
