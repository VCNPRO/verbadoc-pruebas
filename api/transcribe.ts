// @ts-nocheck
/**
 * API ENDPOINT: /api/transcribe
 *
 * Proxy generico a Gemini para llamadas simples:
 * - Transcripcion de documentos (texto plano)
 * - Transcripcion HTR (manuscrito)
 * - Generacion de metadatos (JSON)
 * - Generacion de schema desde prompt (JSON)
 * - Busqueda de imagen en documento (JSON)
 *
 * NO usa plantillas ni sistema IDP.
 * Acepta formato Vertex AI: { model, contents, config }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { trackGeminiCall } from './lib/usageTracker.js';
import { verifyRequestAuth } from './lib/auth.js';
import { sql } from '@vercel/postgres';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb'
    }
  }
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

  try {
    const { model, contents, config: requestConfig } = req.body;

    if (!contents) {
      return res.status(400).json({
        error: 'Campo contents requerido',
        hint: 'Enviar en formato Vertex AI: { model, contents: { role, parts: [...] }, config }'
      });
    }

    console.log(`[transcribe] Modelo: ${model || 'gemini-2.5-flash'}`);

    // Importar GoogleGenAI
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key no configurada (GEMINI_API_KEY o GOOGLE_API_KEY)' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = model || 'gemini-2.5-flash';

    // Construir parts desde el formato del frontend
    const partsContainer = Array.isArray(contents) ? contents[0] : contents;
    const parts = partsContainer?.parts || [];

    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        error: 'contents.parts vacio',
        hint: 'Enviar al menos un part con text o inlineData'
      });
    }

    // Log de lo que se envia
    const textParts = parts.filter((p: any) => p.text).length;
    const dataParts = parts.filter((p: any) => p.inlineData?.data).length;
    console.log(`[transcribe] Parts: ${textParts} texto, ${dataParts} archivos`);

    // Llamar a Gemini
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: requestConfig || {}
    });

    // Extraer texto de forma segura
    let responseText = '';
    try {
      responseText = response.text || '';
    } catch {
      responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    console.log(`[transcribe] Respuesta: ${responseText.length} chars`);

    // Track usage
    const auth = verifyRequestAuth(req);
    let companyName: string | undefined;
    if (auth?.userId) {
      try {
        const userRow = await sql`SELECT company_name FROM users WHERE id = ${auth.userId}::uuid LIMIT 1`;
        companyName = userRow.rows[0]?.company_name || undefined;
      } catch {}
    }
    trackGeminiCall(response, {
      eventType: 'transcription',
      userId: auth?.userId,
      userEmail: auth?.email,
      companyName,
      modelId: modelId,
    });

    return res.status(200).json({
      text: responseText,
      location: 'europe-west1',
      model: modelId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[transcribe] Error:', error.message);
    return res.status(500).json({
      error: 'Error en transcripcion',
      message: error.message
    });
  }
}
