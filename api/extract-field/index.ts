// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

// Reintentos con backoff exponencial
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || "";
    if (errorMsg.includes('429') && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Image, region } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }

    const value = await withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

      const isCheckbox = region?.type === 'box';

      // Prompt especializado según el tipo de campo
      const prompt = isCheckbox
        ? `ANÁLISIS FORENSE DE CASILLA DE VERIFICACIÓN.

Examina esta imagen de una casilla de formulario con máxima precisión.

INSTRUCCIONES:
1. Busca CUALQUIER marca intencional: X, ✓, ✗, punto, relleno, tachadura, círculo
2. Ignora: bordes del recuadro, sombras, artefactos de escaneo, motas de polvo
3. Una marca válida es cualquier trazo DELIBERADO dentro o sobre la casilla

RESPUESTA OBLIGATORIA (solo una de estas dos opciones):
- "[X]" si detectas CUALQUIER marca intencional
- "[ ]" si la casilla está completamente vacía/limpia`
        : `EXTRACCIÓN DE TEXTO FORENSE.

Analiza esta región de formulario y extrae el contenido textual.

INSTRUCCIONES:
1. Extrae TODO el texto visible (manuscrito o impreso)
2. Mantén el formato original si hay múltiples líneas
3. Si hay números, transcríbelos exactamente
4. Si el campo está vacío o ilegible, responde exactamente: N/A

RESPUESTA: Solo el texto extraído, sin explicaciones adicionales.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt }
          ]
        }
      });

      return response.text?.trim() || (isCheckbox ? "[ ]" : "N/A");
    });

    return res.status(200).json({ value });

  } catch (error: any) {
    console.error('Extract field error:', error);
    return res.status(500).json({
      error: 'Error extracting field',
      details: error.message
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
