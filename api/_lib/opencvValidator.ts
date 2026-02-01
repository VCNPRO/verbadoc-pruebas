/**
 * opencvValidator.ts
 *
 * Integración OpenCV para validación de checkboxes en formularios FUNDAE.
 * Llama al microservicio OpenCV en La Bestia via Cloudflare Tunnel.
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
  /** Umbral de discrepancia para marcar revisión humana */
  discrepancyThreshold: number;
  /** URL del microservicio OpenCV (Cloudflare Tunnel) */
  serviceUrl: string;
  /** Timeout en ms para la llamada HTTP */
  timeoutMs: number;
}

export const OPENCV_CONFIG: OpenCVConfig = {
  enabled: true,
  mode: 'log_only',
  discrepancyThreshold: 5,
  serviceUrl: process.env.OPENCV_SERVICE_URL || 'https://wit-why-lyrics-ensure.trycloudflare.com',
  timeoutMs: 30_000,
};

// ============================================================================
// TIPOS
// ============================================================================

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
  checkboxes: OpenCVCheckbox[];
}

interface ComparisonResult {
  opencv_marked: number;
  gemini_marked: number;
  discrepancy: number;
  discrepancy_percent: number;
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
 * Cuenta campos marcados en los datos extraídos por Gemini.
 * Excluye campos de texto libre y metadata.
 */
function countGeminiMarked(geminiData: Record<string, any>): number {
  const EXCLUDE_FIELDS = new Set([
    'observaciones', 'comentarios', 'sugerencias',
    'csv_fundae', 'codigo_barras', 'registro_entrada',
    'expediente', 'cif', 'denominacion_aaff',
  ]);

  let count = 0;
  for (const [field, value] of Object.entries(geminiData)) {
    if (EXCLUDE_FIELDS.has(field)) continue;
    if (value && value !== 'NC' && value !== 'No contesta' && value !== null && value !== '') {
      count++;
    }
  }
  return count;
}

/**
 * Compara conteos OpenCV vs Gemini y genera recomendación.
 * Usa marked + uncertain como rango de posibles marcas OpenCV.
 */
function compareResults(opencvResult: OpenCVResult, geminiMarked: number, threshold: number): ComparisonResult {
  const opencvMarked = opencvResult.marked;
  const opencvMax = opencvResult.marked + opencvResult.uncertain;
  const diff = (geminiMarked >= opencvMarked && geminiMarked <= opencvMax)
    ? 0
    : Math.min(Math.abs(opencvMarked - geminiMarked), Math.abs(opencvMax - geminiMarked));
  const maxVal = Math.max(opencvMax, geminiMarked, 1);
  const diffPercent = (diff / maxVal) * 100;

  let recommendation: ComparisonResult['recommendation'];
  if (diff <= 2) {
    recommendation = 'ACCEPT';
  } else if (diff <= threshold || diffPercent <= 15) {
    recommendation = 'VALIDATE';
  } else {
    recommendation = 'HUMAN_REVIEW';
  }

  return {
    opencv_marked: opencvMarked,
    gemini_marked: geminiMarked,
    discrepancy: diff,
    discrepancy_percent: Math.round(diffPercent * 10) / 10,
    recommendation,
  };
}

/**
 * Validación principal: llama al microservicio OpenCV y compara con Gemini.
 *
 * @param pdfUrl - URL pública del PDF en Vercel Blob Storage
 * @param geminiData - Datos extraídos por Gemini
 * @param pageIndex - Página a analizar (0-based), default 1
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
    const geminiMarked = countGeminiMarked(geminiData);
    const comparison = compareResults(
      opencvResult,
      geminiMarked,
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

    console.log(`[OpenCV] marcados=${opencvResult.marked} gemini=${geminiMarked} ` +
      `diff=${comparison.discrepancy} rec=${comparison.recommendation} ` +
      `time=${opencvResult.processing_time_ms.toFixed(0)}ms`);

    if (requiresHumanReview) {
      console.warn(`[OpenCV] DISCREPANCIA ALTA: ${comparison.discrepancy} diferencias. Requiere revisión humana.`);
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
    marked: opencvOutput.opencv?.marked,
    uncertain: opencvOutput.opencv?.uncertain,
    gemini_marked: opencvOutput.comparison.gemini_marked,
    discrepancy: opencvOutput.comparison.discrepancy,
    recommendation: opencvOutput.comparison.recommendation,
    mode: opencvOutput.mode,
  };

  switch (opencvOutput.mode) {
    case 'log_only':
      break;

    case 'flag_only':
      if (opencvOutput.requiresHumanReview) {
        extractionResult.requiresHumanReview = true;
        extractionResult.humanReviewReason = `OpenCV detectó ${opencvOutput.comparison.discrepancy} discrepancias en checkboxes`;
      }
      break;

    case 'validate':
      if (opencvOutput.requiresHumanReview) {
        extractionResult.requiresHumanReview = true;
        extractionResult.humanReviewReason = `OpenCV detectó ${opencvOutput.comparison.discrepancy} discrepancias en checkboxes`;
        extractionResult.validation_status = 'needs_review';
      }
      break;
  }
}
