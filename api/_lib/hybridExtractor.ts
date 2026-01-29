/**
 * FASE 3: Extractor Híbrido — Gemini lee TODO directamente
 * api/_lib/hybridExtractor.ts
 *
 * Procesamiento 100% server-side:
 * 1. Recibe PDF buffer
 * 2. Renderiza a PNG con pdfjs-dist + @napi-rs/canvas (server-side, 300 DPI)
 * 3. Gemini lee TODOS los campos (texto + checkboxes) en una sola llamada
 * 4. Validación de valores
 *
 * Feature flag: USE_HYBRID_EXTRACTION
 */

import { renderPdfToImages, type RenderedPage } from './pdfRenderer.js';
import { GoogleGenAI } from '@google/genai';

// --- Types ---

export interface HybridExtractionResult {
  extractedData: Record<string, any>;
  checkboxResults: Record<string, {
    value: any;
    state: 'GEMINI_READ';
    confidence: number;
    needsHumanReview: boolean;
  }>;
  textResults: Record<string, any>;
  overallConfidence: number;
  fieldsNeedingReview: string[];
  method: 'hybrid_cv_gemini';
  localizationMethod: 'gemini_direct';
  processingTimeMs: number;
}

// --- Prompt completo: Gemini lee TODO ---
const FULL_EXTRACTION_PROMPT = `Eres un lector experto de formularios FUNDAE de evaluación de cursos.
Analiza las imágenes de este formulario y extrae TODOS los campos.

PÁGINA 1 — Datos del participante:
- numero_expediente: Formato "FXXXXXX" o código alfanumérico. Parte superior.
- perfil: Una letra mayúscula (ej: "B").
- cif_empresa: Formato letra + 8 dígitos (ej: "B12345678").
- numero_accion: Número de 1-5 dígitos.
- numero_grupo: Número de 1-4 dígitos.
- denominacion_aaff: Nombre completo del curso/acción formativa.
- modalidad: "Presencial", "Teleformación" o "Mixta". Mira qué checkbox está marcado.
- sexo: "1" (Mujer), "2" (Hombre) o "9" (No contesta). Mira qué checkbox está marcado.
- edad: Número entero entre 16 y 99.
- titulacion: Código de la titulación marcada. Posibles códigos: 1, 11, 111, 12, 2, 21, 3, 4, 41, 42, 5, 6, 6.1, 7, 7.1, 7.3, 7.4, 8, 9, 99. Devuelve el código del checkbox marcado.
- otra_titulacion_especificar: Texto libre si existe.
- categoria_profesional: "1" a "6" o "9" (No contesta). Mira qué checkbox está marcado.
- horario_curso: "1" (Dentro jornada), "2" (Fuera), "3" (Ambas), "9" (NC).
- porcentaje_jornada: "1" (<25%), "2" (25-50%), "3" (>50%), "9" (NC).
- tamaño_empresa: "1" (1-9), "2" (10-49), "3" (50-99), "4" (100-250), "5" (>250), "9" (NC).
- lugar_trabajo: Nombre de provincia española.

PÁGINA 2 — Valoraciones (tabla con escala NC, 1, 2, 3, 4):
Para cada pregunta de valoración, indica qué columna está marcada: "NC", "1", "2", "3" o "4".
Si no hay ninguna marcada, devuelve "NC".

- valoracion_1_1: Pregunta 1.1 (Organización del curso)
- valoracion_1_2: Pregunta 1.2
- valoracion_2_1: Pregunta 2.1 (Contenidos y metodología)
- valoracion_2_2: Pregunta 2.2
- valoracion_3_1: Pregunta 3.1 (Duración y horario)
- valoracion_3_2: Pregunta 3.2
- valoracion_4_1_formadores: Pregunta 4.1 fila FORMADORES
- valoracion_4_1_tutores: Pregunta 4.1 fila TUTORES
- valoracion_4_2_formadores: Pregunta 4.2 fila FORMADORES
- valoracion_4_2_tutores: Pregunta 4.2 fila TUTORES
- valoracion_5_1: Pregunta 5.1 (Medios didácticos)
- valoracion_5_2: Pregunta 5.2
- valoracion_6_1: Pregunta 6.1 (Instalaciones)
- valoracion_6_2: Pregunta 6.2
- valoracion_7_1: Pregunta 7.1 (Solo teleformación/mixta)
- valoracion_7_2: Pregunta 7.2
- valoracion_8_1: Pregunta 8.1 — "Sí" o "No" (checkbox binario)
- valoracion_8_2: Pregunta 8.2 — "Sí" o "No" (checkbox binario)
- valoracion_9_1: Pregunta 9.1 (Valoración general)
- valoracion_9_2: Pregunta 9.2
- valoracion_9_3: Pregunta 9.3
- valoracion_9_4: Pregunta 9.4
- valoracion_9_5: Pregunta 9.5
- valoracion_10: Pregunta 10 (Grado satisfacción general)
- recomendaria_curso: "Sí" o "No" (checkbox binario al final)
- sugerencias: Texto libre del participante.
- fecha_cumplimentacion: Formato DD/MM/YYYY.

REGLAS CRÍTICAS:
- Para checkboxes: busca una MARCA visible (X, ✓, relleno, trazo de bolígrafo) dentro del cuadrado.
- Un checkbox vacío (solo el cuadrado sin marca) = NO marcado.
- Si ningún checkbox de un grupo está marcado, devuelve "NC" (No Contesta).
- Si no puedes leer un campo de texto, devuelve null.
- NO inventes valores. Si no ves marca clara, devuelve "NC".
- temperature 0 — sé determinista y preciso.

Devuelve SOLO un JSON con todos los campos listados arriba.`;

