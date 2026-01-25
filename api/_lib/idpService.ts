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

    // Prompt ultra-preciso - detectar ESPACIOS VACÍOS, no etiquetas
    const prompt = `TAREA: Detectar ÚNICAMENTE los espacios vacíos para rellenar en este formulario.

SISTEMA DE COORDENADAS (0-1000):
- (0,0) = esquina SUPERIOR IZQUIERDA
- (1000,1000) = esquina INFERIOR DERECHA
- x = distancia horizontal desde la izquierda
- y = distancia vertical desde ARRIBA

⚠️ MUY IMPORTANTE - QUÉ DETECTAR:

1. CASILLAS VACÍAS ('box'):
   - Cuadrados PEQUEÑOS (aprox. 15-30 unidades) con INTERIOR VACÍO para marcar con X
   - Típicamente junto a opciones como: "Sí/No", "1/2/3/4", "NC/1/2/3/4"
   - NO detectes rectángulos grandes ni celdas de tabla
   - Tamaño típico: width=20, height=20

2. CAMPOS DE ESCRITURA ('field'):
   - LÍNEAS HORIZONTALES vacías donde se escribe texto a mano
   - Espacios en blanco JUNTO A etiquetas como "Nombre:", "DNI:", "Fecha:"
   - Recuadros VACÍOS para rellenar datos
   - NO detectes el texto impreso de las etiquetas

⛔ NO DETECTAR:
- Texto impreso (títulos, etiquetas, instrucciones)
- Celdas de tabla que contienen texto
- Logos, sellos o imágenes
- Bordes decorativos

EJEMPLOS CORRECTOS:
- Campo "Nº expediente" con línea vacía al lado: x=250, y=340, width=150, height=25, type="field"
- Casilla pequeña vacía junto a "Mujer": x=820, y=450, width=20, height=20, type="box"
- Campo para escribir edad: x=180, y=450, width=80, height=25, type="field"

Devuelve JSON array con: label (qué dato va ahí), type ("box"/"field"), x, y, width, height (escala 0-1000).`;

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

    // Normalizar de escala 0-1000 a 0-100 (porcentaje)
    return data.map((item: any) => ({
      id: crypto.randomUUID(),
      label: item.label,
      type: (item.type === 'box' || item.type === 'checkbox') ? 'box' : 'field',
      x: Math.max(0, Math.min(100, item.x / 10)),
      y: Math.max(0, Math.min(100, item.y / 10)),
      width: Math.max(0.5, Math.min(100, item.width / 10)),
      height: Math.max(0.5, Math.min(100, item.height / 10)),
    }));
  });
};
