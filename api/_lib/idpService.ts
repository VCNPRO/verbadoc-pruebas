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

    // Prompt ultra-preciso con escala 0-1000 para mayor precisión
    const prompt = `TAREA: Análisis forense de formulario para extracción de datos por coordenadas.

INSTRUCCIONES DE COORDENADAS (MUY IMPORTANTE):
- Imagina que la imagen tiene un sistema de coordenadas de 0 a 1000 en ambos ejes
- (0,0) = esquina SUPERIOR IZQUIERDA de la imagen
- (1000,1000) = esquina INFERIOR DERECHA de la imagen
- x = posición horizontal desde la izquierda
- y = posición vertical desde ARRIBA hacia abajo
- width/height = tamaño del elemento

ELEMENTOS A DETECTAR:
1. CASILLAS ('box'): Cualquier cuadrado pequeño para marcar (checkbox, círculo, recuadro de selección)
   - Busca especialmente grupos de casillas: NC, 1, 2, 3, 4 o Sí/No
   - Cada casilla individual debe ser un elemento separado

2. CAMPOS DE TEXTO ('field'): Líneas o espacios para escribir texto/números
   - Campos de nombre, fecha, DNI, dirección, etc.
   - Líneas punteadas o espacios en blanco para rellenar

PROCESO DE DETECCIÓN:
1. Escanea la imagen de ARRIBA a ABAJO, de IZQUIERDA a DERECHA
2. Para cada elemento encontrado, calcula su posición EXACTA en la escala 0-1000
3. Asegúrate de que x+width <= 1000 y y+height <= 1000

EJEMPLO de coordenadas correctas:
- Un campo en la parte superior izquierda: x=50, y=80, width=200, height=30
- Una casilla en el centro: x=480, y=500, width=25, height=25
- Un campo abajo a la derecha: x=600, y=850, width=350, height=40

Devuelve un array JSON con: label (nombre descriptivo), type ("box" o "field"), x, y, width, height (todos en escala 0-1000).`;

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
