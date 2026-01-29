/**
 * geminiLocator.ts — Gemini localiza CADA checkbox directamente
 *
 * Enfoque simple y robusto:
 * - Gemini recibe la imagen + lista completa de preguntas FUNDAE
 * - Gemini devuelve el bounding box de cada checkbox individual
 * - Sharp solo lee densidad de píxeles en esas coordenadas
 * - Sin escaneo de columnas, sin cálculos de gaps
 *
 * Fallback: fundaeCoordinatesFallback.js (coordenadas fijas).
 */

import { GoogleGenAI } from '@google/genai';
import type { NormalizedBox } from './checkboxJudge.js';
import {
  FIELD_COORDINATES as FALLBACK_FIELD_COORDINATES,
  VALUATION_COORDINATES as FALLBACK_VALUATION_COORDINATES,
} from './fundaeCoordinatesFallback.js';

// --- Types ---

export interface LocatorResult {
  fieldCoordinates: typeof FALLBACK_FIELD_COORDINATES;
  valuationCoordinates: typeof FALLBACK_VALUATION_COORDINATES;
  method: 'gemini' | 'fallback';
}

// --- Helpers ---

/** Convierte coordenadas Gemini (0-1000) a NormalizedBox (0-1) */
function toNormalizedBox(b: { y_min: number; x_min: number; y_max: number; x_max: number }): NormalizedBox {
  return {
    minX: b.x_min / 1000,
    maxX: b.x_max / 1000,
    minY: b.y_min / 1000,
    maxY: b.y_max / 1000,
  };
}

/** Valida que un box Gemini sea razonable */
function isValidBox(b: any): b is { y_min: number; x_min: number; y_max: number; x_max: number } {
  if (!b || typeof b.y_min !== 'number' || typeof b.x_min !== 'number' ||
      typeof b.y_max !== 'number' || typeof b.x_max !== 'number') return false;
  if (b.x_min < 0 || b.x_max > 1000 || b.y_min < 0 || b.y_max > 1000) return false;
  if (b.x_min >= b.x_max || b.y_min >= b.y_max) return false;
  const w = b.x_max - b.x_min;
  const h = b.y_max - b.y_min;
  if (w < 3 || w > 80 || h < 3 || h > 80) return false; // checkbox plausible size
  return true;
}

async function callGemini(pageBuffer: Buffer, prompt: string, apiKey: string, model: string): Promise<any> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: pageBuffer.toString('base64') } },
      ],
    },
    config: { temperature: 0, topK: 1, responseMimeType: 'application/json' },
  });
  const text = response.text || '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// =============================================
// PAGE 1: Checkboxes individuales
// =============================================

const PAGE1_PROMPT = `Analyze this FUNDAE survey form (page 1). Find the BOUNDING BOX of each CHECKBOX SQUARE (the small square that can be checked/marked).

Return JSON with bounding boxes in 0-1000 scale: {"y_min": N, "x_min": N, "y_max": N, "x_max": N}

{
  "modalidad": [
    {"value": "Presencial", "code": "Presencial", "box": {...}},
    {"value": "Teleformación", "code": "Teleformación", "box": {...}},
    {"value": "Mixta", "code": "Mixta", "box": {...}}
  ],
  "sexo": [
    {"value": "Mujer", "code": "1", "box": {...}},
    {"value": "Hombre", "code": "2", "box": {...}},
    {"value": "No contesta", "code": "9", "box": {...}}
  ],
  "titulacion": [
    // Find ALL education level checkboxes. Common codes: 1, 11, 111, 12, 2, 21, 3, 4, 41, 42, 5, 6, 6.1, 7, 7.1, 7.3, 7.4, 8, 9, 99
    // Each has a checkbox square next to its text label
  ],
  "categoria_profesional": [
    {"value": "Directivo/a", "code": "1", "box": {...}},
    {"value": "Mando Intermedio", "code": "2", "box": {...}},
    {"value": "Técnico/a", "code": "3", "box": {...}},
    {"value": "Trabajador/a cualificado/a", "code": "4", "box": {...}},
    {"value": "Trabajador/a de baja cualificación", "code": "5", "box": {...}},
    {"value": "Otra categoría", "code": "6", "box": {...}},
    {"value": "No contesta", "code": "9", "box": {...}}
  ],
  "horario_curso": [
    {"value": "Dentro de la jornada laboral", "code": "1", "box": {...}},
    {"value": "Fuera de la jornada laboral", "code": "2", "box": {...}},
    {"value": "Ambas", "code": "3", "box": {...}},
    {"value": "No contesta", "code": "9", "box": {...}}
  ],
  "porcentaje_jornada": [
    {"value": "Menos del 25%", "code": "1", "box": {...}},
    {"value": "Entre el 25% al 50%", "code": "2", "box": {...}},
    {"value": "Más del 50%", "code": "3", "box": {...}},
    {"value": "No contesta", "code": "9", "box": {...}}
  ],
  "tamaño_empresa": [
    {"value": "De 1 a 9", "code": "1", "box": {...}},
    {"value": "De 10 a 49", "code": "2", "box": {...}},
    {"value": "De 50 a 99", "code": "3", "box": {...}},
    {"value": "De 100 a 250", "code": "4", "box": {...}},
    {"value": "Más de 250", "code": "5", "box": {...}},
    {"value": "No contesta", "code": "9", "box": {...}}
  ]
}

IMPORTANT: Return the bounding box of each CHECKBOX SQUARE itself (the small clickable/markable square), NOT the text label.
All coordinates in 0-1000 scale relative to the full image dimensions.`;

