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

    // Prompt optimizado para formularios FUNDAE
    const prompt = `Analiza este formulario y detecta TODOS los elementos rellenables con coordenadas EXACTAS en porcentaje (0-100).

COORDENADAS (0-100):
- x: porcentaje desde la izquierda
- y: porcentaje desde arriba
- width/height: tamaño en porcentaje

DETECTAR OBLIGATORIAMENTE:

1. CAMPOS DE TEXTO (type="field") - PRIORIDAD ALTA:
   - Líneas horizontales para escribir (subrayados, punteados)
   - Recuadros vacíos para datos
   - Espacios junto a etiquetas como: "Nº expediente:", "Fecha:", "DNI:", "Nombre:"
   - Campos de firma (recuadros grandes)
   - Campos de fecha de cumplimentación
   - Campos de observaciones o comentarios
   - TAMAÑO TÍPICO: width=10-40, height=2-4
   - Labels: "expediente", "fecha", "dni", "nombre", "firma", "observaciones"

2. CASILLAS DE VERIFICACIÓN (type="box"):
   - Cuadrados pequeños para marcar con X
   - Escalas de valoración 1, 2, 3, 4
   - Opciones Sí/No, Hombre/Mujer
   - TAMAÑO TÍPICO: width=2, height=2
   - Labels: "p1_1", "p1_2", "p1_3", "p1_4" (pregunta_opción)
   - Labels: "sexo_h", "sexo_m", "p8_si", "p8_no"

ESCANEA TODA LA IMAGEN de arriba a abajo:
- Busca PRIMERO todos los campos de texto (líneas, recuadros vacíos)
- Luego busca todas las casillas de verificación
- Detecta CADA elemento por separado

EJEMPLO:
[
  {"label":"expediente","type":"field","x":25,"y":8,"width":20,"height":2.5},
  {"label":"fecha","type":"field","x":70,"y":8,"width":15,"height":2.5},
  {"label":"nombre","type":"field","x":25,"y":12,"width":50,"height":2.5},
  {"label":"p1_1","type":"box","x":82,"y":20,"width":2,"height":2},
  {"label":"p1_2","type":"box","x":85,"y":20,"width":2,"height":2}
]

Devuelve JSON con TODOS los campos de texto Y casillas.`;

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
