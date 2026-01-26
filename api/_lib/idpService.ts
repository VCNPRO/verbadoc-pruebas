// @ts-nocheck
import { GoogleGenAI, Type } from "@google/genai";
import { Region, FormTemplate } from './types.js';

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

export const classifyDocument = async (base64Image: string, templates: FormTemplate[], mimeType: string = 'image/jpeg'): Promise<{id: string, confidence: number} | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

    // 🔥 MEJORADO: Incluir nombres y descripciones de las plantillas, no solo IDs
    const templateDescriptions = templates.map((t, index) => {
      const regionCount = Array.isArray(t.regions) ? t.regions.length : 0;
      const fieldTypes = Array.isArray(t.regions)
        ? [...new Set(t.regions.map((r: any) => r.type))].join(', ')
        : 'desconocido';
      return `${index + 1}. ID: "${t.id}" | Nombre: "${t.name}" | Campos: ${regionCount} | Tipos: ${fieldTypes}`;
    }).join('\n');

    const prompt = `TAREA: Clasificar este documento para identificar qué plantilla de formulario coincide mejor.

PLANTILLAS DISPONIBLES:
${templateDescriptions}

INSTRUCCIONES:
1. Analiza la estructura visual del documento (encabezados, logos, disposición de campos)
2. Compara con las plantillas disponibles basándote en el NOMBRE y estructura
3. Si el documento es un formulario FUNDAE de participantes, busca plantillas con ese nombre
4. Responde con el ID de la plantilla que mejor coincide

IMPORTANTE: Si ninguna plantilla coincide claramente, usa confidence < 0.5

Responde en JSON: { "match_id": "el-id-de-la-plantilla", "confidence": 0.0-1.0, "reason": "breve explicación" }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text.replace(/```json|```/g, "").trim());
    console.log(`   📋 Clasificación: "${data.reason}" (${Math.round((data.confidence || 0) * 100)}%)`);
    return data.match_id ? { id: data.match_id, confidence: data.confidence } : null;
  });
};

// Detectar posición de anclas en un documento nuevo
export const detectAnchors = async (base64Image: string, anchors: Region[], mimeType: string = 'image/jpeg'): Promise<{label: string, x: number, y: number}[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

    const anchorDescriptions = anchors.map(a => `"${a.label}": buscar en zona aproximada x=${a.x}%, y=${a.y}%`).join('\n');

    const prompt = `TAREA: Localizar puntos de referencia (anclas) en este documento.

ANCLAS A BUSCAR:
${anchorDescriptions}

INSTRUCCIONES:
1. Cada ancla es un elemento FIJO del formulario (logo, título, esquina de recuadro)
2. Encuentra la posición EXACTA de cada ancla en este documento específico
3. Las coordenadas son en porcentaje (0-100%)

Responde JSON: { "anchors": [{"label": "nombre", "x": número, "y": número}, ...] }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text.replace(/```json|```/g, "").trim());
    return data.anchors || [];
  });
};

// Calcular transformación basada en anclas
const calculateTransformation = (
  originalAnchors: Region[],
  detectedAnchors: {label: string, x: number, y: number}[]
): { offsetX: number, offsetY: number, scaleX: number, scaleY: number } => {

  // Si no hay anclas detectadas, no hay transformación
  if (detectedAnchors.length === 0) {
    console.log("   ⚠️ No se detectaron anclas, usando coordenadas originales");
    return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };
  }

  // Calcular offset promedio basado en todas las anclas
  let totalOffsetX = 0;
  let totalOffsetY = 0;
  let matchedCount = 0;

  for (const original of originalAnchors) {
    const detected = detectedAnchors.find(d => d.label === original.label);
    if (detected) {
      totalOffsetX += detected.x - original.x;
      totalOffsetY += detected.y - original.y;
      matchedCount++;
    }
  }

  if (matchedCount === 0) {
    console.log("   ⚠️ Ningún ancla coincidió, usando coordenadas originales");
    return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };
  }

  const offsetX = totalOffsetX / matchedCount;
  const offsetY = totalOffsetY / matchedCount;

  // Para escala, necesitamos al menos 2 anclas distantes
  let scaleX = 1;
  let scaleY = 1;

  if (matchedCount >= 2) {
    // Buscar dos anclas con mayor distancia horizontal y vertical
    const matched = originalAnchors.filter(o => detectedAnchors.find(d => d.label === o.label));
    if (matched.length >= 2) {
      const [a1, a2] = [matched[0], matched[matched.length - 1]];
      const d1 = detectedAnchors.find(d => d.label === a1.label)!;
      const d2 = detectedAnchors.find(d => d.label === a2.label)!;

      const originalDistX = Math.abs(a2.x - a1.x);
      const originalDistY = Math.abs(a2.y - a1.y);
      const detectedDistX = Math.abs(d2.x - d1.x);
      const detectedDistY = Math.abs(d2.y - d1.y);

      if (originalDistX > 5) scaleX = detectedDistX / originalDistX;
      if (originalDistY > 5) scaleY = detectedDistY / originalDistY;

      // Limitar escala a ±20% para evitar errores extremos
      scaleX = Math.max(0.8, Math.min(1.2, scaleX));
      scaleY = Math.max(0.8, Math.min(1.2, scaleY));
    }
  }

  console.log(`   📐 Transformación calculada: offset(${offsetX.toFixed(2)}%, ${offsetY.toFixed(2)}%), escala(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`);

  return { offsetX, offsetY, scaleX, scaleY };
};

