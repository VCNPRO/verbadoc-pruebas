/**
 * FASE 3: Extractor Híbrido - CV Judge + Gemini para texto
 * api/_lib/hybridExtractor.ts
 *
 * Procesamiento 100% server-side:
 * 1. Recibe PDF buffer
 * 2. Renderiza a PNG con pdfjs-dist + @napi-rs/canvas (server-side)
 * 3. CV Judge para checkboxes (análisis determinista de píxeles)
 * 4. Gemini para campos de texto (prompt simplificado, temperature 0.1)
 * 5. Combinación + validación + confianza real basada en píxeles
 *
 * Feature flag: USE_HYBRID_EXTRACTION
 */

import sharp from 'sharp';
import { renderPdfToImages, type RenderedPage } from './pdfRenderer.js';
import {
  analyzeCheckboxField,
  analyzeValuationGroup,
  analyzeBinaryCheckbox,
  type FieldConfidenceState,
} from './checkboxJudge.js';
import { GoogleGenAI } from '@google/genai';

import { locateAllCheckboxes, type LocatorResult } from './geminiLocator.js';

// --- Types ---

export interface HybridExtractionResult {
  extractedData: Record<string, any>;
  checkboxResults: Record<string, {
    value: any;
    state: FieldConfidenceState;
    confidence: number;
    needsHumanReview: boolean;
  }>;
  textResults: Record<string, any>;
  overallConfidence: number;
  fieldsNeedingReview: string[];
  method: 'hybrid_cv_gemini';
  localizationMethod: 'gemini' | 'fallback';
  processingTimeMs: number;
}

// --- Text-only prompt for Gemini ---
const TEXT_ONLY_PROMPT = `TAREA: Extraer SOLO los campos de TEXTO de este formulario FUNDAE.
NO extraigas checkboxes ni valoraciones. Solo extrae estos campos:

1. numero_expediente: Formato "F24XXXX" o similar. Parte superior.
2. perfil: Una letra mayúscula (ej: "B").
3. cif_empresa: Formato letra + 8 dígitos (ej: "B12345678").
4. numero_accion: Número de 1-4 dígitos.
5. numero_grupo: Número de 1-4 dígitos.
6. denominacion_aaff: Nombre completo del curso.
7. edad: Número entero entre 16 y 99.
8. lugar_trabajo: Nombre de provincia española.
9. otra_titulacion_especificar: Texto libre si existe.
10. sugerencias: Texto libre del participante.
11. fecha_cumplimentacion: Formato DD/MM/YYYY.

REGLAS:
- Si un campo no es legible, devuelve null.
- NO inventes valores.
- NO extraigas checkboxes ni escalas 1-4.
- Devuelve SOLO JSON con estos campos.`;

/**
 * Extracción híbrida completa desde PDF buffer.
 * Todo server-side: renderizado, CV Judge, y Gemini.
 *
 * @param pdfBuffer - Buffer del archivo PDF original
 * @param options - API key y modelo de Gemini
 */
