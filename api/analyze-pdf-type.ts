/**
 * API: Analizar Tipo de PDF (sin guardarlo)
 *
 * POST /api/analyze-pdf-type
 *
 * Analiza un PDF para determinar su tipo (OCR/Imagen/Mixto)
 * sin guardarlo en la base de datos
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzePDFFromBase64 } from '../src/services/pdfAnalysisService.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, filename } = req.body;

    if (!file || !filename) {
      return res.status(400).json({
        error: 'Faltan parámetros: file (base64), filename'
      });
    }

    console.log(`🔍 Analizando tipo de PDF: ${filename}`);

    // Analizar PDF
    const analysis = await analyzePDFFromBase64(file);

    console.log(`✅ Análisis completado: ${analysis.type}`);

    return res.status(200).json({
      success: true,
      analysis: {
        type: analysis.type,
        hasText: analysis.hasText,
        pageCount: analysis.pageCount,
        textPagesCount: analysis.textPagesCount,
        requiresOCR: analysis.type === 'image' || (analysis.type === 'mixed' && analysis.textPagesCount < analysis.pageCount / 2),
        confidence: analysis.confidence,
        // 🆕 Información de calidad de texto
        textQuality: analysis.textQuality,
        // 🆕 Recomendación de modelo
        recommendedModel: analysis.recommendedModel,
        processingRecommendation: analysis.processingRecommendation
      }
    });

  } catch (error: any) {
    console.error('❌ Error al analizar PDF:', error);

    return res.status(500).json({
      error: 'Error al analizar PDF',
      message: error.message
    });
  }
}
