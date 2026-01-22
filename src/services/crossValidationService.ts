/**
 * Servicio de Validación Cruzada
 *
 * Compara los datos extraídos por IA con los datos de referencia del Excel
 * Identifica discrepancias y genera reportes de calidad
 */

import { sql } from '@vercel/postgres';

// ============================================================================
// TIPOS
// ============================================================================

export interface Discrepancy {
  field: string;
  expected: any;
  actual: any;
  severity: 'critical' | 'warning' | 'info';
  difference?: any;
  message?: string;
}

export interface CrossValidationResult {
  matches: boolean;
  matchPercentage: number;
  discrepancies: Discrepancy[];
  matchingFields: string[];
  totalFieldsCompared: number;
  matchingFieldsCount: number;
  discrepancyCount: number;
  criticalDiscrepancies: number;
  warningDiscrepancies: number;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Campos críticos - discrepancias aquí son severity: critical
 */
const CRITICAL_FIELDS = [
  'numero_expediente',
  'nif_empresa',
  'importe_total',
  'razon_social'
];

/**
 * Campos numéricos - usar comparación numérica con tolerancia
 */
const NUMERIC_FIELDS = [
  'importe_total',
  'numero_participantes',
  'horas_formacion',
  'coste'
];

/**
 * Campos de fecha - normalizar antes de comparar
 */
const DATE_FIELDS = [
  'fecha_inicio',
  'fecha_fin',
  'fecha_alta',
  'fecha_baja'
];

/**
 * Tolerancia para comparaciones numéricas (0.01 = 1%)
 */
const NUMERIC_TOLERANCE = 0.01;

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Validar datos extraídos contra datos de referencia
 */
export function validateAgainstReference(
  extractedData: Record<string, any>,
  referenceData: Record<string, any>
): CrossValidationResult {

  const discrepancies: Discrepancy[] = [];
  const matchingFields: string[] = [];
  let totalFieldsCompared = 0;

  // Obtener todos los campos a comparar (unión de ambos conjuntos)
  const allFields = new Set([
    ...Object.keys(extractedData),
    ...Object.keys(referenceData)
  ]);

  // Comparar cada campo
  for (const field of allFields) {
    const extractedValue = extractedData[field];
    const referenceValue = referenceData[field];

    // Saltar campos null/undefined en ambos lados
    if (!extractedValue && !referenceValue) {
      continue;
    }

    totalFieldsCompared++;

    // Campo existe en referencia pero no en extracción
    if (referenceValue && !extractedValue) {
      discrepancies.push({
        field,
        expected: referenceValue,
        actual: null,
        severity: CRITICAL_FIELDS.includes(field) ? 'critical' : 'warning',
        message: 'Campo no extraído por IA'
      });
      continue;
    }

    // Campo existe en extracción pero no en referencia
    if (extractedValue && !referenceValue) {
      discrepancies.push({
        field,
        expected: null,
        actual: extractedValue,
        severity: 'info',
        message: 'Campo extra extraído por IA (no está en Excel de referencia)'
      });
      continue;
    }

    // Comparar valores según tipo de campo
    const comparisonResult = compareValues(
      field,
      extractedValue,
      referenceValue
    );

    if (comparisonResult.matches) {
      matchingFields.push(field);
    } else {
      discrepancies.push({
        field,
        expected: referenceValue,
        actual: extractedValue,
        severity: CRITICAL_FIELDS.includes(field) ? 'critical' : 'warning',
        difference: comparisonResult.difference,
        message: comparisonResult.message
      });
    }
  }

  // Calcular estadísticas
  const matchingFieldsCount = matchingFields.length;
  const discrepancyCount = discrepancies.length;
  const criticalDiscrepancies = discrepancies.filter(d => d.severity === 'critical').length;
  const warningDiscrepancies = discrepancies.filter(d => d.severity === 'warning').length;

  const matchPercentage = totalFieldsCompared > 0
    ? (matchingFieldsCount / totalFieldsCompared) * 100
    : 0;

  const matches = discrepancyCount === 0;

  return {
    matches,
    matchPercentage: parseFloat(matchPercentage.toFixed(2)),
    discrepancies,
    matchingFields,
    totalFieldsCompared,
    matchingFieldsCount,
    discrepancyCount,
    criticalDiscrepancies,
    warningDiscrepancies
  };
}

// ============================================================================
// FUNCIONES DE COMPARACIÓN
// ============================================================================

/**
 * Comparar dos valores según el tipo de campo
 */
function compareValues(
  field: string,
  value1: any,
  value2: any
): { matches: boolean; difference?: any; message?: string } {

  // Comparación numérica
  if (NUMERIC_FIELDS.includes(field)) {
    return compareNumeric(value1, value2);
  }

  // Comparación de fechas
  if (DATE_FIELDS.includes(field)) {
    return compareDates(value1, value2);
  }

  // Comparación de strings (por defecto)
  return compareStrings(value1, value2);
}

/**
 * Comparar valores numéricos con tolerancia
 */
function compareNumeric(
  value1: any,
  value2: any
): { matches: boolean; difference?: number; message?: string } {

  const num1 = parseFloat(String(value1).replace(/[^\d.-]/g, ''));
  const num2 = parseFloat(String(value2).replace(/[^\d.-]/g, ''));

  if (isNaN(num1) || isNaN(num2)) {
    return {
      matches: false,
      message: 'Valores no numéricos'
    };
  }

  const difference = Math.abs(num1 - num2);
  const percentDiff = num2 !== 0 ? (difference / Math.abs(num2)) : 0;

  const matches = percentDiff <= NUMERIC_TOLERANCE;

  return {
    matches,
    difference: parseFloat(difference.toFixed(2)),
    message: matches ? undefined : `Diferencia: ${difference.toFixed(2)}`
  };
}

/**
 * Comparar fechas (normaliza diferentes formatos)
 */
function compareDates(
  value1: any,
  value2: any
): { matches: boolean; message?: string } {

  const date1 = normalizeDate(value1);
  const date2 = normalizeDate(value2);

  if (!date1 || !date2) {
    return {
      matches: false,
      message: 'Formato de fecha inválido'
    };
  }

  // Comparar solo la fecha (ignorar tiempo)
  const matches = date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];

