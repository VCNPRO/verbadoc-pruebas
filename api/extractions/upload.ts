import { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';
import { sql } from '@vercel/postgres';
import { OPENCV_CONFIG, validateWithOpenCV, applyOpenCVResult } from '../_lib/opencvValidator.js';

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
    const { extractionId, filename, contentType } = req.query;
    if (!extractionId || !filename) {
      return res.status(400).json({ error: 'Faltan parámetros extractionId o filename' });
    }

    // 3. Subir a Vercel Blob
    // El body viene como stream o buffer dependiendo de cómo se envíe
    const blob = await put(`forms/${extractionId}/${filename}`, req, {
      access: 'public',
      contentType: (contentType as string) || 'application/pdf',
      token: process.env.BLOB_READ_WRITE_TOKEN // Vercel lo inyecta automáticamente si está configurado
    });

    console.log(`✅ Archivo subido a Vercel Blob: ${blob.url}`);

    // 4. Actualizar la URL en la base de datos con casting explícito
    const dbUpdate = await sql`
      UPDATE extraction_results
      SET
        pdf_blob_url = ${blob.url},
        file_url = ${blob.url},
        pdf_stored_at = NOW(),
        pdf_blob_pathname = ${blob.pathname}
      WHERE id = ${extractionId as string}::UUID
      AND user_id = ${userId as string}::UUID
    `;

    console.log(`📝 Filas actualizadas en BD: ${dbUpdate.rowCount}`);

    if (dbUpdate.rowCount === 0) {
      console.warn(`⚠️ No se encontró la extracción ${extractionId} para el usuario ${userId}`);
    }

    // Validación OpenCV de checkboxes (no bloqueante)
    if (OPENCV_CONFIG.enabled) {
      try {
        // Cargar datos extraídos para comparar
        const extraction = await sql`
          SELECT extracted_data FROM extraction_results
          WHERE id = ${extractionId as string}::UUID
        `;
        if (extraction.rows[0]?.extracted_data) {
          const extractedData = extraction.rows[0].extracted_data;
          const opencvResult = await validateWithOpenCV(blob.url, extractedData);
          if (opencvResult.comparison) {
            console.log(`[OpenCV] marcados=${opencvResult.opencv?.marked} uncertain=${opencvResult.opencv?.uncertain} gemini=${opencvResult.comparison.gemini_marked} diff=${opencvResult.comparison.discrepancy} rec=${opencvResult.comparison.recommendation}`);
            // Guardar resultado OpenCV en la extracción
            await sql`
              UPDATE extraction_results
              SET extracted_data = jsonb_set(
                COALESCE(extracted_data, '{}'::jsonb),
                '{_opencv}',
                ${JSON.stringify({
                  marked: opencvResult.opencv?.marked,
                  uncertain: opencvResult.opencv?.uncertain,
                  gemini_marked: opencvResult.comparison.gemini_marked,
                  discrepancy: opencvResult.comparison.discrepancy,
                  recommendation: opencvResult.comparison.recommendation,
                  mode: opencvResult.mode,
                })}::jsonb
              )
              WHERE id = ${extractionId as string}::UUID
            `;
          }
        }
      } catch (opencvError: any) {
        console.error(`[OpenCV] Error (no bloqueante): ${opencvError.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      url: blob.url,
      updated: dbUpdate.rowCount > 0
    });

  } catch (error: any) {
    console.error('❌ Error en subida a Blob:', error);
    return res.status(500).json({ error: error.message });
  }
}