interface Page1Option {
  value: string;
  code: string;
  page: number;
  box: NormalizedBox;
}

export async function locateCheckboxesPage1(
  pageBuffer: Buffer,
  apiKey: string,
  model: string
): Promise<Record<string, Page1Option[]> | null> {
  console.log('[geminiLocator] Page 1: Locating each checkbox directly...');
  const data = await callGemini(pageBuffer, PAGE1_PROMPT, apiKey, model);

  const groups = ['modalidad', 'sexo', 'titulacion', 'categoria_profesional', 'horario_curso', 'porcentaje_jornada', 'tamaño_empresa'] as const;
  const result: Record<string, Page1Option[]> = {};

  for (const group of groups) {
    const items = data[group];
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.warn(`[geminiLocator] Page 1: Missing group "${group}"`);
      return null;
    }

    result[group] = [];
    for (const item of items) {
      const b = item.box;
      if (!isValidBox(b)) {
        console.warn(`[geminiLocator] Page 1: Invalid box in ${group} for "${item.value}"`);
        return null;
      }
      result[group].push({
        value: item.value || '',
        code: item.code || '',
        page: 1,
        box: toNormalizedBox(b),
      });
    }

    console.log(`[geminiLocator] Page 1: ${group} = ${result[group].length} checkboxes`);
  }

  return result;
}

// =============================================
// PAGE 2: Valoraciones + binarios
// Gemini localiza cada checkbox de la tabla directamente
// =============================================

const PAGE2_PROMPT = `Analyze this FUNDAE survey form (page 2). This page has a VALUATION TABLE with questions rated NC, 1, 2, 3, 4.

For EACH question row, find the BOUNDING BOX of each of the 5 CHECKBOX SQUARES (NC, 1, 2, 3, 4).

Also find the Sí/No checkbox pairs for questions 8.1, 8.2, and the recommendation question.

Return this JSON with all bounding boxes in 0-1000 scale:

{
  "valuations": {
    "1.1": {"NC": {"y_min":N,"x_min":N,"y_max":N,"x_max":N}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "1.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "2.1": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "2.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "3.1": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "3.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "4.1": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "4.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "5.1": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "5.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "6.1": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "6.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "7.1": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "7.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "9.1": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "9.2": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "9.3": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "9.4": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "9.5": {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}},
    "10":  {"NC": {...}, "1": {...}, "2": {...}, "3": {...}, "4": {...}}
  },
  "binary": {
    "8.1": {"si": {"y_min":N,"x_min":N,"y_max":N,"x_max":N}, "no": {"y_min":N,"x_min":N,"y_max":N,"x_max":N}},
    "8.2": {"si": {...}, "no": {...}},
    "rec": {"si": {...}, "no": {...}}
  }
}

IMPORTANT:
- Questions 4.1 and 4.2 have TWO sub-rows each (formadores/tutores). Return ONLY the FIRST sub-row for each.
- Return the bounding box of each CHECKBOX SQUARE itself.
- All coordinates in 0-1000 scale relative to full image.
- The table has 20 question rows × 5 columns = 100 checkboxes, plus 6 binary checkboxes.`;