export async function extractHybrid(
  pdfBuffer: Buffer,
  options?: {
    geminiApiKey?: string;
    geminiModel?: string;
  }
): Promise<HybridExtractionResult> {
  const startTime = Date.now();
  const checkboxResults: HybridExtractionResult['checkboxResults'] = {};
  const fieldsNeedingReview: string[] = [];

  // ========================================
  // PASO 1: Renderizar PDF a PNG (server-side)
  // pdfjs-dist + @napi-rs/canvas, 300 DPI, PNG sin pérdida
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

  console.log(`[hybridExtractor] ${pages.length} página(s) renderizadas correctamente`);

  // Helper: obtener página por número (1-indexed)
  const getPage = (pageNum: number): RenderedPage | undefined =>
    pages.find(p => p.pageNumber === pageNum);

  // ========================================
  // PASO 1.5: Gemini localiza checkboxes dinámicamente
  // ========================================
  const apiKey = options?.geminiApiKey || process.env.GOOGLE_API_KEY || '';
  const modelId = options?.geminiModel || 'gemini-2.5-flash';
  let locatorResult: LocatorResult;

  if (apiKey) {
    console.log('[hybridExtractor] Localizando checkboxes con Gemini...');
    locatorResult = await locateAllCheckboxes(pages, apiKey, modelId);
    console.log(`[hybridExtractor] Localización: método=${locatorResult.method}`);
  } else {
    console.warn('[hybridExtractor] No hay API key, usando coordenadas fallback');
    const { FIELD_COORDINATES: FB_FIELD, VALUATION_COORDINATES: FB_VAL } = await import('./fundaeCoordinatesFallback.js');
    locatorResult = { fieldCoordinates: FB_FIELD, valuationCoordinates: FB_VAL, method: 'fallback' };
  }

  const FIELD_COORDINATES = locatorResult.fieldCoordinates;
  const VALUATION_COORDINATES = locatorResult.valuationCoordinates;

  // ========================================
  // PASO 2: CV Judge para checkboxes
  // Análisis determinista de píxeles sobre PNG sin pérdida
  // ========================================
  console.log('[hybridExtractor] Analizando checkboxes con CV Judge...');

  // 2a. Campos de checkbox simples (modalidad, sexo, titulación, etc.)
  const checkboxFields = FIELD_COORDINATES.mainLayout.checkbox_fields;

  for (const [fieldName, fieldOptions] of Object.entries(checkboxFields)) {
    // Campos binarios Sí/No se procesan en pares más abajo
    if (fieldName.includes('_si') || fieldName.includes('_no')) {
      continue;
    }

    const page = getPage(fieldOptions[0]?.page || 1);
    if (!page) continue;

    const result = await analyzeCheckboxField(
      page.buffer,
      page.width,
      page.height,
      fieldOptions.map(o => ({ value: o.value, code: o.code, box: o.box }))
    );

    const state: FieldConfidenceState = result.needsHumanReview
      ? 'CV_AMBIGUOUS'
      : 'CV_HIGH_CONFIDENCE';

    checkboxResults[fieldName] = {
      value: result.selectedCode || 'NC',
      state,
      confidence: result.confidence,
      needsHumanReview: result.needsHumanReview,
    };

    // Logging detallado para diagnóstico de coordenadas
    const densities = result.details.map(d => `${d.code}:${d.result.pixelDensity.toFixed(3)}(${d.result.state})`).join(', ');
    console.log(`[CV Judge] ${fieldName}: selected=${result.selectedCode || 'NC'}, conf=${result.confidence.toFixed(2)} | ${densities}`);

    if (result.needsHumanReview) {
      fieldsNeedingReview.push(fieldName);
    }
  }

  // 2b. Campos binarios Sí/No (evaluación 8.1, 8.2, recomendaría)
  const binaryPairs = [
    { name: 'valoracion_8_1', si: 'evaluacion_mecanismos_8_1_si', no: 'evaluacion_mecanismos_8_1_no' },
    { name: 'valoracion_8_2', si: 'evaluacion_mecanismos_8_2_si', no: 'evaluacion_mecanismos_8_2_no' },
    { name: 'recomendaria_curso', si: 'curso_recomendaria_si', no: 'curso_recomendaria_no' },
  ];

  for (const pair of binaryPairs) {
    const siOptions = checkboxFields[pair.si];
    const noOptions = checkboxFields[pair.no];
    if (!siOptions?.[0] || !noOptions?.[0]) continue;

    const page = getPage(siOptions[0].page);
    if (!page) continue;

    const result = await analyzeBinaryCheckbox(
      page.buffer,
      page.width,
      page.height,
      siOptions[0].box,
      noOptions[0].box
    );

    checkboxResults[pair.name] = {
      value: result.value,
      state: result.needsHumanReview ? 'CV_AMBIGUOUS' : 'CV_HIGH_CONFIDENCE',
      confidence: result.confidence,
      needsHumanReview: result.needsHumanReview,
    };

    console.log(`[CV Judge] ${pair.name}: ${result.value}, conf=${result.confidence.toFixed(2)}`);

    if (result.needsHumanReview) {
      fieldsNeedingReview.push(pair.name);
    }
  }

  // 2c. Valoraciones (escala NC, 1, 2, 3, 4)
  const valuationSections = [
    { prefix: 'valoracion_1_1', coords: VALUATION_COORDINATES.organizacion_curso.item_1_1 },
    { prefix: 'valoracion_1_2', coords: VALUATION_COORDINATES.organizacion_curso.item_1_2 },
    { prefix: 'valoracion_2_1', coords: VALUATION_COORDINATES.contenidos_metodologia.item_2_1 },
    { prefix: 'valoracion_2_2', coords: VALUATION_COORDINATES.contenidos_metodologia.item_2_2 },
    { prefix: 'valoracion_3_1', coords: VALUATION_COORDINATES.duracion_horario.item_3_1 },
    { prefix: 'valoracion_3_2', coords: VALUATION_COORDINATES.duracion_horario.item_3_2 },
    { prefix: 'valoracion_4_1_formadores', coords: VALUATION_COORDINATES.formadores_tutores.item_4_1.formadores },
    { prefix: 'valoracion_4_1_tutores', coords: VALUATION_COORDINATES.formadores_tutores.item_4_1.tutores },
    { prefix: 'valoracion_4_2_formadores', coords: VALUATION_COORDINATES.formadores_tutores.item_4_2.formadores },
    { prefix: 'valoracion_4_2_tutores', coords: VALUATION_COORDINATES.formadores_tutores.item_4_2.tutores },
    { prefix: 'valoracion_5_1', coords: VALUATION_COORDINATES.medios_didacticos.item_5_1 },
    { prefix: 'valoracion_5_2', coords: VALUATION_COORDINATES.medios_didacticos.item_5_2 },
    { prefix: 'valoracion_6_1', coords: VALUATION_COORDINATES.instalaciones_medios_tecnicos.item_6_1 },
    { prefix: 'valoracion_6_2', coords: VALUATION_COORDINATES.instalaciones_medios_tecnicos.item_6_2 },
    { prefix: 'valoracion_7_1', coords: VALUATION_COORDINATES.solo_teleformacion_mixta.item_7_1 },
    { prefix: 'valoracion_7_2', coords: VALUATION_COORDINATES.solo_teleformacion_mixta.item_7_2 },
    { prefix: 'valoracion_9_1', coords: VALUATION_COORDINATES.valoracion_general_curso.item_9_1 },
    { prefix: 'valoracion_9_2', coords: VALUATION_COORDINATES.valoracion_general_curso.item_9_2 },
    { prefix: 'valoracion_9_3', coords: VALUATION_COORDINATES.valoracion_general_curso.item_9_3 },
    { prefix: 'valoracion_9_4', coords: VALUATION_COORDINATES.valoracion_general_curso.item_9_4 },
    { prefix: 'valoracion_9_5', coords: VALUATION_COORDINATES.valoracion_general_curso.item_9_5 },
    { prefix: 'valoracion_10', coords: VALUATION_COORDINATES.grado_satisfaccion_general.item_10 },
  ];

  for (const { prefix, coords } of valuationSections) {
    const page = getPage(coords.page);
    if (!page) continue;

    const result = await analyzeValuationGroup(
      page.buffer,
      page.width,
      page.height,
      coords.options
    );

    checkboxResults[prefix] = {
      value: result.selectedCode,
      state: result.needsHumanReview ? 'CV_AMBIGUOUS' : 'CV_HIGH_CONFIDENCE',
      confidence: result.confidence,
      needsHumanReview: result.needsHumanReview,
    };

    const densities = result.details.map(d => `${d.code}:${d.result.pixelDensity.toFixed(3)}(${d.result.state})`).join(', ');
    console.log(`[CV Judge] ${prefix}: selected=${result.selectedCode}, conf=${result.confidence.toFixed(2)} | ${densities}`);

    if (result.needsHumanReview) {
      fieldsNeedingReview.push(prefix);
    }
  }

  console.log(`[hybridExtractor] CV Judge completado: ${Object.keys(checkboxResults).length} campos analizados`);

  // ========================================
  // PASO 3: Gemini para campos de texto
  // Prompt simplificado, temperature 0.1, topK 1
  // ========================================
  let textResults: Record<string, any> = {};

  if (apiKey) {
    console.log('[hybridExtractor] Extrayendo texto con Gemini (temperature 0.1)...');
    try {
      const ai = new GoogleGenAI({ apiKey });

      // Enviar las páginas renderizadas como PNG base64
      const parts: any[] = [{ text: TEXT_ONLY_PROMPT }];

      for (const page of pages) {
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
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
        },
      });

      const responseText = response.text || '{}';
      textResults = JSON.parse(responseText.replace(/```json|```/g, '').trim());
      console.log(`[hybridExtractor] Gemini extrajo ${Object.keys(textResults).length} campos de texto`);
    } catch (geminiError: any) {
      console.error('[hybridExtractor] Error con Gemini:', geminiError.message);
      // No fallar — los checkboxes ya están extraídos determinísticamente
    }
  } else {
    console.warn('[hybridExtractor] No hay API key de Gemini, solo se extraen checkboxes');
  }

  // ========================================
  // PASO 4: Combinar resultados
  // Prioridad: CV Judge > Gemini para checkboxes
  // ========================================
  const extractedData: Record<string, any> = {};

  // Primero: campos de texto de Gemini
  for (const [key, value] of Object.entries(textResults)) {
    extractedData[key] = value;
  }

  // Segundo: checkboxes del CV Judge (sobrescriben si Gemini también los extrajo)
  for (const [key, result] of Object.entries(checkboxResults)) {
    extractedData[key] = result.value;
  }

  // Mapear campos de checkbox a nombres esperados por el sistema
  if (checkboxResults.modalidad?.value) {
    extractedData.modalidad = checkboxResults.modalidad.value;
  }
  if (checkboxResults.sexo?.value) {
    extractedData.sexo = checkboxResults.sexo.value;
  }

  // Post-procesamiento: valoracion_7_x según modalidad
  const modalidad = String(extractedData.modalidad || '').toLowerCase();
  const esPresencial = modalidad.includes('presencial') && !modalidad.includes('mixta');
  if (esPresencial) {
    extractedData.valoracion_7_1 = 'NA';
    extractedData.valoracion_7_2 = 'NA';
  }

  // ========================================
  // PASO 5: Calcular confianza real
  // Basada en resultados deterministas del CV Judge
  // ========================================
  const totalCheckboxFields = Object.keys(checkboxResults).length;
  const highConfidenceFields = Object.values(checkboxResults)
    .filter(r => r.state === 'CV_HIGH_CONFIDENCE').length;
  const ambiguousFields = Object.values(checkboxResults)
    .filter(r => r.state === 'CV_AMBIGUOUS').length;

  const cvConfidence = totalCheckboxFields > 0
    ? highConfidenceFields / totalCheckboxFields
    : 0;

  const ambiguousPenalty = ambiguousFields * 0.02;
  const overallConfidence = Math.max(0, Math.min(1, cvConfidence - ambiguousPenalty));

  console.log(`[hybridExtractor] Confianza CV: ${(cvConfidence * 100).toFixed(1)}%, ` +
    `ambiguos: ${ambiguousFields}, confianza final: ${(overallConfidence * 100).toFixed(1)}%`);

  return {
    extractedData,
    checkboxResults,
    textResults,
    overallConfidence,
    fieldsNeedingReview,
    method: 'hybrid_cv_gemini',
    localizationMethod: locatorResult.method,
    processingTimeMs: Date.now() - startTime,
  };
}
