/**
 * opencvValidator.ts
 *
 * Integración OpenCV para validación de checkboxes en formularios FUNDAE.
 * Capa de validación complementaria a Gemini (no reemplazo).
 *
 * Llama al microservicio FastAPI (opencv_server.py) via HTTP.
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
  /** URL del microservicio OpenCV */
  serviceUrl: string;
  /** Timeout en ms para la petición HTTP */
  timeoutMs: number;
}

const DEFAULT_SERVICE_URL = 'https://mississippi-personally-remedies-themselves.trycloudflare.com';

export const OPENCV_CONFIG: OpenCVConfig = {
  enabled: true,
  mode: 'validate',
  discrepancyThreshold: 5,
  serviceUrl: process.env.OPENCV_SERVICE_URL || DEFAULT_SERVICE_URL,
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

interface OpenCVRowValue {
  row_index: number;
  field: string | null;
  opencv_value: string | null;
  num_checkboxes: number;
  marked_positions: number[];
  confidence: number;
}

interface OpenCVResult {
  total_checkboxes: number;
  total_rows: number;
  marked: number;
  empty: number;
  uncertain: number;
  processing_time_ms: number;
  checkboxes: OpenCVCheckbox[];
  row_values?: OpenCVRowValue[];
  comparison?: OpenCVFieldComparison;
}

interface OpenCVFieldComparison {
  total_compared: number;
  matches: number;
  discrepancies: number;
  match_rate: number;
  recommendation: string;
  fields: Array<{
    field: string;
    gemini: string;
    opencv: string;
    confidence: number;
    match: boolean;
  }>;
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
 * Llama al microservicio OpenCV con la URL del PDF.
 * El servicio descarga el PDF, convierte la página a PNG y ejecuta el validador.
 */
async function callOpenCVService(
  pdfUrl: string,
  pageIndex: number,
  geminiData?: Record<string, any>
): Promise<OpenCVResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENCV_CONFIG.timeoutMs);

  try {
    const url = `${OPENCV_CONFIG.serviceUrl}/validate`;
    console.log(`[OpenCV] Calling: ${url}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdf_url: pdfUrl,
        page_index: pageIndex,
        dpi: 200,
        gemini_data: geminiData || null,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenCV service HTTP ${resp.status}: ${text}`);
    }

    return await resp.json();
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
  // Si Gemini cae dentro del rango [marked, marked+uncertain], es plausible
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
 * @param pdfUrl - URL pública del PDF (ej. Vercel Blob)
 * @param geminiData - Datos extraídos por Gemini
 * @param pageIndex - Índice de página (0-based), por defecto la segunda página (1)
 * @returns Resultado de validación con flag de revisión humana
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
    const opencvResult = await callOpenCVService(pdfUrl, pageIndex, geminiData);
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

    // Log siempre cuando está habilitado
    console.log(`[OpenCV] marcados=${opencvResult.marked} gemini=${geminiMarked} ` +
      `diff=${comparison.discrepancy} rec=${comparison.recommendation} ` +
      `time=${opencvResult.processing_time_ms.toFixed(0)}ms`);

    if (requiresHumanReview) {
      console.warn(`[OpenCV] DISCREPANCIA ALTA: ${comparison.discrepancy} diferencias. Requiere revisión humana.`);
    }

    return output;
  } catch (err: any) {
    console.error(`[OpenCV] Error: ${err.message} | URL: ${OPENCV_CONFIG.serviceUrl} | cause: ${err.cause?.message || 'none'}`);
    return {
      enabled: true,
      mode: OPENCV_CONFIG.mode,
      requiresHumanReview: false,
      error: err.message,
    };
  }
}

/**
 * Aplica el resultado OpenCV al resultado de extracción según el modo configurado.
 *
 * @param extractionResult - Objeto resultado que se modifica in-place
 * @param opencvOutput - Resultado de validateWithOpenCV
 */
export function applyOpenCVResult(
  extractionResult: Record<string, any>,
  opencvOutput: OpenCVValidationOutput
): void {
  if (!opencvOutput.enabled || !opencvOutput.comparison) return;

  // Siempre adjuntar metadata OpenCV
  extractionResult._opencv = {
    marked: opencvOutput.opencv?.marked,
    gemini_marked: opencvOutput.comparison.gemini_marked,
    discrepancy: opencvOutput.comparison.discrepancy,
    recommendation: opencvOutput.comparison.recommendation,
    mode: opencvOutput.mode,
  };

  switch (opencvOutput.mode) {
    case 'log_only':
      // No modifica nada, solo se logueó arriba
      break;

    case 'flag_only':
      if (opencvOutput.requiresHumanReview) {
        extractionResult.requiresHumanReview = true;
        extractionResult.humanReviewReason = `OpenCV detectó ${opencvOutput.comparison.discrepancy} discrepancias en checkboxes`;
      }
      break;

    case 'validate':
      // Estrategia: OpenCV primero, Gemini para desempate
      // - conf >= 0.95 → OpenCV gana sin consultar Gemini
      // - conf < 0.95  → comparar con Gemini y resolver:
      //     - Si coinciden → usar ese valor (ambos de acuerdo)
      //     - Si difieren → OpenCV gana si conf >= 0.70, Gemini si < 0.70
      // - Regla de oro: OpenCV dice vacío con conf >= 0.95 → NC, punto final
      if (opencvOutput.opencv?.row_values) {
        let ocvWins = 0;
        let geminiWins = 0;
        let consensusCount = 0;
        const fieldDetails: Array<{ field: string; source: string; ocv: string; gemini: string; final: string; conf: number }> = [];

        for (const rv of opencvOutput.opencv.row_values) {
          if (!rv.field || rv.opencv_value === null || rv.opencv_value === undefined) continue;

          const geminiValue = extractionResult[rv.field];
          const ocvValue = rv.opencv_value;
          const conf = rv.confidence;

          // Normalizar para comparar
          const geminiNorm = (!geminiValue || geminiValue === 'No contesta' || geminiValue === 'NC') ? 'NC' : String(geminiValue).replace('Sí', 'Si');
          const ocvNorm = ocvValue === 'NC' ? 'NC' : String(ocvValue);
          const match = geminiNorm === ocvNorm;

          let finalValue: string;
          let source: string;

          if (conf >= 0.95) {
            // OpenCV altísima confianza: gana sin consultar
            finalValue = ocvValue;
            source = 'opencv';
            ocvWins++;
          } else if (match) {
            // Ambos de acuerdo: consenso
            finalValue = ocvValue;
            source = 'consensus';
            consensusCount++;
          } else if (conf >= 0.70) {
            // OpenCV confianza media + discrepancia: OpenCV gana pero se registra
            finalValue = ocvValue;
            source = 'opencv>gemini';
            ocvWins++;
          } else {
            // OpenCV baja confianza: Gemini gana
            finalValue = geminiNorm;
            source = 'gemini';
            geminiWins++;
          }

          extractionResult[rv.field] = finalValue;
          fieldDetails.push({ field: rv.field, source, ocv: ocvNorm, gemini: geminiNorm, final: finalValue, conf });
        }

        const totalMerged = ocvWins + geminiWins + consensusCount;
        console.log(`[OpenCV] Merge: ${totalMerged} campos | opencv=${ocvWins} consensus=${consensusCount} gemini=${geminiWins}`);

        extractionResult._opencv_merge = {
          total: totalMerged,
          opencv_wins: ocvWins,
          consensus: consensusCount,
          gemini_wins: geminiWins,
          fields: fieldDetails,
        };
      }
      break;
  }
}
