/**
 * API: Subir PDF de una extracción a Vercel Blob
 *
 * POST /api/extractions/:id/upload-pdf
 *
 * Sube el PDF original para almacenamiento y auditoría
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { uploadPDFFromBase64 } from '../../../src/services/blobStorageService.js';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; email: string; role: string } | null {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb' // PDFs pueden ser grandes
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const extractionId = req.query.id as string;
    const { file, filename } = req.body;

    if (!extractionId) {
      return res.status(400).json({ error: 'ID de extracción requerido' });
    }

    if (!file || !filename) {
      return res.status(400).json({
        error: 'Faltan parámetros: file (base64), filename'
      });
    }

    // Verificar que la extracción existe y pertenece al usuario
    const extractionCheck = await sql`
      SELECT id, user_id, filename FROM extraction_results
      WHERE id = ${extractionId}
    `;

    if (extractionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Extracción no encontrada' });
    }

    const extraction = extractionCheck.rows[0];

    // Verificar propiedad (usuario o admin)
    if (extraction.user_id !== user.userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    console.log(`📤 Subiendo PDF para extracción: ${extractionId}`);

    // Subir PDF a Vercel Blob
    const uploadResult = await uploadPDFFromBase64(file, filename, {
      userId: user.userId,
      extractionId
    });

    if (!uploadResult.success) {
      console.error('❌ Error al subir PDF:', uploadResult.error);
      return res.status(500).json({
        error: 'Error al subir PDF',
        message: uploadResult.error
      });
    }

    console.log(`✅ PDF subido: ${uploadResult.url}`);

    // Preparar datos de análisis de PDF
    const analysis = uploadResult.pdfAnalysis;
    const hasAnalysis = !!analysis;
    const now = new Date();

    // Actualizar BD con información del blob y análisis de tipo
    await sql`
      UPDATE extraction_results
      SET
        pdf_blob_url = ${uploadResult.url},
        pdf_blob_pathname = ${uploadResult.pathname},
        pdf_stored_at = CURRENT_TIMESTAMP,
        pdf_size_bytes = ${uploadResult.size},
        pdf_checksum = ${uploadResult.checksum},
        pdf_type = ${hasAnalysis ? analysis.type : null},
        pdf_has_text = ${hasAnalysis ? analysis.hasText : null},
        pdf_page_count = ${hasAnalysis ? analysis.pageCount : null},
        pdf_text_pages = ${hasAnalysis ? analysis.textPagesCount : null},
        pdf_text_sample = ${hasAnalysis ? (analysis.textContentSample || null) : null},
        pdf_detection_confidence = ${hasAnalysis ? analysis.confidence : null},
        pdf_analysis_details = ${hasAnalysis ? (analysis.details || null) : null},
        pdf_requires_ocr = ${hasAnalysis ? (analysis.type === 'image' || (analysis.type === 'mixed' && analysis.textPagesCount < analysis.pageCount / 2)) : null},
        pdf_analyzed_at = ${hasAnalysis ? now : null}
      WHERE id = ${extractionId}
    `;

    console.log(`✅ BD actualizada con información del blob y análisis de tipo`);
    if (hasAnalysis) {
      console.log(`   Tipo: ${analysis.type} | Páginas: ${analysis.pageCount} | Con texto: ${analysis.textPagesCount}`);
    }

    return res.status(200).json({
      success: true,
      url: uploadResult.url,
      pathname: uploadResult.pathname,
      size: uploadResult.size,
      sizeFormatted: `${(uploadResult.size! / 1024 / 1024).toFixed(2)} MB`,
      checksum: uploadResult.checksum,
      pdfAnalysis: hasAnalysis ? {
        type: analysis.type,
        hasText: analysis.hasText,
        pageCount: analysis.pageCount,
        textPages: analysis.textPagesCount,
        requiresOCR: analysis.type === 'image',
        confidence: analysis.confidence,
        details: analysis.details
      } : undefined
    });

  } catch (error: any) {
    console.error('❌ Error al subir PDF:', error);

    return res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
}
