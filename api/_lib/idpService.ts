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

    const prompt = `TAREA: Analizar este formulario y detectar TODOS los elementos interactivos y sus etiquetas.

SISTEMA DE COORDENADAS:
- Usa porcentajes de 0 a 100 (NO 0-1000)
- (0,0) = esquina SUPERIOR IZQUIERDA de la página
- (100,100) = esquina INFERIOR DERECHA de la página
- x = porcentaje horizontal desde la izquierda
- y = porcentaje vertical desde arriba

IMPORTANTE: Sé MUY PRECISO con las coordenadas. Mide visualmente dónde está cada elemento.

TIPOS DE ELEMENTOS A DETECTAR:

1. 'field' - CAMPOS PARA ESCRIBIR:
   - Líneas horizontales donde se escribe a mano
   - Recuadros vacíos para datos (nombre, fecha, DNI, etc.)
   - Espacios subrayados o con puntos suspensivos
   - Label: nombre del dato que va ahí (ej: "nombre_participante", "dni", "fecha_nacimiento")

2. 'box' - CASILLAS DE VERIFICACIÓN:
   - Cuadrados pequeños para marcar con X o ✓
   - Típico en opciones: Sí/No, escalas 1-4, NC/1/2/3/4
   - Tamaño típico: width=2-3, height=2-3
   - Label: identificador único (ej: "pregunta_1_opcion_1", "sexo_hombre", "valoracion_2")

3. 'label' - ETIQUETAS DE TEXTO (como referencia/ancla):
   - Títulos de secciones importantes
   - Textos junto a campos que identifican qué dato pedir
   - Preguntas numeradas
   - Label: el texto exacto o resumen

ESTRUCTURA DEL FORMULARIO - Detecta TODO:
- Encabezados y títulos de secciones
- Datos de identificación (nombre, DNI, fecha, etc.)
- Todas las preguntas numeradas
- Todas las opciones de respuesta con sus casillas
- Campos de firma y fecha al final

EJEMPLO DE SALIDA:
[
  {"label": "TITULO_SECCION", "type": "label", "x": 5, "y": 2, "width": 90, "height": 3},
  {"label": "numero_expediente", "type": "field", "x": 25, "y": 8, "width": 20, "height": 2.5},
  {"label": "Nº Expediente", "type": "label", "x": 5, "y": 8, "width": 18, "height": 2.5},
  {"label": "pregunta_1_NC", "type": "box", "x": 45, "y": 35, "width": 2.5, "height": 2.5},
  {"label": "pregunta_1_1", "type": "box", "x": 50, "y": 35, "width": 2.5, "height": 2.5}
]

Devuelve un JSON array COMPLETO con TODOS los elementos del formulario.`;

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
              type: { type: Type.STRING, enum: ["box", "field", "label"] },
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

    // Ya están en porcentaje (0-100), solo validar rangos
    return data.map((item: any) => ({
      id: crypto.randomUUID(),
      label: item.label,
      type: item.type === 'box' ? 'box' : item.type === 'label' ? 'label' : 'field',
      x: Math.max(0, Math.min(100, item.x)),
      y: Math.max(0, Math.min(100, item.y)),
      width: Math.max(0.5, Math.min(100, item.width)),
      height: Math.max(0.5, Math.min(100, item.height)),
      isAnchor: item.type === 'label', // Marcar labels como anclas
    }));
  });
};