// Aplicar transformación a una región
const applyTransformation = (
  region: Region,
  transform: { offsetX: number, offsetY: number, scaleX: number, scaleY: number },
  referencePoint: { x: number, y: number } // Punto de referencia (primera ancla)
): Region => {
  // Aplicar escala relativa al punto de referencia, luego offset
  const newX = referencePoint.x + (region.x - referencePoint.x) * transform.scaleX + transform.offsetX;
  const newY = referencePoint.y + (region.y - referencePoint.y) * transform.scaleY + transform.offsetY;
  const newWidth = region.width * transform.scaleX;
  const newHeight = region.height * transform.scaleY;

  return {
    ...region,
    x: Math.max(0, Math.min(100, newX)),
    y: Math.max(0, Math.min(100, newY)),
    width: Math.max(1, Math.min(50, newWidth)),
    height: Math.max(0.5, Math.min(20, newHeight))
  };
};

export const recalibrateRegions = async (base64Image: string, currentRegions: Region[], mimeType: string = 'image/jpeg'): Promise<Region[]> => {
  // Separar anclas de campos de datos
  const anchors = currentRegions.filter(r => r.isAnchor);
  const dataRegions = currentRegions.filter(r => !r.isAnchor);

  console.log(`   🔗 Anclas definidas: ${anchors.length}`);

  // Si no hay anclas definidas, devolver regiones sin cambios
  if (anchors.length === 0) {
    console.log("   ⚠️ No hay anclas definidas en la plantilla. Usando coordenadas originales.");
    console.log("   💡 Tip: Marca 2-3 elementos fijos como anclas para mejor precisión.");
    return currentRegions;
  }

  try {
    // Detectar posición de anclas en el documento nuevo
    const detectedAnchors = await detectAnchors(base64Image, anchors, mimeType);
    console.log(`   🎯 Anclas detectadas: ${detectedAnchors.length}/${anchors.length}`);

    // Calcular transformación
    const transform = calculateTransformation(anchors, detectedAnchors);

    // Punto de referencia (primera ancla original)
    const referencePoint = { x: anchors[0].x, y: anchors[0].y };

    // Aplicar transformación a todas las regiones de datos
    const calibratedRegions = dataRegions.map(region =>
      applyTransformation(region, transform, referencePoint)
    );

    // Devolver anclas + regiones calibradas
    return [...anchors, ...calibratedRegions];

  } catch (error) {
    console.error("   ❌ Error en recalibración:", error);
    console.log("   ↩️ Usando coordenadas originales como fallback");
    return currentRegions;
  }
};

export const extractWithConfidence = async (base64Image: string, region: Region, mimeType: string = 'image/jpeg'): Promise<{value: string}> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

    // Determinar si es un campo de expediente por su label
    const labelLower = (region.label || '').toLowerCase();
    const isExpedienteField = labelLower.includes('expediente') || labelLower.includes('exp');

    let prompt: string;
    if (region.type === 'box') {
      prompt = `VISIÓN CRÍTICA: Analiza el recuadro. ¿Hay una marca deliberada (X, ✓, raya)?
         Ignora bordes del cuadro o motas de polvo.
         Responde "[X]" si está marcada, "[ ]" si está vacía.`;
    } else if (isExpedienteField) {
      // Prompt específico para campos de expediente
      prompt = `Extrae el código de expediente EXACTAMENTE como aparece.
         🔥 CRÍTICO: Los expedientes pueden tener 1-2 LETRAS al final (ej: "F240012AB", "F230045XY").
         SIEMPRE incluye TODAS las letras y números. NO omitas letras finales.
         Si no hay nada, responde "N/A".`;
    } else {
      prompt = `Extrae el texto manuscrito o impreso EXACTAMENTE como aparece.
         Incluye TODOS los caracteres alfanuméricos (letras y números).
         Si no hay nada, responde "N/A".`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }] }
    });

    return { value: response.text?.trim() || "N/A" };
  });
};