/**
 * Extracción directa: Gemini lee todo el formulario.
 */
export async function extractHybrid(
  pdfBuffer: Buffer,
  options?: {
    geminiApiKey?: string;
    geminiModel?: string;
  }
): Promise<HybridExtractionResult> {
  const startTime = Date.now();
  const apiKey = options?.geminiApiKey || process.env.GOOGLE_API_KEY || '';
  const modelId = options?.geminiModel || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('No hay GOOGLE_API_KEY configurada');
  }

  // ========================================
  // PASO 1: Renderizar PDF a PNG (server-side)
  // ========================================
  console.log('[hybridExtractor] Renderizando PDF a PNG server-side (300 DPI)...');
  let pages: RenderedPage[];
  try {
    pages = await renderPdfToImages(pdfBuffer, 300);
  } catch (error: any) {
    console.error('[hybridExtractor] Error renderizando PDF:', error.message);
    throw new Error(`No se pudo renderizar el PDF: ${error.message}`);
  }

  if (pages.length === 0) {
    throw new Error('El PDF no contiene páginas');
  }

  console.log(`[hybridExtractor] ${pages.length} página(s) renderizadas`);

  // ========================================
  // PASO 2: Gemini lee TODO directamente
  // ========================================
  console.log(`[hybridExtractor] Gemini (${modelId}) leyendo formulario completo...`);

  const ai = new GoogleGenAI({ apiKey });

  // Enviar solo páginas 1 y 2 (donde están los datos FUNDAE)
  const pagesToSend = pages.filter(p => p.pageNumber <= 2);
  const parts: any[] = [{ text: FULL_EXTRACTION_PROMPT }];

  for (const page of pagesToSend) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: page.buffer.toString('base64'),
      },
    });
  }

  const response = await ai.models.generateContent({
    model: modelId,
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      temperature: 0,
      topK: 1,
      topP: 0.1,
    },
  });

  const responseText = response.text || '{}';
  let extractedData: Record<string, any>;
  try {
    extractedData = JSON.parse(responseText.replace(/```json|```/g, '').trim());
  } catch (parseError: any) {
    console.error('[hybridExtractor] Error parseando respuesta Gemini:', parseError.message);
    console.error('[hybridExtractor] Respuesta raw:', responseText.substring(0, 500));
    throw new Error('Gemini devolvió JSON inválido');
  }

  console.log(`[hybridExtractor] Gemini extrajo ${Object.keys(extractedData).length} campos`);

  // ========================================
  // PASO 3: Validar y normalizar valores
  // ========================================
  const checkboxResults: HybridExtractionResult['checkboxResults'] = {};
  const fieldsNeedingReview: string[] = [];

  // Campos de valoración válidos
  const validValuationValues = ['NC', '1', '2', '3', '4', 'NA'];
  const validBinaryValues = ['Sí', 'Si', 'No', 'NC'];

  const valuationFields = [
    'valoracion_1_1', 'valoracion_1_2',
    'valoracion_2_1', 'valoracion_2_2',
    'valoracion_3_1', 'valoracion_3_2',
    'valoracion_4_1_formadores', 'valoracion_4_1_tutores',
    'valoracion_4_2_formadores', 'valoracion_4_2_tutores',
    'valoracion_5_1', 'valoracion_5_2',
    'valoracion_6_1', 'valoracion_6_2',
    'valoracion_7_1', 'valoracion_7_2',
    'valoracion_9_1', 'valoracion_9_2', 'valoracion_9_3', 'valoracion_9_4', 'valoracion_9_5',
    'valoracion_10',
  ];

  const binaryFields = ['valoracion_8_1', 'valoracion_8_2', 'recomendaria_curso'];

  // Validar valoraciones
  for (const field of valuationFields) {
    const raw = String(extractedData[field] || 'NC');
    const value = validValuationValues.includes(raw) ? raw : 'NC';
    extractedData[field] = value;
    checkboxResults[field] = {
      value,
      state: 'GEMINI_READ',
      confidence: value !== 'NC' ? 0.85 : 0.70,
      needsHumanReview: false,
    };
  }

  // Validar binarios
  for (const field of binaryFields) {
    let raw = String(extractedData[field] || 'NC');
    if (raw === 'Si') raw = 'Sí';
    const value = validBinaryValues.includes(raw) ? raw : 'NC';
    extractedData[field] = value;
    checkboxResults[field] = {
      value,
      state: 'GEMINI_READ',
      confidence: (value === 'Sí' || value === 'No') ? 0.85 : 0.70,
      needsHumanReview: false,
    };
  }

  // Validar campos de checkbox simples
  const simpleCheckboxFields = ['modalidad', 'sexo', 'titulacion', 'categoria_profesional', 'horario_curso', 'porcentaje_jornada', 'tamaño_empresa'];
  for (const field of simpleCheckboxFields) {
    const value = extractedData[field];
    if (value && value !== 'NC' && value !== null) {
      checkboxResults[field] = {
        value,
        state: 'GEMINI_READ',
        confidence: 0.85,
        needsHumanReview: false,
      };
    } else {
      checkboxResults[field] = {
        value: value || 'NC',
        state: 'GEMINI_READ',
        confidence: 0.70,
        needsHumanReview: false,
      };
    }
  }

  // Post-procesamiento: valoracion_7_x según modalidad
  const modalidad = String(extractedData.modalidad || '').toLowerCase();
  const esPresencial = modalidad.includes('presencial') && !modalidad.includes('mixta');
  if (esPresencial) {
    extractedData.valoracion_7_1 = 'NA';
    extractedData.valoracion_7_2 = 'NA';
  }

  // ========================================
  // PASO 4: Calcular confianza
  // ========================================
  const totalFields = Object.keys(checkboxResults).length;
  const fieldsWithValue = Object.values(checkboxResults).filter(r => r.value !== 'NC' && r.value !== null).length;
  const overallConfidence = totalFields > 0 ? Math.max(0.5, fieldsWithValue / totalFields) : 0.5;

  const processingTimeMs = Date.now() - startTime;
  console.log(`[hybridExtractor] Completado en ${processingTimeMs}ms, confianza: ${(overallConfidence * 100).toFixed(1)}%`);

  // Log resumen de valoraciones para diagnóstico
  for (const field of valuationFields) {
    console.log(`[Gemini] ${field}: ${extractedData[field]}`);
  }
  for (const field of binaryFields) {
    console.log(`[Gemini] ${field}: ${extractedData[field]}`);
  }

  return {
    extractedData,
    checkboxResults,
    textResults: extractedData,
    overallConfidence,
    fieldsNeedingReview,
    method: 'hybrid_cv_gemini',
    localizationMethod: 'gemini_direct',
    processingTimeMs,
  };
}
