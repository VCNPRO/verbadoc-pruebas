// @ts-nocheck
/**
 * API ENDPOINT: /api/extract-hybrid
 *
 * Extracción híbrida: CV Judge para checkboxes + Gemini para texto.
 * Activado por feature flag USE_HYBRID_EXTRACTION=true
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractHybrid } from './_lib/hybridExtractor.js';
import { calculateConfidenceScore } from './_lib/confidenceService.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb'
    }
  },
  maxDuration: 300
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigins = ['https://www.verbadocpro.eu', 'https://verbadoc-europa-pro.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Feature flag check
  if (process.env.USE_HYBRID_EXTRACTION !== 'true') {
    return res.status(400).json({
      error: 'Hybrid extraction is disabled',
      hint: 'Set USE_HYBRID_EXTRACTION=true to enable'
    });
  }

  try {
    const { pdfBase64, filename, model } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'No se proporcionó PDF (pdfBase64)' });
    }

    console.log(`🧠 /api/extract-hybrid - Extracción híbrida CV Judge + Gemini`);
    console.log(`📄 Archivo: ${filename || 'unknown'}, ${(pdfBase64.length * 0.75 / 1024).toFixed(0)} KB`);

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const result = await extractHybrid(pdfBuffer, {
      geminiApiKey: process.env.GOOGLE_API_KEY,
      geminiModel: model || 'gemini-2.5-flash',
    });

    // Calcular confianza con el servicio existente
    const confidenceReport = calculateConfidenceScore(result.extractedData);

    console.log(`✅ Extracción híbrida completada en ${result.processingTimeMs}ms`);
    console.log(`📊 Confianza CV: ${(result.overallConfidence * 100).toFixed(1)}%`);
    console.log(`📊 Confianza general: ${confidenceReport.percentage}%`);
    console.log(`⚠️ Campos revisión: ${result.fieldsNeedingReview.length}`);

    return res.status(200).json({
      extractedData: result.extractedData,
      method: result.method,
      overallConfidence: Math.round(result.overallConfidence * 100),
      confidenceReport,
      fieldsNeedingReview: result.fieldsNeedingReview,
      checkboxResults: result.checkboxResults,
      processingTimeMs: result.processingTimeMs,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Error en /api/extract-hybrid:', error);
    return res.status(500).json({
      error: 'Error en extracción híbrida',
      message: error.message,
    });
  }
}
