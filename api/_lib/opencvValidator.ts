/**
 * opencvValidator.ts
 *
 * Integración OpenCV para validación de checkboxes en formularios FUNDAE.
 * Capa de validación complementaria a Gemini (no reemplazo).
 *
 * ROLLBACK: Desactivar con OPENCV_CONFIG.enabled = false
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

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
  /** Ruta al intérprete Python */
  pythonPath: string;
  /** Timeout en ms para el proceso Python */
  timeoutMs: number;
}

export const OPENCV_CONFIG: OpenCVConfig = {
  enabled: false,
  mode: 'log_only',
  discrepancyThreshold: 5,
  pythonPath: process.env.OPENCV_PYTHON_PATH || 'python',
  timeoutMs: 15_000,
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

const SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'lib', 'fundae_opencv_validator.py');

/**
 * Convierte una página de un PDF a PNG usando pymupdf (fitz).
 * Devuelve la ruta al archivo temporal PNG creado.
 */
async function pdfPageToPng(pdfPath: string, pageIndex: number, dpi = 200): Promise<string> {
  const tmpDir = os.tmpdir();
  const outPath = path.join(tmpDir, `fundae_opencv_${Date.now()}_p${pageIndex}.png`);

  const script = `
import fitz, sys
doc = fitz.open(sys.argv[1])
page = doc[int(sys.argv[2])]
pix = page.get_pixmap(dpi=int(sys.argv[3]))
pix.save(sys.argv[4])
doc.close()
`.trim();

  await execFileAsync(
    OPENCV_CONFIG.pythonPath,
    ['-c', script, pdfPath, String(pageIndex), String(dpi), outPath],
    { timeout: OPENCV_CONFIG.timeoutMs }
  );

  return outPath;
}

/**
 * Ejecuta el validador OpenCV sobre una imagen de página de formulario.
 */
async function runOpenCVScript(imagePath: string): Promise<OpenCVResult> {
  const { stdout } = await execFileAsync(
    OPENCV_CONFIG.pythonPath,
    [SCRIPT_PATH, imagePath],
    { timeout: OPENCV_CONFIG.timeoutMs }
  );

  // El script imprime texto informativo y luego JSON después del separador
  const jsonMatch = stdout.split('JSON Output:').pop();
  if (!jsonMatch) {
    throw new Error('No se encontró salida JSON del script OpenCV');
  }

  // Extraer solo el JSON válido (entre llaves)
  const braceStart = jsonMatch.indexOf('{');
  if (braceStart === -1) {
    throw new Error('JSON inválido en salida OpenCV');
  }

  return JSON.parse(jsonMatch.slice(braceStart));
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
 * Validación principal: ejecuta OpenCV y compara con Gemini.
 *
 * @param imagePath - Ruta a la imagen PNG de la página del formulario
 * @param geminiData - Datos extraídos por Gemini
 * @returns Resultado de validación con flag de revisión humana
 */
export async function validateWithOpenCV(
  imagePath: string,
  geminiData: Record<string, any>
): Promise<OpenCVValidationOutput> {
  if (!OPENCV_CONFIG.enabled) {
    return { enabled: false, mode: OPENCV_CONFIG.mode, requiresHumanReview: false };
  }

  try {
    const opencvResult = await runOpenCVScript(imagePath);
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
 * Validación completa desde PDF: convierte página a PNG, ejecuta OpenCV, compara con Gemini.
 *
 * @param pdfPath - Ruta al archivo PDF
 * @param pageIndex - Índice de página (0-based), por defecto la segunda página (1)
 * @param geminiData - Datos extraídos por Gemini
 */
export async function validatePdfWithOpenCV(
  pdfPath: string,
  geminiData: Record<string, any>,
  pageIndex = 1
): Promise<OpenCVValidationOutput> {
  if (!OPENCV_CONFIG.enabled) {
    return { enabled: false, mode: OPENCV_CONFIG.mode, requiresHumanReview: false };
  }

  let tmpPng: string | undefined;
  try {
    tmpPng = await pdfPageToPng(pdfPath, pageIndex);
    return await validateWithOpenCV(tmpPng, geminiData);
  } finally {
    if (tmpPng) {
      fs.unlink(tmpPng, () => {});
    }
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
      if (opencvOutput.requiresHumanReview) {
        extractionResult.requiresHumanReview = true;
        extractionResult.humanReviewReason = `OpenCV detectó ${opencvOutput.comparison.discrepancy} discrepancias en checkboxes`;
        extractionResult.validation_status = 'needs_review';
      }
      break;
  }
}