export const analyzeDocumentStructure = async (base64Image: string, mimeType: string = 'image/jpeg'): Promise<Region[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

    // Prompt optimizado para formularios FUNDAE - estructura dos columnas
    const prompt = `TAREA: Detectar TODOS los campos rellenables de este formulario.

ESTRUCTURA DEL FORMULARIO:
- IZQUIERDA (x: 5-50%): Textos de preguntas y campos para escribir datos
- DERECHA (x: 75-95%): Casillas de verificación para respuestas

COORDENADAS en porcentaje 0-100:
- x=0: borde izquierdo, x=100: borde derecho
- y=0: borde superior, y=100: borde inferior

═══════════════════════════════════════════════════════
CAMPOS DE TEXTO (type="field") - ZONA IZQUIERDA:
═══════════════════════════════════════════════════════
Busca en la parte IZQUIERDA del formulario:
- Líneas horizontales vacías para escribir
- Espacios subrayados o punteados
- Recuadros vacíos junto a etiquetas
- Campos para: expediente, fecha, DNI, nombre, firma, observaciones

Coordenadas típicas de fields:
- x: entre 5% y 50% (zona izquierda)
- width: 15-40%
- height: 2-3%

═══════════════════════════════════════════════════════
CASILLAS (type="box") - ZONA DERECHA:
═══════════════════════════════════════════════════════
Busca en la parte DERECHA del formulario:
- Cuadrados pequeños vacíos para marcar
- Escalas: 1, 2, 3, 4 (4 casillas por fila)
- Opciones: Sí/No (2 casillas por fila)

Coordenadas típicas de boxes:
- x: entre 75% y 95% (zona derecha)
- width: 2-3%
- height: 1.5-2.5%

═══════════════════════════════════════════════════════
RECORRE TODA LA PÁGINA LÍNEA POR LÍNEA:
═══════════════════════════════════════════════════════
Desde y=5% hasta y=95%, detecta en CADA línea:
1. Si hay campo de texto a la izquierda → añádelo
2. Si hay casillas a la derecha → añade CADA una

LABELS:
- Fields: "expediente", "denominacion", "nombre", "dni", "fecha", "firma"
- Boxes escala: "p1_1", "p1_2", "p1_3", "p1_4" (pregunta 1, opciones 1-4)
- Boxes si/no: "p8_si", "p8_no"

EJEMPLO de una fila con campo y casillas:
{"label":"observaciones","type":"field","x":10,"y":45,"width":35,"height":2.5}
{"label":"p5_1","type":"box","x":78,"y":45,"width":2.2,"height":2}
{"label":"p5_2","type":"box","x":82,"y":45,"width":2.2,"height":2}
{"label":"p5_3","type":"box","x":86,"y":45,"width":2.2,"height":2}
{"label":"p5_4","type":"box","x":90,"y":45,"width":2.2,"height":2}

Devuelve JSON array con ABSOLUTAMENTE TODOS los elementos detectados.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["box", "field"] },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER }
            },
            required: ['label', 'type', 'x', 'y', 'width', 'height']
          }
        }
      }
    });

    const data = JSON.parse(response.text.replace(/```json|```/g, "").trim());

    console.log(`📊 Detectados ${data.length} elementos`);
    console.log(`   - Fields: ${data.filter((d:any) => d.type === 'field').length}`);
    console.log(`   - Boxes: ${data.filter((d:any) => d.type === 'box').length}`);

    // Validar rangos y crear regiones
    return data.map((item: any) => ({
      id: crypto.randomUUID(),
      label: item.label,
      type: item.type === 'box' ? 'box' : 'field',
      x: Math.max(0, Math.min(100, item.x)),
      y: Math.max(0, Math.min(100, item.y)),
      width: Math.max(1, Math.min(80, item.width)),
      height: Math.max(1, Math.min(30, item.height)),
    }));
  });
};
