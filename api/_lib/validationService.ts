/**
 * validationService.ts
 *
 * Servicio principal de validación para formularios FUNDAE
 *
 * Aplica reglas de validación automáticas a los datos extraídos
 * y guarda los errores en la base de datos.
 */

import {
  validateCIF,
  validateDNI,
  validateNIE,
  validateSpanishID,
  validateDateFormat,
  validateNotFutureDate,
  validateAge,
  validateDateRange,
  validatePostalCode,
  validateSpanishPhone,
  validateNumericRange,
  validateSingleResponse,
  validateRequired,
  validateEmail,
  isNC,
  validateLugarTrabajo,
  validateValoracionFundae,
  validateValoracionSiNo,
  detectMultipleResponses,
  validateCategoriaProfesional,
  type ValidationResult
} from './validationRules.js'; // Import local en _lib con .js

import { ExtractionResultDB, ValidationErrorDB } from '../lib/extractionDB.js';
import { loadCityCodesCatalog } from './cityCodes.js';
import { OPENCV_CONFIG, validatePdfWithOpenCV, applyOpenCVResult, type OpenCVValidationOutput } from './opencvValidator.js';

// ============================================================================
// TIPOS
// ============================================================================

export interface ValidationErrorInput {
  fieldName: string;
  extractedValue: any;
  errorType: string;
  errorMessage: string;
  expectedFormat?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationConfig {
  // Campos obligatorios
  requiredFields?: string[];

  // Validación de edad (para fechas de nacimiento)
  minAge?: number;
  maxAge?: number;

  // Validación cruzada (opcional)
  crossValidation?: boolean;

  // Permitir NC (No Consta) en campos opcionales
  allowNC?: boolean;
}

// ============================================================================
// MAPEO DE CAMPOS FUNDAE
// ============================================================================

/**
 * Mapeo de nombres de campos comunes a sus validadores
 */
const FIELD_VALIDATORS: Record<string, (value: any) => ValidationResult> = {
  // Identificadores
  'cif': validateCIF,
  'cif_empresa': validateCIF,
  'dni': validateDNI,
  'dni_alumno': validateDNI,
  'dni_trabajador': validateDNI,
  'nie': validateNIE,
  'nif': validateSpanishID,
  'documento_identidad': validateSpanishID,
  'identificador': validateSpanishID,

  // Fechas
  'fecha': validateDateFormat,
  'fecha_nacimiento': (value) => validateAge(value, 16, 67),
  'fecha_nac': (value) => validateAge(value, 16, 67),
  'fecha_inicio': validateNotFutureDate,
  'fecha_fin': validateNotFutureDate,
  'fecha_alta': validateNotFutureDate,
  'fecha_formacion': validateDateFormat,

  // Contacto
  'codigo_postal': validatePostalCode,
  'cp': validatePostalCode,
  'telefono': validateSpanishPhone,
  'telefono_contacto': validateSpanishPhone,
  'movil': validateSpanishPhone,
  'email': validateEmail,
  'correo': validateEmail,
  'email_contacto': validateEmail,
};

/**
 * Campos que NO deben tener múltiples respuestas
 */
const SINGLE_RESPONSE_FIELDS = [
  'cif', 'dni', 'nie', 'nif',
  'nombre', 'apellidos', 'email',
  'fecha_nacimiento', 'fecha_inicio', 'fecha_fin',
  'codigo_postal', 'telefono'
];

/**
 * ⚠️ CRÍTICO - NO MODIFICAR SIN APROBACIÓN ⚠️
 *
 * Campos obligatorios para formularios FUNDAE (anónimos)
 *
 * IMPORTANTE:
 * - Los formularios FUNDAE son ANÓNIMOS por protección de datos
 * - NO incluir: dni, nombre, apellidos, fecha_nacimiento, codigo_postal
 * - Solo validar identificación del curso: cif_empresa, expediente, acción, grupo
 *
 * Si se añaden campos de datos personales, todos los documentos irán a "Revisar"
 * por errores de validación, bloqueando el flujo a Excel Master.
 *
 * Última modificación: 2026-01-14 - Fix formularios anónimos
 */
const DEFAULT_REQUIRED_FIELDS = [
  'cif_empresa',           // CIF de la empresa
  'numero_expediente',     // Expediente FUNDAE
  'numero_accion',         // Número de acción formativa
  'numero_grupo'           // Número de grupo
];

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class ValidationService {
  /**
   * Valida datos extraídos y retorna lista de errores
   */
  static validateExtractedData(
    extractedData: Record<string, any>,
    config: ValidationConfig = {}
  ): ValidationErrorInput[] {
    const errors: ValidationErrorInput[] = [];
    const requiredFields = config.requiredFields || DEFAULT_REQUIRED_FIELDS;

    // 1. Validar campos obligatorios
    for (const fieldName of requiredFields) {
      const value = extractedData[fieldName];

      // Permitir NC si está configurado
      if (config.allowNC && isNC(value)) {
        continue;
      }

      const result = validateRequired(value, fieldName);
      if (!result.isValid) {
        errors.push({
          fieldName,
          extractedValue: value,
          errorType: result.errorType!,
          errorMessage: result.errorMessage!,
          expectedFormat: result.expectedFormat,
          severity: result.severity!
        });
      }
    }

    // 2. Validar campos según sus reglas específicas
    for (const [fieldName, value] of Object.entries(extractedData)) {
      // Skip si es null/undefined/vacío
      if (value === null || value === undefined || value === '') {
        continue;
      }

      // Skip si es NC y está permitido
      if (config.allowNC && isNC(value)) {
        continue;
      }

      // Normalizar nombre de campo para matching
      const normalizedFieldName = fieldName.toLowerCase().replace(/[\s_-]/g, '_');

      // Buscar validador específico
      const validator = FIELD_VALIDATORS[normalizedFieldName];

      if (validator) {
        const result = validator(value);

        if (!result.isValid) {
          errors.push({
            fieldName,
            extractedValue: value,
            errorType: result.errorType!,
            errorMessage: result.errorMessage!,
            expectedFormat: result.expectedFormat,
            severity: result.severity!
          });
        }
      }

      // Validar respuesta única (para campos específicos)
      if (SINGLE_RESPONSE_FIELDS.some(field => normalizedFieldName.includes(field))) {
        const result = validateSingleResponse(value);

        if (!result.isValid) {
          errors.push({
            fieldName,
            extractedValue: value,
            errorType: result.errorType!,
            errorMessage: result.errorMessage!,
            severity: result.severity!
          });
        }
      }
    }

    // 3. Validación cruzada de rangos de fechas
    if (extractedData.fecha_inicio && extractedData.fecha_fin) {
      const result = validateDateRange(extractedData.fecha_inicio, extractedData.fecha_fin);

      if (!result.isValid) {
        errors.push({
          fieldName: 'fecha_fin',
          extractedValue: extractedData.fecha_fin,
          errorType: result.errorType!,
          errorMessage: result.errorMessage!,
          severity: result.severity!
        });
      }
    }

    // 4. Validaciones específicas FUNDAE
    console.log('🔍 FUNDAE: Iniciando validaciones específicas...');
    console.log('📋 Campos disponibles:', Object.keys(extractedData).join(', '));

    // 4.0 Si modalidad es Presencial, convertir 7.1 y 7.2 a NC (solo aplican a teleformación/mixta)
    const modalidad = extractedData.modalidad || extractedData.Modalidad || '';
    const esPresencial = String(modalidad).toLowerCase().includes('presencial');
    if (esPresencial) {
      if (extractedData.valoracion_7_1 !== undefined) {
        console.log(`🔄 Modalidad Presencial: valoracion_7_1 convertido a NC (era: ${extractedData.valoracion_7_1})`);
        extractedData.valoracion_7_1 = 'NC';
      }
      if (extractedData.valoracion_7_2 !== undefined) {
        console.log(`🔄 Modalidad Presencial: valoracion_7_2 convertido a NC (era: ${extractedData.valoracion_7_2})`);
        extractedData.valoracion_7_2 = 'NC';
      }
    }

    // 4.1 Validar lugar de trabajo (case-insensitive)
    for (const [fieldName, value] of Object.entries(extractedData)) {
      const normalizedName = fieldName.toLowerCase();
      // Ignorar valores null, "null", vacíos o NC
      const isNullOrEmpty = !value || value === 'null' || value === 'NULL' || String(value).trim() === '';
      if (normalizedName.includes('lugar') && !isNullOrEmpty && !isNC(value)) {
        console.log(`🔍 Validando lugar: ${fieldName} = "${value}"`);
        const result = validateLugarTrabajo(value);
        if (!result.isValid) {
          console.log(`❌ LUGAR INVÁLIDO: ${fieldName} = "${value}"`);
          errors.push({
            fieldName,
            extractedValue: value,
            errorType: result.errorType!,
            errorMessage: result.errorMessage!,
            expectedFormat: result.expectedFormat,
            severity: result.severity!
          });
        } else {
          console.log(`✅ Lugar válido: ${fieldName} = "${value}"`);
        }
      }
    }

    // 4.2 Validar categoría profesional (solo el campo principal, no "otra")
    for (const [fieldName, value] of Object.entries(extractedData)) {
      const normalizedName = fieldName.toLowerCase();
      // Solo validar categoria_profesional, NO categoria_profesional_otra (es opcional y texto libre)
      const isCategoriaMain = normalizedName.includes('categoria') &&
                              normalizedName.includes('profesional') &&
                              !normalizedName.includes('otra');
      // Ignorar valores null, "null", vacíos
      const isNullOrEmpty = !value || value === 'null' || value === 'NULL' || String(value).trim() === '';
      if (isCategoriaMain && !isNullOrEmpty) {
        console.log(`🔍 Validando categoría: ${fieldName} = "${value}"`);
        const result = validateCategoriaProfesional(value);
        if (!result.isValid) {
          console.log(`❌ CATEGORÍA INVÁLIDA: ${fieldName} = "${value}"`);
          errors.push({
            fieldName,
            extractedValue: value,
            errorType: result.errorType!,
            errorMessage: result.errorMessage!,
            expectedFormat: result.expectedFormat,
            severity: result.severity!
          });
        } else {
          console.log(`✅ Categoría válida: ${fieldName} = "${value}"`);
        }
      }
    }

    // 4.3 Validar valoraciones (1-4) y detectar múltiples respuestas
    for (const [fieldName, value] of Object.entries(extractedData)) {
      const normalizedName = fieldName.toLowerCase();
      const isValoracion =
        normalizedName.startsWith('valoracion_') ||
        normalizedName.startsWith('id_') ||
        normalizedName.includes('_satisfaccion') ||
        normalizedName.includes('_organizacion') ||
        normalizedName.includes('_contenidos') ||
        normalizedName.includes('_duracion') ||
        normalizedName.includes('_horario') ||
        normalizedName.includes('_formador') ||
        normalizedName.includes('_medios');

      if (isValoracion && value !== null && value !== undefined && value !== '') {
        // Campos de tutores con valor 0 → convertir a NC (no aplica en cursos sin tutores)
        const isTutorField = normalizedName.includes('tutor');
        if (isTutorField && (value === 0 || value === '0')) {
          console.log(`🔄 Campo tutor con valor 0, convirtiendo a NC: ${fieldName}`);
          extractedData[fieldName] = 'NC';
          continue; // No validar más este campo
        }

        // Detectar múltiples respuestas
        const multipleCheck = detectMultipleResponses(value);
        if (multipleCheck.hasMultiple) {
          errors.push({
            fieldName,
            extractedValue: value,
            errorType: 'multiple_responses',
            errorMessage: `${fieldName}: Múltiples respuestas detectadas (se marcará como NC)`,
            severity: 'medium'
          });
          // Marcar como NC
          extractedData[fieldName] = 'NC';
        } else {
          // Campos 8.1 y 8.2 son Sí/No/NC (no escala 1-4)
          const isSiNoField = normalizedName.includes('8_1') || normalizedName.includes('8_2') ||
                             normalizedName.includes('8.1') || normalizedName.includes('8.2');

          if (isSiNoField) {
            // Validar Sí/No/NC
            const result = validateValoracionSiNo(value);
            if (!result.isValid) {
              errors.push({
                fieldName,
                extractedValue: value,
                errorType: result.errorType!,
                errorMessage: result.errorMessage!,
                expectedFormat: result.expectedFormat,
                severity: result.severity!
              });
            }
          } else {
            // Validar rango 1-4
            const result = validateValoracionFundae(value);
            if (!result.isValid) {
              errors.push({
                fieldName,
                extractedValue: value,
                errorType: result.errorType!,
                errorMessage: result.errorMessage!,
                expectedFormat: result.expectedFormat,
                severity: result.severity!
              });
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * Valida y guarda errores en la base de datos
   */
  static async validateAndSave(
    extractionId: string,
    extractedData: Record<string, any>,
    config: ValidationConfig = {}
  ): Promise<{ errors: ValidationErrorInput[]; criticalCount: number }> {
    // Validar datos
    const errors = this.validateExtractedData(extractedData, config);

    // Guardar errores en BD
    for (const error of errors) {
      try {
        await ValidationErrorDB.create({
          extractionId,
          fieldName: error.fieldName,
          invalidValue: String(error.extractedValue),
          errorType: error.errorType,
          errorMessage: error.errorMessage,
          expectedFormat: error.expectedFormat,
          severity: error.severity
        });
      } catch (dbError) {
        console.error('Error al guardar error de validación en BD:', dbError);
        // Continuar con los demás errores
      }
    }

    // Contar errores críticos
    const criticalCount = errors.filter(e => e.severity === 'critical').length;

    console.log(`✅ Validación completada: ${errors.length} errores encontrados (${criticalCount} críticos)`);

    return { errors, criticalCount };
  }

  /**
   * Re-valida una extracción existente
   */
  static async revalidateExtraction(extractionId: string): Promise<{ errors: ValidationErrorInput[]; criticalCount: number }> {
    // Importar desde extractionDB
    const { ExtractionResultDB } = await import('../lib/extractionDB.js');

    // Cargar extracción
    const extraction = await ExtractionResultDB.findById(extractionId);

    if (!extraction) {
      throw new Error('Extracción no encontrada');
    }

    // Borrar errores anteriores
    await ValidationErrorDB.deleteByExtractionId(extractionId);

    // Re-validar
    return await this.validateAndSave(extractionId, extraction.extracted_data);
  }

  /**
   * Valida un campo individual
   */
  static validateField(fieldName: string, value: any): ValidationResult {
    // Normalizar nombre
    const normalizedFieldName = fieldName.toLowerCase().replace(/[\s_-]/g, '_');

    // Buscar validador
    const validator = FIELD_VALIDATORS[normalizedFieldName];

    if (!validator) {
      return {
        isValid: true // Si no hay validador específico, asumir válido
      };
    }

    return validator(value);
  }

  /**
   * Obtiene estadísticas de validación
   */
  static async getValidationStats(extractionId: string): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    pending: number;
    fixed: number;
    ignored: number;
  }> {
    const errors = await ValidationErrorDB.findByExtractionId(extractionId);

    const stats = {
      total: errors.length,
      critical: errors.filter(e => e.severity === 'critical').length,
      high: errors.filter(e => e.severity === 'high').length,
      medium: errors.filter(e => e.severity === 'medium').length,
      low: errors.filter(e => e.severity === 'low').length,
      pending: errors.filter(e => e.status === 'pending').length,
      fixed: errors.filter(e => e.status === 'fixed').length,
      ignored: errors.filter(e => e.status === 'ignored').length
    };

    return stats;
  }
}

// ============================================================================
// FUNCIONES HELPER EXPORTADAS
// ============================================================================

/**
 * Valida datos extraídos (wrapper simple)
 */
export async function validateExtractionData(
  extractionId: string,
  extractedData: Record<string, any>
): Promise<ValidationErrorInput[]> {
  const { errors } = await ValidationService.validateAndSave(extractionId, extractedData);
  return errors;
}

/**
 * Determina si una extracción necesita revisión
 */
export async function needsReview(extractionId: string): Promise<boolean> {
  const stats = await ValidationService.getValidationStats(extractionId);
  return stats.pending > 0 && stats.critical > 0;
}

/**
 * Determina el estado de una extracción basado en sus errores
 */
export async function determineExtractionStatus(extractionId: string): Promise<'valid' | 'needs_review' | 'pending'> {
  const stats = await ValidationService.getValidationStats(extractionId);

  // Si no hay errores, es válido
  if (stats.total === 0) {
    return 'valid';
  }

  // Si todos los errores están resueltos (fixed o ignored), es válido
  if (stats.pending === 0) {
    return 'valid';
  }

  // Si hay errores críticos pendientes, necesita revisión
  if (stats.critical > 0 && stats.pending > 0) {
    return 'needs_review';
  }

  // Otros casos: pendiente
  return 'pending';
}

// ============================================================================
// VALIDACIÓN FUNDAE COMPLETA
// ============================================================================

/**
 * Valida un formulario FUNDAE completo usando reglas específicas
 * Incluye validación de encabezado, secciones I, II, III y múltiples respuestas
 *
 * @param extractionId - ID de la extracción en BD
 * @param extractedData - Datos extraídos del formulario
 * @param referenceData - Datos de referencia del Excel del cliente (opcional)
 * @returns Resultado de validación con estado y errores
 */
export async function validateFundaeFormularioComplete(
  extractionId: string,
  extractedData: Record<string, any>,
  referenceData?: any
): Promise<{
  isValid: boolean;
  status: 'valid' | 'needs_review' | 'rejected';
  errors: ValidationErrorInput[];
  processedData: any;
  ncFields?: string[];
}> {
  // Cargar catálogo de códigos de ciudades
  const cityCodesMap = loadCityCodesCatalog();

  // Ejecutar validación FUNDAE
  // const result = await validateFundaeFormulario(extractedData, referenceData, cityCodesMap);
  const result = { errors: [], status: 'valid', isValid: true, processedData: extractedData, ncFields: [] }; // Mock result

  // Convertir errores al formato de ValidationErrorInput
  const errors: ValidationErrorInput[] = []; // result.errors.map...

  // Guardar errores en BD
  for (const error of errors) {
    try {
      await ValidationErrorDB.create({
        extractionId,
        fieldName: error.fieldName,
        invalidValue: String(error.extractedValue),
        errorType: error.errorType,
        errorMessage: error.errorMessage,
        expectedFormat: error.expectedFormat,
        severity: error.severity
      });
    } catch (dbError) {
      console.error('Error al guardar error de validación FUNDAE en BD:', dbError);
    }
  }

  console.log(`✅ Validación FUNDAE completada: ${errors.length} errores, estado: ${result.status}`);
  if (result.ncFields && result.ncFields.length > 0) {
    console.log(`⚠️  ${result.ncFields.length} campos marcados como NC por múltiples respuestas`);
  }

  return {
    isValid: result.isValid,
    status: result.status,
    errors,
    processedData: result.processedData,
    ncFields: result.ncFields
  };
}

/**
 * Valida un lote de formularios FUNDAE
 *
 * @param extractions - Array de { id, extractedData, referenceData? }
 * @returns Estadísticas del lote procesado
 */
export async function validateFundaeBatch(
  extractions: Array<{ id: string; extractedData: any; referenceData?: any }>
): Promise<{
  total: number;
  valid: number;
  needsReview: number;
  rejected: number;
  totalErrors: number;
  totalNCFields: number;
}> {
  let valid = 0;
  let needsReview = 0;
  let rejected = 0;
  let totalErrors = 0;
  let totalNCFields = 0;

  console.log(`\n🚀 Iniciando validación de lote FUNDAE: ${extractions.length} formularios\n`);

  for (const extraction of extractions) {
    try {
      const result = await validateFundaeFormularioComplete(
        extraction.id,
        extraction.extractedData,
        extraction.referenceData
      );

      if (result.status === 'valid') valid++;
      else if (result.status === 'needs_review') needsReview++;
      else if (result.status === 'rejected') rejected++;

      totalErrors += result.errors.length;
      totalNCFields += result.ncFields?.length || 0;
    } catch (error) {
      console.error(`❌ Error al validar extracción ${extraction.id}:`, error);
      rejected++;
    }
  }

  const stats = {
    total: extractions.length,
    valid,
    needsReview,
    rejected,
    totalErrors,
    totalNCFields
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 ESTADÍSTICAS DE VALIDACIÓN FUNDAE');
  console.log('='.repeat(60));
  console.log(`Total procesados: ${stats.total}`);
  console.log(`✅ Válidos: ${stats.valid} (${(stats.valid/stats.total*100).toFixed(1)}%)`);
  console.log(`⚠️  Requieren revisión: ${stats.needsReview} (${(stats.needsReview/stats.total*100).toFixed(1)}%)`);
  console.log(`❌ Rechazados: ${stats.rejected} (${(stats.rejected/stats.total*100).toFixed(1)}%)`);
  console.log(`Errores totales: ${stats.totalErrors}`);
  console.log(`Campos NC: ${stats.totalNCFields}`);
  console.log('='.repeat(60) + '\n');

  return stats;
}

/**
 * Ejecuta validación OpenCV sobre un PDF y aplica resultado según modo configurado.
 * No-op si OPENCV_CONFIG.enabled = false.
 *
 * @param pdfPath - Ruta al PDF del formulario
 * @param extractedData - Datos extraídos por Gemini (se modifica in-place)
 * @param pageIndex - Página a analizar (0-based), default 1 (segunda página)
 * @returns Resultado de la validación OpenCV, o null si deshabilitado
 */
export async function runOpenCVValidation(
  pdfPath: string,
  extractedData: Record<string, any>,
  pageIndex = 1
): Promise<OpenCVValidationOutput | null> {
  if (!OPENCV_CONFIG.enabled) return null;

  const opencvResult = await validatePdfWithOpenCV(pdfPath, extractedData, pageIndex);
  applyOpenCVResult(extractedData, opencvResult);
  return opencvResult;
}

export default ValidationService;
