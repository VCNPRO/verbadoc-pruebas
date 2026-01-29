/**
 * FASE 1: CV Judge - Análisis determinista de checkboxes con Sharp
 * api/_lib/checkboxJudge.ts
 *
 * Reemplaza la dependencia de Gemini para lectura de checkboxes.
 * Usa análisis de píxeles (densidad de oscuros) para determinar si
 * un checkbox está marcado, vacío o ambiguo.
 */

import sharp from 'sharp';

// --- Tipos ---

export type CheckboxState = 'CHECKED' | 'EMPTY' | 'AMBIGUOUS';

export interface CheckboxResult {
  state: CheckboxState;
  pixelDensity: number;   // 0.0 - 1.0 ratio de píxeles oscuros
  confidence: number;     // 0.0 - 1.0
}

export interface NormalizedBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ValuationGroupResult {
  selectedCode: string;           // El código seleccionado (ej: "3", "NC")
  confidence: number;
  details: { code: string; result: CheckboxResult }[];
  needsHumanReview: boolean;
}

export type FieldConfidenceState =
  | 'CV_HIGH_CONFIDENCE'
  | 'CV_AMBIGUOUS'
  | 'GEMINI_FALLBACK';

// --- Umbrales ---
const THRESHOLD_EMPTY = 0.02;     // <2% = EMPTY
const THRESHOLD_CHECKED = 0.08;   // >8% = CHECKED
// 2-8% = AMBIGUOUS

const INNER_MARGIN = 0.25;        // 25% margen interior para excluir bordes

/**
 * Analiza un checkbox individual en una imagen PNG de página completa.
 *
 * @param pageBuffer - Buffer PNG de la página completa
 * @param pageWidth - Ancho de la imagen en píxeles
 * @param pageHeight - Alto de la imagen en píxeles
 * @param box - Coordenadas normalizadas (0-1) del checkbox
 */
export async function analyzeCheckbox(
  pageBuffer: Buffer,
  pageWidth: number,
  pageHeight: number,
  box: NormalizedBox
): Promise<CheckboxResult> {
  // Convertir coordenadas normalizadas a píxeles
  const left = Math.floor(box.minX * pageWidth);
  const top = Math.floor(box.minY * pageHeight);
  const width = Math.floor((box.maxX - box.minX) * pageWidth);
  const height = Math.floor((box.maxY - box.minY) * pageHeight);

  // Sanity checks
  if (width <= 0 || height <= 0) {
    return { state: 'AMBIGUOUS', pixelDensity: 0, confidence: 0 };
  }

  // Aplicar margen interior del 20% para excluir bordes del checkbox
  const marginX = Math.floor(width * INNER_MARGIN);
  const marginY = Math.floor(height * INNER_MARGIN);
  const innerLeft = left + marginX;
  const innerTop = top + marginY;
  const innerWidth = Math.max(1, width - 2 * marginX);
  const innerHeight = Math.max(1, height - 2 * marginY);

  // Clamp to image bounds
  const clampedLeft = Math.max(0, Math.min(innerLeft, pageWidth - 1));
  const clampedTop = Math.max(0, Math.min(innerTop, pageHeight - 1));
  const clampedWidth = Math.min(innerWidth, pageWidth - clampedLeft);
  const clampedHeight = Math.min(innerHeight, pageHeight - clampedTop);

  if (clampedWidth <= 0 || clampedHeight <= 0) {
    return { state: 'AMBIGUOUS', pixelDensity: 0, confidence: 0 };
  }

  try {
    // Recortar, escala de grises, umbral, obtener píxeles raw
    const rawPixels = await sharp(pageBuffer)
      .extract({ left: clampedLeft, top: clampedTop, width: clampedWidth, height: clampedHeight })
      .greyscale()
      .threshold(90)
      .raw()
      .toBuffer();

    // Contar píxeles oscuros (valor 0 después de threshold)
    let darkPixels = 0;
    const totalPixels = rawPixels.length;
    for (let i = 0; i < totalPixels; i++) {
      if (rawPixels[i] === 0) {
        darkPixels++;
      }
    }

    const pixelDensity = totalPixels > 0 ? darkPixels / totalPixels : 0;

    // Clasificar
    let state: CheckboxState;
    let confidence: number;

    if (pixelDensity < THRESHOLD_EMPTY) {
      state = 'EMPTY';
      confidence = 1 - (pixelDensity / THRESHOLD_EMPTY); // Más vacío = más confianza
    } else if (pixelDensity > THRESHOLD_CHECKED) {
      state = 'CHECKED';
      confidence = Math.min(1, (pixelDensity - THRESHOLD_CHECKED) / (0.5 - THRESHOLD_CHECKED));
    } else {
      state = 'AMBIGUOUS';
      // Confianza baja en zona ambigua, menor en el centro de la zona
      const center = (THRESHOLD_EMPTY + THRESHOLD_CHECKED) / 2;
      const distFromCenter = Math.abs(pixelDensity - center);
      const halfRange = (THRESHOLD_CHECKED - THRESHOLD_EMPTY) / 2;
      confidence = distFromCenter / halfRange * 0.5; // Max 0.5 para ambiguos
    }

    return { state, pixelDensity, confidence };
  } catch (error) {
    console.error('Error en analyzeCheckbox:', error);
    return { state: 'AMBIGUOUS', pixelDensity: 0, confidence: 0 };
  }
}

