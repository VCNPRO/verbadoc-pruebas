// @ts-nocheck
/**
 * API ENDPOINT: /api/extract-ai
 *
 * Extracción DIRECTA con IA usando el prompt del frontend.
 * Este endpoint NO usa el sistema de plantillas/coordenadas.
 * Envía el documento directamente a Gemini con el prompt proporcionado.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
    const { model, contents, config: requestConfig, prompt, schema } = req.body;

    console.log('🤖 /api/extract-ai - Extracción DIRECTA con IA');

    // Extraer el base64 del documento
    let base64Data: string | null = null;
    let mimeType = 'application/pdf';

    // Buscar en formato Vertex AI: contents.parts[].inlineData
    if (contents) {
      const partsContainer = Array.isArray(contents) ? contents[0] : contents;
      const parts = partsContainer?.parts || partsContainer;

      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part?.inlineData?.data) {
            base64Data = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'application/pdf';
            break;
          }
          // También buscar el prompt en los parts
          if (part?.text && !prompt) {
            // El prompt viene en parts
          }
        }
      }
    }

    // Buscar prompt en los parts si no viene separado
    let extractionPrompt = prompt;
    if (!extractionPrompt && contents) {
      const partsContainer = Array.isArray(contents) ? contents[0] : contents;
      const parts = partsContainer?.parts || partsContainer;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part?.text) {
            extractionPrompt = part.text;
            break;
          }
        }
      }
    }

    if (!base64Data) {
      console.log('❌ No se encontró documento en el request');
      return res.status(400).json({
        error: 'No se encontró documento',
        hint: 'Envía el documento en contents.parts[].inlineData.data'
      });
    }

    if (!extractionPrompt) {
      console.log('❌ No se encontró prompt en el request');
      return res.status(400).json({
        error: 'No se encontró prompt',
        hint: 'Envía el prompt en contents.parts[].text o en el campo prompt'
      });
    }

    console.log(`📄 Documento: ${(base64Data.length / 1024).toFixed(1)} KB, tipo: ${mimeType}`);
    console.log(`📝 Prompt: ${extractionPrompt.substring(0, 100)}...`);

    // Llamar a Gemini directamente con el prompt del frontend
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

    const modelId = model || 'gemini-3-pro-preview';
    console.log(`🤖 Usando modelo: ${modelId}`);

    // Construir el prompt final
    let finalPrompt = extractionPrompt;

    // Si hay schema, añadirlo al prompt
    if (schema && Array.isArray(schema)) {
      const schemaFields = schema.map((f: any) => `- ${f.name} (${f.type})`).join('\n');
      finalPrompt += `\n\nCAMPOS A EXTRAER:\n${schemaFields}\n\nDevuelve los datos en formato JSON.`;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: finalPrompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        ...requestConfig
      }
    });

    const responseText = response.text || '{}';
    console.log(`✅ Respuesta de Gemini: ${responseText.length} chars`);

    // Parsear la respuesta
    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText.replace(/```json|```/g, '').trim());
    } catch (parseError) {
      console.warn('⚠️ Error parseando JSON, devolviendo texto raw');
      extractedData = { raw_response: responseText };
    }

    // Log de campos extraídos
    const fieldCount = Object.keys(extractedData).length;
    const nonEmptyFields = Object.entries(extractedData).filter(([_, v]) => v && v !== '' && v !== 'NC' && v !== null).length;
    console.log(`📊 Campos extraídos: ${nonEmptyFields}/${fieldCount}`);

    // Verificar campos críticos FUNDAE
    const expediente = extractedData.numero_expediente || extractedData['1. Nº expediente'] || '';
    const accion = extractedData.numero_accion || extractedData['4. Nº Acción'] || '';
    const grupo = extractedData.numero_grupo || extractedData['5. Nº grupo'] || '';

    if (expediente || accion || grupo) {
      console.log(`🔍 Campos FUNDAE: exp="${expediente}", acc="${accion}", grp="${grupo}"`);
    }

    return res.status(200).json({
      extractedData,
      text: JSON.stringify(extractedData), // Compatibilidad con frontend
      confidence: 0.85, // Confianza estimada para IA directa
      method: 'ai_direct',
      model: modelId,
      fieldsExtracted: fieldCount,
      nonEmptyFields,
      location: 'europe-west1',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error en /api/extract-ai:', error);
    return res.status(500).json({
      error: 'Error en extracción con IA',
      message: error.message
    });
  }
}
