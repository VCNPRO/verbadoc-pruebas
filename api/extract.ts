// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { classifyDocument, recalibrateRegions, extractWithConfidence } from './_lib/idpService.js';
import { cropImage } from './_lib/imageUtils.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuración de CORS
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
    // DEBUG: Log completo del body recibido
    const bodyKeys = Object.keys(req.body || {});
    console.log(`📥 /api/extract recibido - Keys: [${bodyKeys.join(', ')}]`);

    // Mostrar tamaño de cada campo (sin el contenido completo)
    for (const key of bodyKeys) {
      const value = req.body[key];
      const size = typeof value === 'string' ? value.length : JSON.stringify(value).length;
      console.log(`   - ${key}: ${typeof value}, ${size} chars`);
    }

    // Aceptar múltiples formatos de campo
    const possibleFields = [
      'base64Image', 'file', 'pdfBase64', 'base64', 'image', 'data',
      'pdf', 'document', 'content', 'imageBase64', 'fileData', 'pdfData',
      'documentBase64', 'imageData', 'fileBase64'
    ];

    let base64Data = null;
    let foundField = null;

    // Buscar en todos los campos posibles
    for (const field of possibleFields) {
      if (req.body[field]) {
        base64Data = req.body[field];
        foundField = field;
        break;
      }
    }

    // Si no se encuentra, buscar cualquier campo que contenga base64 largo
    if (!base64Data) {
      for (const key of bodyKeys) {
        const value = req.body[key];
        if (typeof value === 'string' && value.length > 1000) {
          // Parece ser datos base64
          base64Data = value;
          foundField = key;
          console.log(`   🔍 Encontrado datos en campo no estándar: "${key}"`);
          break;
        }
      }
    }

    // 🔥 NUEVO: Si aún no hay datos, buscar en formato Vertex AI / Gemini
    // Formato: { contents: { parts: [{ inlineData: { mimeType, data } }] } }
    // O también: { contents: [{ parts: [{ inlineData: { mimeType, data } }] }] }
    let detectedMimeType: string | null = null;

    if (!base64Data && req.body.contents) {
      console.log("   🔍 Detectado formato Vertex AI/Gemini, buscando en contents...");
      try {
        const contents = req.body.contents;
        // contents puede ser un objeto o un array
        const partsContainer = Array.isArray(contents) ? contents[0] : contents;
        const parts = partsContainer?.parts || partsContainer;

        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.inlineData?.data) {
              base64Data = part.inlineData.data;
              foundField = 'contents.parts[].inlineData.data';
              // También extraer el mimeType si viene
              if (part.inlineData.mimeType) {
                detectedMimeType = part.inlineData.mimeType;
                console.log(`   📎 MimeType del request: ${detectedMimeType}`);
              }
              console.log(`   ✅ Extraído base64 de formato Vertex AI (${base64Data.length} chars)`);
              break;
            }
          }
        }
      } catch (parseError) {
        console.log("   ⚠️ Error parseando formato Vertex AI:", parseError);
      }
    }

    // Usar el mimeType detectado del request Vertex AI, o detectar automáticamente
    let mimeType = detectedMimeType || 'image/jpeg';

    if (!base64Data) {
      console.log("❌ Petición sin datos válidos. Body vacío o campos no reconocidos.");
      console.log("   Campos recibidos:", bodyKeys);
      console.log("   Tamaños:", bodyKeys.map(k => `${k}=${typeof req.body[k] === 'string' ? req.body[k].length : 'no-string'}`).join(', '));
      return res.status(400).json({
        error: 'Falta el campo requerido',
        receivedFields: bodyKeys,
        expectedFields: possibleFields,
        hint: 'Envía el documento como base64 en uno de los campos esperados'
      });
    }

    console.log(`✅ Datos encontrados en campo "${foundField}", tamaño: ${base64Data.length} chars`);

    // Solo detectar automáticamente si no vino el mimeType del request Vertex AI
    if (!detectedMimeType) {
      // Detectar si es PDF o imagen basándose en el contenido base64
      // PDF base64 empieza con "JVBERi" (que es "%PDF-" en base64)
      if (base64Data.startsWith('JVBERi') || base64Data.startsWith('data:application/pdf')) {
        mimeType = 'application/pdf';
        // Limpiar prefijo data URL si existe
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        console.log("📄 Detectado automáticamente: PDF");
      } else {
        // Limpiar prefijo data URL si existe
        if (base64Data.includes(',')) {
          const parts = base64Data.split(',');
          if (parts[0].includes('image/png')) mimeType = 'image/png';
          else if (parts[0].includes('image/jpeg') || parts[0].includes('image/jpg')) mimeType = 'image/jpeg';
          base64Data = parts[1];
        }
        console.log("🖼️ Detectado automáticamente: Imagen");
      }
    } else {
      // Limpiar prefijo data URL si existe (aunque venga el mimeType de Vertex AI)
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      console.log(`📎 Usando mimeType del request: ${mimeType}`);
    }

    // Usar base64Data como la variable para el resto del flujo
    const base64Image = base64Data;

    console.log(`🚀 Iniciando flujo de extracción IDP... (${mimeType})`);

    // 1. Obtener todas las plantillas activas de la base de datos
    console.log("   - Capa 0: Obteniendo plantillas de la BD...");
    const templatesResult = await sql`
      SELECT id, name, regions FROM form_templates WHERE is_active = true;
    `;
    const templates = templatesResult.rows;
    if (templates.length === 0) {
      return res.status(500).json({ error: 'No hay plantillas de formulario activas en la base de datos.' });
    }
    console.log(`   ✅ Obtenidas ${templates.length} plantillas.`);

    // 2. Clasificar el documento para encontrar la mejor plantilla
    console.log("   - Capa 1: Clasificando documento...");
    const classification = await classifyDocument(base64Image, templates, mimeType);
    if (!classification || classification.confidence < 0.7) {
      console.log(`   ⚠️  Clasificación fallida o con baja confianza (${(classification?.confidence || 0) * 100}%)`);
      return res.status(422).json({
        error: 'Tipo de documento no reconocido',
        message: 'El documento no coincide con ninguna plantilla conocida con suficiente confianza.',
        status: 'needs_review'
      });
    }
    const matchedTemplate = templates.find(t => t.id === classification.id);
    console.log(`   ✅ Documento clasificado como "${matchedTemplate.name}" (Confianza: ${Math.round(classification.confidence * 100)}%)`);

    // 3. Recalibrar las coordenadas de la plantilla para este documento específico
    console.log("   - Capa 2: Recalibrando coordenadas...");
    const recalibratedRegions = await recalibrateRegions(base64Image, matchedTemplate.regions, mimeType);
    console.log("   ✅ Coordenadas recalibradas.");

    // 4. Extraer datos - método diferente según si es PDF o imagen
    console.log("   - Capa 3: Extrayendo datos...");
    const extractedData: Record<string, any> = {};
    const extractionResults: Array<{label: string, value: string, success: boolean}> = [];

    if (mimeType === 'application/pdf') {
      // 🔥 Para PDFs: Usar Gemini directamente con el documento completo
      // Gemini 2.0 soporta PDFs multi-página nativamente
      console.log(`   📄 Modo PDF: Extrayendo ${recalibratedRegions.length} campos con Gemini...`);

      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

        // Separar regiones por tipo para el prompt
        const textFields = recalibratedRegions.filter(r => r.type === 'field' || r.type === 'text');
        const checkboxes = recalibratedRegions.filter(r => r.type === 'box');

        const fieldsList = textFields.map(r => `- "${r.label}" (página ${(r.pageIndex || 0) + 1}, posición: x=${Math.round(r.x)}%, y=${Math.round(r.y)}%)`).join('\n');
        const checkboxList = checkboxes.map(r => `- "${r.label}" (página ${(r.pageIndex || 0) + 1}, posición: x=${Math.round(r.x)}%, y=${Math.round(r.y)}%)`).join('\n');

        const prompt = `TAREA: Extraer datos de este formulario FUNDAE de 2 páginas.

CAMPOS DE TEXTO A EXTRAER (${textFields.length} campos):
${fieldsList}

CASILLAS DE VERIFICACIÓN A DETECTAR (${checkboxes.length} casillas):
${checkboxList}

INSTRUCCIONES:
1. Para campos de texto: Extrae el valor escrito/impreso EXACTAMENTE como aparece. Si está vacío, usa "".
2. Para casillas: Responde "[X]" si está marcada, "[ ]" si está vacía.
3. Las coordenadas X/Y son porcentajes desde la esquina superior izquierda.
4. IMPORTANTE: Revisa AMBAS páginas del documento.
5. 🔥 CRÍTICO - Nº EXPEDIENTE: Los números de expediente pueden tener 1-2 LETRAS al final (ej: "F240012AB", "F230045XY").
   SIEMPRE incluye las letras finales si existen. NO las omitas ni las confundas con otros caracteres.
6. Extrae TODOS los caracteres alfanuméricos de cada campo, incluyendo letras mayúsculas y minúsculas.

Responde en JSON con este formato exacto:
{
  "campo1": "valor1",
  "campo2": "[X]",
  ...
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64Image } },
              { text: prompt }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const responseText = response.text || '{}';
        const parsed = JSON.parse(responseText.replace(/```json|```/g, '').trim());

        // Mapear resultados
        for (const region of recalibratedRegions) {
          const value = parsed[region.label] ?? '';
          extractedData[region.label] = value;
          extractionResults.push({
            label: region.label,
            value: String(value),
            success: value !== '' && value !== undefined
          });
        }

        console.log(`   ✅ Extracción PDF completada: ${Object.keys(parsed).length} campos extraídos`);

      } catch (pdfError: any) {
        console.error('   ❌ Error en extracción PDF con Gemini:', pdfError.message);
        // Fallback: marcar todos como error
        for (const region of recalibratedRegions) {
          extractedData[region.label] = 'ERROR_EXTRACCION';
          extractionResults.push({ label: region.label, value: 'ERROR', success: false });
        }
      }

    } else {
      // 🖼️ Para imágenes: Usar el método original región por región
      console.log(`   🖼️ Modo Imagen: Extrayendo ${recalibratedRegions.length} campos por región...`);

      for (const region of recalibratedRegions) {
        try {
          const regionImageBase64 = await cropImage(base64Image, region);
          const result = await extractWithConfidence(regionImageBase64, region);
          extractedData[region.label] = result.value;
          extractionResults.push({ label: region.label, value: result.value, success: true });
        } catch (regionError) {
          console.error(`      - ❌ Error extrayendo la región "${region.label}":`, regionError);
          extractedData[region.label] = 'ERROR_EXTRACCION';
          extractionResults.push({ label: region.label, value: 'ERROR', success: false });
        }
      }
    }

    console.log(`   ✅ Extracción completada: ${extractionResults.filter(r => r.success).length}/${extractionResults.length} campos OK`);

    // 5. Ensamblar y responder
    const finalConfidence = (extractionResults.filter(r => r.success).length / extractionResults.length);
    console.log(`   - Puntuación de confianza final: ${Math.round(finalConfidence * 100)}%`);

    return res.status(200).json({
      extractedData,
      // 🔥 COMPATIBILIDAD: El frontend espera result.text con el JSON en string
      text: JSON.stringify(extractedData),
      confidence: finalConfidence,
      matchedTemplateId: matchedTemplate.id,
      status: finalConfidence > 0.85 ? 'valid' : 'needs_review',
      timestamp: new Date().toISOString(),
      location: 'europe-west1', // Para el log del frontend
    });

  } catch (error: any) {
    console.error('❌ Error fatal en el flujo de extracción IDP:', error);
    return res.status(500).json({
      error: 'Error en el servidor durante la extracción',
      message: error.message,
    });
  }
}