export async function locateCheckboxesPage2(
  pageBuffer: Buffer,
  pageWidth: number,
  pageHeight: number,
  apiKey: string,
  model: string
): Promise<{ valuations: typeof FALLBACK_VALUATION_COORDINATES; binaryFields: Record<string, any[]> } | null> {
  console.log('[geminiLocator] Page 2: Locating each checkbox directly...');
  const data = await callGemini(pageBuffer, PAGE2_PROMPT, apiKey, model);

  if (!data.valuations) {
    console.warn('[geminiLocator] Page 2: No valuations in response');
    return null;
  }

  // Map question IDs to internal structure
  const rowMapping: Record<string, { section: string; item: string; subKey?: string }> = {
    '1.1': { section: 'organizacion_curso', item: 'item_1_1' },
    '1.2': { section: 'organizacion_curso', item: 'item_1_2' },
    '2.1': { section: 'contenidos_metodologia', item: 'item_2_1' },
    '2.2': { section: 'contenidos_metodologia', item: 'item_2_2' },
    '3.1': { section: 'duracion_horario', item: 'item_3_1' },
    '3.2': { section: 'duracion_horario', item: 'item_3_2' },
    '4.1': { section: 'formadores_tutores', item: 'item_4_1', subKey: 'formadores' },
    '4.2': { section: 'formadores_tutores', item: 'item_4_2', subKey: 'formadores' },
    '5.1': { section: 'medios_didacticos', item: 'item_5_1' },
    '5.2': { section: 'medios_didacticos', item: 'item_5_2' },
    '6.1': { section: 'instalaciones_medios_tecnicos', item: 'item_6_1' },
    '6.2': { section: 'instalaciones_medios_tecnicos', item: 'item_6_2' },
    '7.1': { section: 'solo_teleformacion_mixta', item: 'item_7_1' },
    '7.2': { section: 'solo_teleformacion_mixta', item: 'item_7_2' },
    '9.1': { section: 'valoracion_general_curso', item: 'item_9_1' },
    '9.2': { section: 'valoracion_general_curso', item: 'item_9_2' },
    '9.3': { section: 'valoracion_general_curso', item: 'item_9_3' },
    '9.4': { section: 'valoracion_general_curso', item: 'item_9_4' },
    '9.5': { section: 'valoracion_general_curso', item: 'item_9_5' },
    '10':  { section: 'grado_satisfaccion_general', item: 'item_10' },
  };

  const valuations: any = {
    organizacion_curso: {},
    contenidos_metodologia: {},
    duracion_horario: {},
    formadores_tutores: { item_4_1: {}, item_4_2: {} },
    medios_didacticos: {},
    instalaciones_medios_tecnicos: {},
    solo_teleformacion_mixta: {},
    valoracion_general_curso: {},
    grado_satisfaccion_general: {},
  };

  const codes = ['NC', '1', '2', '3', '4'] as const;

  for (const [qId, mapping] of Object.entries(rowMapping)) {
    const row = data.valuations[qId];
    if (!row) {
      console.warn(`[geminiLocator] Page 2: Missing row "${qId}"`);
      return null;
    }

    const options: { code: string; box: NormalizedBox }[] = [];
    for (const code of codes) {
      const b = row[code];
      if (!isValidBox(b)) {
        console.warn(`[geminiLocator] Page 2: Invalid box for ${qId}/${code}: ${JSON.stringify(b)}`);
        return null;
      }
      options.push({ code, box: toNormalizedBox(b) });
    }

    const entry = { page: 2, options };

    if (mapping.subKey) {
      // 4.1 and 4.2 have formadores/tutores — use same coords for both
      valuations[mapping.section][mapping.item] = {
        formadores: entry,
        tutores: { page: 2, options: options.map(o => ({ ...o })) },
      };
    } else {
      valuations[mapping.section][mapping.item] = entry;
    }

    const yCenter = ((options[0].box.minY + options[0].box.maxY) / 2 * 1000).toFixed(0);
    console.log(`[geminiLocator] Page 2 row ${qId}: y~${yCenter}`);
  }

  // Binary pairs
  const binaryFields: Record<string, any[]> = {};
  const binaryMapping: Record<string, [string, string]> = {
    '8.1': ['evaluacion_mecanismos_8_1_si', 'evaluacion_mecanismos_8_1_no'],
    '8.2': ['evaluacion_mecanismos_8_2_si', 'evaluacion_mecanismos_8_2_no'],
    'rec': ['curso_recomendaria_si', 'curso_recomendaria_no'],
  };

  for (const [bId, [siKey, noKey]] of Object.entries(binaryMapping)) {
    const bq = data.binary?.[bId];
    if (!bq || !isValidBox(bq.si) || !isValidBox(bq.no)) {
      console.warn(`[geminiLocator] Page 2: Missing/invalid binary "${bId}"`);
      // Binary questions are optional — don't fail entirely
      continue;
    }

    binaryFields[siKey] = [{ value: 'Si', code: 'Si', page: 2, box: toNormalizedBox(bq.si) }];
    binaryFields[noKey] = [{ value: 'No', code: 'No', page: 2, box: toNormalizedBox(bq.no) }];
    console.log(`[geminiLocator] Page 2 binary ${bId}: OK`);
  }

  return { valuations, binaryFields };
}