  return { matches };
}

/**
 * Normalizar fecha desde múltiples formatos
 */
function normalizeDate(value: any): Date | null {
  if (!value) return null;

  // Si ya es Date
  if (value instanceof Date) {
    return value;
  }

  // Intentar parsear como string
  const str = String(value).trim();

  // Formato ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  }

  // Formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [day, month, year] = str.split('/');
    const date = new Date(`${year}-${month}-${day}`);
    return isNaN(date.getTime()) ? null : date;
  }

  // Formato DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) {
    const [day, month, year] = str.split('-');
    const date = new Date(`${year}-${month}-${day}`);
    return isNaN(date.getTime()) ? null : date;
  }

  // Intentar parsear directamente
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Comparar strings (case-insensitive, trimmed)
 */
function compareStrings(
  value1: any,
  value2: any
): { matches: boolean; message?: string } {

  const str1 = String(value1).toLowerCase().trim();
  const str2 = String(value2).toLowerCase().trim();

  const matches = str1 === str2;

  return { matches };
}

// ============================================================================
// FUNCIONES DE BASE DE DATOS
// ============================================================================

/**
 * Guardar resultado de validación cruzada en BD
 */
export async function saveCrossValidationResult(
  extractionId: string,
  referenceId: string,
  result: CrossValidationResult
): Promise<void> {
  await sql`
    INSERT INTO cross_validation_results (
      extraction_id,
      reference_id,
      matches,
      match_percentage,
      discrepancies,
      matching_fields,
      total_fields_compared,
      matching_fields_count,
      discrepancy_count,
      critical_discrepancies,
      warning_discrepancies
    ) VALUES (
      ${extractionId},
      ${referenceId},
      ${result.matches},
      ${result.matchPercentage},
      ${JSON.stringify(result.discrepancies)}::jsonb,
      ${JSON.stringify(result.matchingFields)}::jsonb,
      ${result.totalFieldsCompared},
      ${result.matchingFieldsCount},
      ${result.discrepancyCount},
      ${result.criticalDiscrepancies},
      ${result.warningDiscrepancies}
    )
    ON CONFLICT (extraction_id)
    DO UPDATE SET
      reference_id = EXCLUDED.reference_id,
      matches = EXCLUDED.matches,
      match_percentage = EXCLUDED.match_percentage,
      discrepancies = EXCLUDED.discrepancies,
      matching_fields = EXCLUDED.matching_fields,
      total_fields_compared = EXCLUDED.total_fields_compared,
      matching_fields_count = EXCLUDED.matching_fields_count,
      discrepancy_count = EXCLUDED.discrepancy_count,
      critical_discrepancies = EXCLUDED.critical_discrepancies,
      warning_discrepancies = EXCLUDED.warning_discrepancies,
      validated_at = CURRENT_TIMESTAMP
  `;
}