/**
 * Evalúa un grupo de checkboxes de valoración (NC, 1, 2, 3, 4).
 * Aplica reglas de exclusividad mutua.
 *
 * @param pageBuffer - Buffer PNG de la página
 * @param pageWidth - Ancho de la imagen
 * @param pageHeight - Alto de la imagen
 * @param options - Array de opciones con { code, box }
 */
export async function analyzeValuationGroup(
  pageBuffer: Buffer,
  pageWidth: number,
  pageHeight: number,
  options: { code: string; box: NormalizedBox }[]
): Promise<ValuationGroupResult> {
  // Evaluar todas las opciones en paralelo
  const results = await Promise.all(
    options.map(async (opt) => ({
      code: opt.code,
      result: await analyzeCheckbox(pageBuffer, pageWidth, pageHeight, opt.box),
    }))
  );

  // --- Relative density comparison ---
  // Sort by density descending to find the standout
  const sorted = [...results].sort((a, b) => b.result.pixelDensity - a.result.pixelDensity);
  const topDensity = sorted[0].result.pixelDensity;
  // Median of all others (excluding top)
  const others = sorted.slice(1).map(r => r.result.pixelDensity);
  const otherMedian = others.length > 0 ? others[Math.floor(others.length / 2)] : 0;

  let selectedCode: string;
  let confidence: number;
  let needsHumanReview = false;

  // A truly checked box should have density well above the table-line baseline
  // Use relative comparison: top must be at least 2x the median of others AND above a minimum
  const RELATIVE_RATIO = 2.0;
  const MIN_CHECKED_DENSITY = 0.05; // minimum absolute density to be considered checked

  if (topDensity >= MIN_CHECKED_DENSITY && (otherMedian < 0.01 || topDensity / otherMedian >= RELATIVE_RATIO)) {
    // Clear winner by relative density
    selectedCode = sorted[0].code;
    const ratio = otherMedian > 0 ? topDensity / otherMedian : 10;
    confidence = Math.min(1, ratio / 5); // ratio of 5+ → confidence 1.0

    // Check if second highest is also clearly marked (genuine multiple marks)
    const secondDensity = sorted.length > 1 ? sorted[1].result.pixelDensity : 0;
    if (secondDensity >= MIN_CHECKED_DENSITY && secondDensity / otherMedian >= RELATIVE_RATIO * 0.8) {
      // Two boxes are both clearly above baseline → genuine multiple marks
      selectedCode = 'NC';
      confidence = 0.7;
      needsHumanReview = true;
    }
  } else if (topDensity < THRESHOLD_EMPTY) {
    // All boxes are essentially empty
    selectedCode = 'NC';
    confidence = 0.9;
  } else {
    // No clear winner — all similar density (likely all table lines, no mark)
    // Check if everything is below CHECKED threshold (just table noise)
    if (topDensity < THRESHOLD_CHECKED) {
      selectedCode = 'NC';
      confidence = 0.7;
    } else {
      selectedCode = 'NC';
      confidence = 0.3;
      needsHumanReview = true;
    }
  }

  return {
    selectedCode,
    confidence,
    details: results,
    needsHumanReview,
  };
}

/**
 * Evalúa un grupo de checkboxes de campo simple (modalidad, sexo, etc.).
 * Similar a valuationGroup pero retorna el value/code del checkbox marcado.
 */
