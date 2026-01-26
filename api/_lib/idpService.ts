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
