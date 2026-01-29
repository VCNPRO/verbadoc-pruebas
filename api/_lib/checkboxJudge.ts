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
const THRESHOLD_EMPTY = 0.03;     // <3% = EMPTY
const THRESHOLD_CHECKED = 0.12;   // >12% = CHECKED
// 3-12% = AMBIGUOUS

const INNER_MARGIN = 0.20;        // 20% margen interior para excluir bordes

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
      .threshold(128)
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

  const checked = results.filter(r => r.result.state === 'CHECKED');
  const ambiguous = results.filter(r => r.result.state === 'AMBIGUOUS');

  let selectedCode: string;
  let confidence: number;
  let needsHumanReview = false;

  if (checked.length === 1) {
    // Exactamente 1 marcado → retornar ese valor
    selectedCode = checked[0].code;
    confidence = checked[0].result.confidence;
  } else if (checked.length > 1) {
    // Múltiples marcados → NC (marcas múltiples)
    selectedCode = 'NC';
    confidence = 0.8; // Confianza razonable de que hay marcas múltiples
    needsHumanReview = true;
  } else if (ambiguous.length > 0) {
    // 0 CHECKED pero alguno AMBIGUOUS → revisión humana
    selectedCode = 'NC';
    confidence = 0.3;
    needsHumanReview = true;
  } else {
    // 0 CHECKED y 0 AMBIGUOUS → NC (ninguna marca)
    selectedCode = 'NC';
    confidence = 0.9; // Alta confianza de que está vacío
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

  const checked = results.filter(r => r.result.state === 'CHECKED');
  const ambiguous = results.filter(r => r.result.state === 'AMBIGUOUS');

  if (checked.length === 1) {
    return {
      selectedValue: checked[0].value,
      selectedCode: checked[0].code,
      confidence: checked[0].result.confidence,
      needsHumanReview: false,
      details: results,
    };
  }

  if (checked.length > 1) {
    // Múltiples marcas → NC
    return {
      selectedValue: 'NC',
      selectedCode: '9',
      confidence: 0.8,
      needsHumanReview: true,
      details: results,
    };
  }

  if (ambiguous.length > 0) {
    return {
      selectedValue: null,
      selectedCode: null,
      confidence: 0.3,
      needsHumanReview: true,
      details: results,
    };
  }

  // Nada marcado
  return {
    selectedValue: null,
    selectedCode: null,
    confidence: 0.9,
    needsHumanReview: false,
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

  const siChecked = siResult.state === 'CHECKED';
  const noChecked = noResult.state === 'CHECKED';

  if (siChecked && !noChecked) {
    return { value: 'Sí', confidence: siResult.confidence, needsHumanReview: false };
  }
  if (noChecked && !siChecked) {
    return { value: 'No', confidence: noResult.confidence, needsHumanReview: false };
  }
  if (siChecked && noChecked) {
    return { value: 'NC', confidence: 0.7, needsHumanReview: true };
  }

  // Ninguno marcado - revisar ambiguos
  const siAmbiguous = siResult.state === 'AMBIGUOUS';
  const noAmbiguous = noResult.state === 'AMBIGUOUS';

  if (siAmbiguous || noAmbiguous) {
    return { value: 'NC', confidence: 0.3, needsHumanReview: true };
  }

  return { value: 'NC', confidence: 0.9, needsHumanReview: false };
}