// =============================================
// MAIN ENTRY POINT
// =============================================

export async function locateAllCheckboxes(
  pages: { pageNumber: number; buffer: Buffer; width: number; height: number }[],
  apiKey: string,
  model: string
): Promise<LocatorResult> {
  const page1 = pages.find(p => p.pageNumber === 1);
  const page2 = pages.find(p => p.pageNumber === 2);

  if (!page1 || !page2) {
    console.warn('[geminiLocator] Missing page 1 or 2, using fallback');
    return { fieldCoordinates: FALLBACK_FIELD_COORDINATES, valuationCoordinates: FALLBACK_VALUATION_COORDINATES, method: 'fallback' };
  }

  try {
    console.log('[geminiLocator] Locating all checkboxes with Gemini...');
    const startMs = Date.now();

    const [page1Result, page2Result] = await Promise.all([
      locateCheckboxesPage1(page1.buffer, apiKey, model),
      locateCheckboxesPage2(page2.buffer, page2.width, page2.height, apiKey, model),
    ]);

    const elapsed = Date.now() - startMs;
    console.log(`[geminiLocator] Completed in ${elapsed}ms`);

    // Allow partial success: page 1 and page 2 are independent
    const page1Fields = page1Result || FALLBACK_FIELD_COORDINATES.mainLayout.checkbox_fields;
    const page2Valuations = page2Result?.valuations || FALLBACK_VALUATION_COORDINATES;
    const page2Binary = page2Result?.binaryFields || {};

    const method = (!page1Result && !page2Result) ? 'fallback' as const : 'gemini' as const;

    if (!page1Result) console.warn('[geminiLocator] Page 1 failed, using fallback for page 1 fields');
    if (!page2Result) console.warn('[geminiLocator] Page 2 failed, using fallback for page 2 valuations');

    const mergedCheckboxFields = { ...page1Fields, ...page2Binary };
    const fieldCoordinates = {
      mainLayout: {
        checkbox_fields: mergedCheckboxFields,
        text_fields: FALLBACK_FIELD_COORDINATES.mainLayout.text_fields,
      },
    };

    console.log(`[geminiLocator] Done (method=${method}, page1=${page1Result ? 'gemini' : 'fallback'}, page2=${page2Result ? 'gemini' : 'fallback'})`);
    return {
      fieldCoordinates: fieldCoordinates as any,
      valuationCoordinates: page2Valuations,
      method,
    };
  } catch (error: any) {
    console.error('[geminiLocator] Error:', error.message);
    return { fieldCoordinates: FALLBACK_FIELD_COORDINATES, valuationCoordinates: FALLBACK_VALUATION_COORDINATES, method: 'fallback' };
  }
}
