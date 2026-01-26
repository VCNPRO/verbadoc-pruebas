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

export const classifyDocument = async (base64Image: string, templates: FormTemplate[]): Promise<{id: string, confidence: number} | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
    const prompt = `Analiza este documento y compáralo con los siguientes IDs de plantilla: ${templates.map(t => t.id).join(', ')}. 
    Identifica cuál coincide mejor basándote en la estructura visual. 
    Responde estrictamente en formato JSON: { "match_id": "string", "confidence": number }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text.replace(/```json|```/g, "").trim());
    return data.match_id ? { id: data.match_id, confidence: data.confidence } : null;
  });
};

export const recalibrateRegions = async (base64Image: string, currentRegions: Region[]): Promise<Region[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
    const prompt = `Este documento puede tener ligeras variaciones de alineación o escala. 
    Ajusta las coordenadas (x, y, width, height) para estos campos: ${currentRegions.map(r => r.label).join(', ')}. 
    Mantén el nombre del label intacto. 
    Responde solo JSON: { "recalibrated": [...] }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }] },
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text.replace(/```json|```/g, "").trim());
    return currentRegions.map(r => {
      const match = data.recalibrated?.find((m: any) => m.label === r.label);
      return match ? { ...r, ...match } : r;
    });
  });
};

export const extractWithConfidence = async (base64Image: string, region: Region): Promise<{value: string}> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
    
    const prompt = region.type === 'box' 
      ? `VISIÓN CRÍTICA: Analiza el recuadro. ¿Hay una marca deliberada (X, ✓, raya)? 
         Ignora bordes del cuadro o motas de polvo. 
         Responde "[X]" si está marcada, "[ ]" si está vacía.`
      : `Extrae el texto manuscrito o impreso. Si no hay nada, responde "N/A".`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }] }
    });

    return { value: response.text?.trim() || "N/A" };
  });
};

export const analyzeDocumentStructure = async (base64Image: string): Promise<Region[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

    // Prompt optimizado para detección precisa de bounding boxes
    const prompt = `Eres un experto en análisis de formularios. Analiza esta imagen de formulario y detecta TODOS los campos rellenables.

INSTRUCCIONES DE COORDENADAS:
Las coordenadas deben ser en porcentaje (0-100) de la imagen completa:
- x: posición horizontal (0=izquierda, 100=derecha)
- y: posición vertical (0=arriba, 100=abajo)
- width: ancho del elemento
- height: alto del elemento

MIDE CON PRECISIÓN mirando la posición real de cada elemento en la imagen.

DETECTAR OBLIGATORIAMENTE:

A) CAMPOS DE TEXTO (type="field"):
- Campo "Nº de expediente" - línea para escribir número
- Campo "Denominación de la acción" - espacio para texto
- Campo "Nombre y apellidos del participante" - línea larga
- Campo "DNI/NIE" - espacio pequeño
- Campo "Fecha de nacimiento" - espacio para fecha
- Campo "Teléfono" - espacio para número
- Campo de firma - recuadro grande al final
- Campo de fecha de firma
- Cualquier otro espacio subrayado o recuadro vacío para escribir

B) CASILLAS DE VERIFICACIÓN (type="box"):
- Casillas de Sexo: Hombre/Mujer
- Casillas de categoría profesional
- Casillas de nivel de estudios
- Casillas de satisfacción/valoración (escalas 1-4 o NC/1/2/3/4)
- DETECTA CADA CASILLA INDIVIDUAL con su label único

FORMATO DE LABELS:
- Campos: "expediente", "denominacion", "nombre_apellidos", "dni", "fecha_nac", "telefono", "firma", "fecha_firma"
- Casillas sexo: "sexo_hombre", "sexo_mujer"
- Casillas escala: "p1_1", "p1_2", "p1_3", "p1_4" (pregunta_opción)

Responde SOLO con el JSON array, sin explicaciones.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }]
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
