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
    // 🔥 Log detallado de plantillas disponibles
    console.log(`   ✅ Obtenidas ${templates.length} plantillas activas:`);
    templates.forEach((t: any, i: number) => {
      const regionCount = Array.isArray(t.regions) ? t.regions.length : 0;
      console.log(`      ${i + 1}. "${t.name}" (${regionCount} campos) - ID: ${t.id.substring(0, 8)}...`);
    });

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
        const textFields = recalibratedRegions.filter((r: any) => r.type === 'field' || r.type === 'text');
        const escalaFields = recalibratedRegions.filter((r: any) => r.type === 'escala_1_4');
        const siNoFields = recalibratedRegions.filter((r: any) => r.type === 'si_no');
        const grupoFields = recalibratedRegions.filter((r: any) => r.type === 'grupo_exclusivo');
        const checkboxes = recalibratedRegions.filter((r: any) => r.type === 'box');

        // Construir lista de campos de texto
        const fieldsList = textFields.map((r: any) => {
          const hint = r.hint ? ` - ${r.hint}` : '';
          return `- "${r.label}" (pág ${(r.pageIndex || 0) + 1}, x=${Math.round(r.x)}%, y=${Math.round(r.y)}%)${hint}`;
        }).join('\n');

        // Construir lista de escalas 1-4
        const escalaList = escalaFields.map((r: any) => {
          const pregunta = r.pregunta ? ` "${r.pregunta}"` : '';
          return `- "${r.label}":${pregunta} (pág ${(r.pageIndex || 0) + 1}, y≈${Math.round(r.y)}%)`;
        }).join('\n');

        // Construir lista de campos Sí/No
        const siNoList = siNoFields.map((r: any) => {
          const pregunta = r.pregunta ? ` "${r.pregunta}"` : '';
          return `- "${r.label}":${pregunta} (pág ${(r.pageIndex || 0) + 1})`;
        }).join('\n');

        // Construir lista de grupos exclusivos
        const grupoList = grupoFields.map((r: any) => {
          const hint = r.hint ? ` - ${r.hint}` : '';
          return `- "${r.label}"${hint} (pág ${(r.pageIndex || 0) + 1})`;
        }).join('\n');

        // Construir lista de casillas individuales (formato antiguo)
        const checkboxList = checkboxes.map((r: any) => `- "${r.label}" (pág ${(r.pageIndex || 0) + 1}, x=${Math.round(r.x)}%, y=${Math.round(r.y)}%)`).join('\n');

        const prompt = `TAREA: Extraer datos del formulario FUNDAE "Cuestionario de Evaluación de Calidad".

═══════════════════════════════════════════════════════════════════════════════
⚠️ REGLAS CRÍTICAS - ESTE SISTEMA PROCESARÁ 18,000 DOCUMENTOS
═══════════════════════════════════════════════════════════════════════════════

REGLA 1 - NUNCA INVENTES: Si no ves una marca clara → devuelve "NC"
REGLA 2 - MARCAS MÚLTIPLES = NC: Si hay 2+ marcas en la misma fila → "NC"
REGLA 3 - ANTE LA DUDA → "NC"

═══════════════════════════════════════════════════════════════════════════════
CAMPOS DE TEXTO (${textFields.length} campos) - Extraer valor exacto o ""
═══════════════════════════════════════════════════════════════════════════════
${fieldsList || '(ninguno)'}

🔥 CRÍTICO para numero_expediente: Puede tener 1-2 LETRAS al final (ej: "F240012AB").
   SIEMPRE incluye las letras finales.

═══════════════════════════════════════════════════════════════════════════════
VALORACIONES ESCALA 1-4 (${escalaFields.length} campos)
═══════════════════════════════════════════════════════════════════════════════
${escalaList || '(ninguno)'}

MÉTODO DE LECTURA:
1. Localiza la fila de la pregunta en la página 2
2. Las 4 casillas están en columnas: 1=izquierda, 2, 3, 4=derecha
3. Busca cuál casilla tiene marca (X, ✓, círculo, relleno)
4. Devuelve el NÚMERO de la posición (1, 2, 3 o 4)
5. Si ninguna marcada o no clara → "NC"

Escala: 1=Completamente en desacuerdo, 2=En desacuerdo, 3=De acuerdo, 4=Completamente de acuerdo

═══════════════════════════════════════════════════════════════════════════════
CAMPOS SÍ/NO (${siNoFields.length} campos)
═══════════════════════════════════════════════════════════════════════════════
${siNoList || '(ninguno)'}

Devolver exactamente: "Sí" o "No" (con tilde). Si no hay marca clara → "NC"

═══════════════════════════════════════════════════════════════════════════════
GRUPOS EXCLUSIVOS (${grupoFields.length} campos) - UNA sola opción marcada
═══════════════════════════════════════════════════════════════════════════════
${grupoList || '(ninguno)'}

Devolver el CÓDIGO numérico de la opción marcada según el hint. Si ninguna → "9" (NC)

═══════════════════════════════════════════════════════════════════════════════
CASILLAS INDIVIDUALES (${checkboxes.length} casillas) - Formato antiguo
═══════════════════════════════════════════════════════════════════════════════
${checkboxList || '(ninguno)'}

Devolver "[X]" si marcada, "[ ]" si vacía.

═══════════════════════════════════════════════════════════════════════════════

Responde en JSON con TODOS los campos solicitados:
{
  "numero_expediente": "F24XXXXAB",
  "valoracion_1_1": "3",
  "valoracion_8_1": "Sí",
  "sexo": "1",
  ...
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
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
            success: value !== '' && value !== undefined && value !== 'NC'
          });
        }

        // Log de campos críticos FUNDAE
        const exp = parsed.numero_expediente || parsed['1. Nº expediente'] || '';
        const acc = parsed.numero_accion || parsed['4. Nº Acción'] || '';
        const grp = parsed.numero_grupo || parsed['5. Nº grupo'] || '';
        console.log(`   🔍 Campos clave: exp="${exp}", acc="${acc}", grp="${grp}"`);

        // Log de valoraciones
        const valoraciones = Object.entries(parsed).filter(([k]) => k.startsWith('valoracion_'));
        const valOK = valoraciones.filter(([_, v]) => v && v !== 'NC').length;
        console.log(`   📊 Valoraciones: ${valOK}/${valoraciones.length} con valor`);

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