/**
 * Obtener resultado de validación cruzada
 */
export async function getCrossValidationResult(
  extractionId: string
): Promise<CrossValidationResult | null> {
  const result = await sql`
    SELECT * FROM cross_validation_results
    WHERE extraction_id = ${extractionId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    matches: row.matches,
    matchPercentage: parseFloat(row.match_percentage),
    discrepancies: row.discrepancies,
    matchingFields: row.matching_fields,
    totalFieldsCompared: row.total_fields_compared,
    matchingFieldsCount: row.matching_fields_count,
    discrepancyCount: row.discrepancy_count,
    criticalDiscrepancies: row.critical_discrepancies,
    warningDiscrepancies: row.warning_discrepancies
  };
}

/**
 * Validar extracción contra dato de referencia
 */
export async function validateExtraction(
  extractionId: string
): Promise<{ success: boolean; result?: CrossValidationResult; error?: string }> {

  try {
    // 1. Obtener datos de la extracción
    const extractionResult = await sql`
      SELECT * FROM extraction_results
      WHERE id = ${extractionId}
    `;

    if (extractionResult.rows.length === 0) {
      return { success: false, error: 'Extracción no encontrada' };
    }

    const extraction = extractionResult.rows[0];
    const extractedData = extraction.extracted_data;

    // 2. Buscar dato de referencia
    // Intentar extraer identificador de los datos extraídos
    const formIdentifier = extractIdentifierFromExtraction(extractedData);

    if (!formIdentifier) {
      return {
        success: false,
        error: 'No se pudo identificar el número de expediente en los datos extraídos'
      };
    }

    // 3. Buscar en reference_data
    const referenceResult = await sql`
      SELECT * FROM reference_data
      WHERE form_identifier = ${formIdentifier}
      AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (referenceResult.rows.length === 0) {
      return {
        success: false,
        error: `No se encontró dato de referencia para el expediente "${formIdentifier}"`
      };
    }

    const reference = referenceResult.rows[0];
    const referenceFields = reference.data;

    // 4. Realizar validación
    const validationResult = validateAgainstReference(extractedData, referenceFields);

    // 5. Guardar resultado
    await saveCrossValidationResult(extractionId, reference.id, validationResult);

    return {
      success: true,
      result: validationResult
    };

  } catch (error: any) {
    console.error('Error en validación cruzada:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extraer identificador de formulario desde datos extraídos
 */
function extractIdentifierFromExtraction(data: Record<string, any>): string | null {
  // Buscar campos comunes de identificación
  const identifierFields = [
    'numero_expediente',
    'expediente',
    'num_expediente',
    'numeroExpediente'
  ];

  for (const field of identifierFields) {
    if (data[field]) {
      return String(data[field]).trim();
    }
  }

  return null;
}

export default {
  validateAgainstReference,
  saveCrossValidationResult,
  getCrossValidationResult,
  validateExtraction
};