export async function analyzeCheckboxField(
  pageBuffer: Buffer,
  pageWidth: number,
  pageHeight: number,
  options: { value: string; code: string; box: NormalizedBox }[]
): Promise<{
  selectedValue: string | null;
  selectedCode: string | null;
  confidence: number;
  needsHumanReview: boolean;
  details: { code: string; value: string; result: CheckboxResult }[];
}> {
  const results = await Promise.all(
    options.map(async (opt) => ({
      code: opt.code,
      value: opt.value,
      result: await analyzeCheckbox(pageBuffer, pageWidth, pageHeight, opt.box),
    }))
  );

  // --- Relative density comparison (same logic as analyzeValuationGroup) ---
  const sorted = [...results].sort((a, b) => b.result.pixelDensity - a.result.pixelDensity);
  const topDensity = sorted[0].result.pixelDensity;
  const others = sorted.slice(1).map(r => r.result.pixelDensity);
  const otherMedian = others.length > 0 ? others[Math.floor(others.length / 2)] : 0;

  const RELATIVE_RATIO = 2.0;
  const MIN_CHECKED_DENSITY = 0.05;

  if (topDensity >= MIN_CHECKED_DENSITY && (otherMedian < 0.01 || topDensity / otherMedian >= RELATIVE_RATIO)) {
    // Clear winner
    const winner = sorted[0];
    const ratio = otherMedian > 0 ? topDensity / otherMedian : 10;
    const confidence = Math.min(1, ratio / 5);

    // Check for genuine multiple marks
    const secondDensity = sorted.length > 1 ? sorted[1].result.pixelDensity : 0;
    if (secondDensity >= MIN_CHECKED_DENSITY && otherMedian > 0.01 && secondDensity / otherMedian >= RELATIVE_RATIO * 0.8) {
      return {
        selectedValue: 'NC',
        selectedCode: '9',
        confidence: 0.7,
        needsHumanReview: true,
        details: results,
      };
    }

    return {
      selectedValue: winner.value,
      selectedCode: winner.code,
      confidence,
      needsHumanReview: false,
      details: results,
    };
  }

  if (topDensity < THRESHOLD_EMPTY) {
    // All empty
    return {
      selectedValue: null,
      selectedCode: null,
      confidence: 0.9,
      needsHumanReview: false,
      details: results,
    };
  }

  // No clear winner — all similar density (ambient noise)
  if (topDensity < THRESHOLD_CHECKED) {
    // All below CHECKED threshold — just noise, treat as nothing marked
    return {
      selectedValue: null,
      selectedCode: null,
      confidence: 0.7,
      needsHumanReview: false,
      details: results,
    };
  }

  // High density but no standout — ambiguous
  return {
    selectedValue: null,
    selectedCode: null,
    confidence: 0.3,
    needsHumanReview: true,
    details: results,
  };
}

/**
 * Evalúa un par de checkboxes Sí/No (evaluación 8.1, 8.2, recomendaría)
 */
export async function analyzeBinaryCheckbox(
  pageBuffer: Buffer,
  pageWidth: number,
  pageHeight: number,
  siBox: NormalizedBox,
  noBox: NormalizedBox
): Promise<{
  value: string;  // "Sí", "No", "NC"
  confidence: number;
  needsHumanReview: boolean;
}> {
  const [siResult, noResult] = await Promise.all([
    analyzeCheckbox(pageBuffer, pageWidth, pageHeight, siBox),
    analyzeCheckbox(pageBuffer, pageWidth, pageHeight, noBox),
  ]);

  const siDensity = siResult.pixelDensity;
  const noDensity = noResult.pixelDensity;
  const MIN_CHECKED_DENSITY = 0.05;
  const RELATIVE_RATIO = 2.0;

  // Use relative comparison: the marked one should stand out from the other
  const maxDensity = Math.max(siDensity, noDensity);
  const minDensity = Math.min(siDensity, noDensity);

  if (maxDensity >= MIN_CHECKED_DENSITY && (minDensity < 0.01 || maxDensity / minDensity >= RELATIVE_RATIO)) {
    // Clear winner
    const ratio = minDensity > 0 ? maxDensity / minDensity : 10;
    const confidence = Math.min(1, ratio / 5);
    if (siDensity > noDensity) {
      return { value: 'Sí', confidence, needsHumanReview: false };
    } else {
      return { value: 'No', confidence, needsHumanReview: false };
    }
  }

  // Both high and similar — both marked
  if (maxDensity >= MIN_CHECKED_DENSITY && minDensity >= MIN_CHECKED_DENSITY) {
    return { value: 'NC', confidence: 0.7, needsHumanReview: true };
  }

  // Both low — nothing marked (ambient noise)
  if (maxDensity < THRESHOLD_CHECKED) {
    return { value: 'NC', confidence: 0.7, needsHumanReview: false };
  }

  return { value: 'NC', confidence: 0.3, needsHumanReview: true };
}
