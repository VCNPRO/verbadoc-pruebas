/**
 * opencvValidator.ts
 *
 * Integración OpenCV para validación de checkboxes en formularios FUNDAE.
 * Llama al microservicio OpenCV en La Bestia via Cloudflare Tunnel.
 * Comparación CAMPO POR CAMPO: OpenCV devuelve qué valor tiene cada fila
 * y se compara con lo que Gemini extrajo para cada campo.
 *
 * ROLLBACK: Desactivar con OPENCV_CONFIG.enabled = false
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

export type OpenCVMode = 'log_only' | 'flag_only' | 'validate';

export interface OpenCVConfig {
  /** Interruptor principal de rollback */
  enabled: boolean;
  /** Modo de operación */
  mode: OpenCVMode;
  /** Número mínimo de discrepancias campo-a-campo para HUMAN_REVIEW */
  discrepancyThreshold: number;
  /** URL del microservicio OpenCV (Cloudflare Tunnel) */
  serviceUrl: string;
  /** Timeout en ms para la llamada HTTP */
  timeoutMs: number;
}

export const OPENCV_CONFIG: OpenCVConfig = {
  enabled: true,
  mode: 'log_only',
  discrepancyThreshold: 2,
  serviceUrl: process.env.OPENCV_SERVICE_URL || 'https://wit-why-lyrics-ensure.trycloudflare.com',
  timeoutMs: 30_000,
};

// ============================================================================
// TIPOS
// ============================================================================

interface OpenCVRowValue {
  row_index: number;
  field: string | null;
  opencv_value: string | null;
  num_checkboxes: number;
  marked_positions: number[];
  confidence: number;
}

interface OpenCVCheckbox {
  row: number;
  col: number;
  state: 'marked' | 'empty' | 'uncertain';
  confidence: number;
  ink_density: number;
  bbox: [number, number, number, number];
}

interface OpenCVResult {
  total_checkboxes: number;
  total_rows: number;
  marked: number;
  empty: number;
  uncertain: number;
  processing_time_ms: number;
  row_values: OpenCVRowValue[];
  checkboxes: OpenCVCheckbox[];
}

interface FieldDiscrepancy {
  field: string;
  gemini_value: string;
  opencv_value: string;
  opencv_confidence: number;
}

interface ComparisonResult {
  total_compared: number;
  matches: number;
  discrepancies: number;
  discrepancy_fields: FieldDiscrepancy[];
  recommendation: 'ACCEPT' | 'VALIDATE' | 'HUMAN_REVIEW';
}

export interface OpenCVValidationOutput {
  enabled: boolean;
  mode: OpenCVMode;
  opencv?: OpenCVResult;
  comparison?: ComparisonResult;
  requiresHumanReview: boolean;
  error?: string;
}

// ============================================================================
// FUNCIONES
// ============================================================================

/**
 * Llama al microservicio OpenCV en La Bestia.
 */
async function callOpenCVService(pdfUrl: string, pageIndex: number): Promise<OpenCVResult> {
  const url = `${OPENCV_CONFIG.serviceUrl}/validate`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENCV_CONFIG.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_url: pdfUrl, page_index: pageIndex }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenCV service error ${response.status}: ${errorBody}`);
    }

    return await response.json() as OpenCVResult;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Normaliza un valor de Gemini para comparación con OpenCV.
 * Gemini devuelve "1","2","3","4","NC","Sí","No", etc.
 */
function normalizeGeminiValue(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (s === 'NC' || s === 'No contesta' || s === 'NA') return 'NC';
  if (s === 'Sí' || s === 'Si' || s === 'sí' || s === 'si') return 'Si';
  if (s === 'No' || s === 'no') return 'No';
  // Para valores numéricos 1-4
  if (['1', '2', '3', '4'].includes(s)) return s;
  return s;
}

/**
 * Compara campo por campo los valores de OpenCV vs Gemini.
 */
function compareFieldByField(
  opencvResult: OpenCVResult,
  geminiData: Record<string, any>,
  threshold: number
): ComparisonResult {
  const discrepancy_fields: FieldDiscrepancy[] = [];
  let totalCompared = 0;
  let matches = 0;

  for (const rv of opencvResult.row_values) {
    if (!rv.field || rv.opencv_value === null) continue;

    const geminiRaw = geminiData[rv.field];
    const geminiNorm = normalizeGeminiValue(geminiRaw);

    // Si Gemini no tiene este campo, no podemos comparar
    if (geminiNorm === null) continue;

    totalCompared++;

    if (geminiNorm === rv.opencv_value) {
      matches++;
    } else {
      // Ambos NC no es discrepancia
      if (geminiNorm === 'NC' && rv.opencv_value === 'NC') {
        matches++;
        continue;
      }
      discrepancy_fields.push({
        field: rv.field,
        gemini_value: geminiNorm,
        opencv_value: rv.opencv_value,
        opencv_confidence: rv.confidence,
      });
    }
  }

  const discrepancies = discrepancy_fields.length;

  let recommendation: ComparisonResult['recommendation'];
  if (discrepancies === 0) {
    recommendation = 'ACCEPT';
  } else if (discrepancies <= threshold) {
    recommendation = 'VALIDATE';
  } else {
    recommendation = 'HUMAN_REVIEW';
  }

  return {
    total_compared: totalCompared,
    matches,
    discrepancies,
    discrepancy_fields,
    recommendation,
  };
}

/**
 * Validación principal: llama al microservicio OpenCV y compara campo por campo con Gemini.
 */
export async function validateWithOpenCV(
  pdfUrl: string,
  geminiData: Record<string, any>,
  pageIndex = 1
): Promise<OpenCVValidationOutput> {
  if (!OPENCV_CONFIG.enabled) {
    return { enabled: false, mode: OPENCV_CONFIG.mode, requiresHumanReview: false };
  }

  try {
    const opencvResult = await callOpenCVService(pdfUrl, pageIndex);
    const comparison = compareFieldByField(
      opencvResult,
      geminiData,
      OPENCV_CONFIG.discrepancyThreshold
    );

    const requiresHumanReview = comparison.recommendation === 'HUMAN_REVIEW';

    const output: OpenCVValidationOutput = {
      enabled: true,
      mode: OPENCV_CONFIG.mode,
      opencv: opencvResult,
      comparison,
      requiresHumanReview,
    };

    // Log resumen
    console.log(
      `[OpenCV] comparados=${comparison.total_compared} ok=${comparison.matches} ` +
      `disc=${comparison.discrepancies} rec=${comparison.recommendation} ` +
      `time=${opencvResult.processing_time_ms.toFixed(0)}ms`
    );

    // Log detalle de discrepancias
    for (const d of comparison.discrepancy_fields) {
      console.log(`[OpenCV] DISC: ${d.field} gemini=${d.gemini_value} opencv=${d.opencv_value} conf=${d.opencv_confidence.toFixed(2)}`);
    }

    if (requiresHumanReview) {
      console.warn(`[OpenCV] REQUIERE REVISION HUMANA: ${comparison.discrepancies} discrepancias`);
    }

    return output;
  } catch (err: any) {
    console.error(`[OpenCV] Error: ${err.message}`);
    return {
      enabled: true,
      mode: OPENCV_CONFIG.mode,
      requiresHumanReview: false,
      error: err.message,
    };
  }
}

/**
 * Wrapper que acepta pdf_blob_url directamente (alias de validateWithOpenCV).
 */
export async function validatePdfWithOpenCV(
  pdfUrl: string,
  geminiData: Record<string, any>,
  pageIndex = 1
): Promise<OpenCVValidationOutput> {
  return validateWithOpenCV(pdfUrl, geminiData, pageIndex);
}

/**
 * Aplica el resultado OpenCV al resultado de extracción según el modo configurado.
 */
export function applyOpenCVResult(
  extractionResult: Record<string, any>,
  opencvOutput: OpenCVValidationOutput
): void {
  if (!opencvOutput.enabled || !opencvOutput.comparison) return;

  extractionResult._opencv = {
    total_compared: opencvOutput.comparison.total_compared,
    matches: opencvOutput.comparison.matches,
    discrepancies: opencvOutput.comparison.discrepancies,
    discrepancy_fields: opencvOutput.comparison.discrepancy_fields,
    recommendation: opencvOutput.comparison.recommendation,
    mode: opencvOutput.mode,
  };

  switch (opencvOutput.mode) {
    case 'log_only':
      break;

    case 'flag_only':
      if (opencvOutput.requiresHumanReview) {
        extractionResult.requiresHumanReview = true;
        extractionResult.humanReviewReason =
          `OpenCV: ${opencvOutput.comparison.discrepancies} campos discrepan: ` +
          opencvOutput.comparison.discrepancy_fields.map(d => d.field).join(', ');
      }
      break;

    case 'validate':
      if (opencvOutput.requiresHumanReview) {
        extractionResult.requiresHumanReview = true;
        extractionResult.humanReviewReason =
          `OpenCV: ${opencvOutput.comparison.discrepancies} campos discrepan: ` +
          opencvOutput.comparison.discrepancy_fields.map(d => d.field).join(', ');
        extractionResult.validation_status = 'needs_review';
      }
      break;
  }
}
