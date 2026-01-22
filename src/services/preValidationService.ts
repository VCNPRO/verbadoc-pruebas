/**
 * PRE-VALIDACIÓN DE DOCUMENTOS FUNDAE
 *
 * Valida ANTES de procesar que el documento tenga los campos críticos
 * en el Excel de referencia:
 * - Nº Expediente
 * - Nº Acción
 * - Nº Grupo
 *
 * Si no existe → documento NO PROCESABLE
 */

export interface PreValidationResult {
  isValid: boolean;
  canProcess: boolean;
  reason?: string;
  category?: string;
  missingFields?: string[];
  foundInReference?: boolean;
  referenceData?: any;
}

export interface CriticalFields {
  numero_expediente?: string;
  numero_accion?: string;
  numero_grupo?: string;
}

export class PreValidationService {
  /**
   * Valida que los campos críticos existan en el Excel de referencia
   *
   * @param extractedData - Datos extraídos por la IA
   * @param userId - ID del usuario (para buscar en su reference_data)
   * @returns Resultado de la validación previa
   */
  static async validateBeforeProcessing(
    extractedData: any,
    userId: string
  ): Promise<PreValidationResult> {
    console.log('🔍 Pre-validación: Verificando campos críticos...');

    // 1. Extraer campos críticos
    const criticalFields = this.extractCriticalFields(extractedData);

    // 2. Verificar que no falten campos
    const missingFields = this.checkMissingFields(criticalFields);
    if (missingFields.length > 0) {
      console.log('❌ Pre-validación: Faltan campos críticos:', missingFields);
      return {
        isValid: false,
        canProcess: false,
        reason: `Faltan campos críticos: ${missingFields.join(', ')}`,
        category: 'campos_faltantes',
        missingFields,
        foundInReference: false
      };
    }

    // 3. Buscar en reference_data
    try {
      const referenceData = await this.findInReferenceData(criticalFields, userId);

      if (!referenceData) {
        console.log('❌ Pre-validación: No existe en Excel de referencia');
        return {
          isValid: false,
          canProcess: false,
          reason: `Documento no encontrado en Excel de referencia. Expediente: ${criticalFields.numero_expediente}, Acción: ${criticalFields.numero_accion}, Grupo: ${criticalFields.numero_grupo}`,
          category: 'sin_referencia',
          foundInReference: false
        };
      }

      console.log('✅ Pre-validación: Documento encontrado en referencia');
      return {
        isValid: true,
        canProcess: true,
        foundInReference: true,
        referenceData
      };

    } catch (error: any) {
      console.error('❌ Error en pre-validación:', error);
      return {
        isValid: false,
        canProcess: false,
        reason: `Error al validar: ${error.message}`,
        category: 'error_critico',
        foundInReference: false
      };
    }
  }

  /**
   * Extrae los campos críticos del documento
   */
  private static extractCriticalFields(extractedData: any): CriticalFields {
    return {
      numero_expediente: extractedData?.numero_expediente ||
                        extractedData?.expediente ||
                        extractedData?.['Nº Expediente'] ||
                        extractedData?.['numero expediente'],

      numero_accion: extractedData?.numero_accion ||
                     extractedData?.accion ||
                     extractedData?.['Nº Acción'] ||
                     extractedData?.['numero accion'] ||
                     extractedData?.['num_accion'],

      numero_grupo: extractedData?.numero_grupo ||
                    extractedData?.grupo ||
                    extractedData?.['Nº Grupo'] ||
                    extractedData?.['numero grupo']
    };
  }

  /**
   * Verifica qué campos críticos faltan
   */
  private static checkMissingFields(fields: CriticalFields): string[] {
    const missing: string[] = [];

    if (!fields.numero_expediente || fields.numero_expediente.trim() === '') {
      missing.push('Nº Expediente');
    }

    if (!fields.numero_accion || fields.numero_accion.trim() === '') {
      missing.push('Nº Acción');
    }

    if (!fields.numero_grupo || fields.numero_grupo.trim() === '') {
      missing.push('Nº Grupo');
    }

    return missing;
  }

  /**
   * Busca el documento en reference_data usando los campos críticos
   *
   * IMPORTANTE: Esta función debe llamarse en el servidor (no en frontend)
   * porque necesita acceso directo a la BD.
   */
  private static async findInReferenceData(
    fields: CriticalFields,
    userId: string
  ): Promise<any | null> {
    // Esta función debe ser implementada en el backend
    // Por ahora retorna un placeholder

    // En el backend real (API route):
    // const result = await sql`
    //   SELECT * FROM reference_data
    //   WHERE user_id = ${userId}
    //   AND data->>'numero_expediente' = ${fields.numero_expediente}
    //   AND data->>'numero_accion' = ${fields.numero_accion}
    //   AND data->>'numero_grupo' = ${fields.numero_grupo}
    //   LIMIT 1
    // `;
    //
    // return result.rows.length > 0 ? result.rows[0] : null;

    console.warn('⚠️  findInReferenceData debe ejecutarse en el backend');
    return null;
  }

  /**
   * Normaliza valores para comparación (quita espacios, mayúsculas/minúsculas)
   */
  static normalizeValue(value: string | undefined): string {
    if (!value) return '';
    return value.toString().trim().toLowerCase();
  }

  /**
   * Compara dos valores normalizados
   */
  static compareNormalized(value1: string | undefined, value2: string | undefined): boolean {
    return this.normalizeValue(value1) === this.normalizeValue(value2);
  }
}

/**
 * API HELPER: Validar en el backend antes de procesar
 *
 * Uso en API route:
 *
 * import { preValidateDocument } from '@/services/preValidationService';
 *
 * const validation = await preValidateDocument(extractedData, userId);
 * if (!validation.canProcess) {
 *   // Registrar como no procesable
 *   await registerUnprocessable(filename, validation.category, validation.reason);
 *   return res.status(422).json({ error: validation.reason });
 * }
 */
export async function preValidateDocument(
  extractedData: any,
  userId: string
): Promise<PreValidationResult> {
  // En el backend podemos usar sql directamente
  const { sql } = await import('@vercel/postgres');

  // 1. Extraer campos críticos
  const numero_expediente = extractedData?.numero_expediente || extractedData?.expediente;
  const numero_accion = extractedData?.numero_accion || extractedData?.accion || extractedData?.num_accion;
  const numero_grupo = extractedData?.numero_grupo || extractedData?.grupo;

  // 2. Verificar que no falten
  const missing: string[] = [];
  if (!numero_expediente) missing.push('Nº Expediente');
  if (!numero_accion) missing.push('Nº Acción');
  if (!numero_grupo) missing.push('Nº Grupo');

  if (missing.length > 0) {
    return {
      isValid: false,
      canProcess: false,
      reason: `Faltan campos críticos: ${missing.join(', ')}`,
      category: 'campos_faltantes',
      missingFields: missing,
      foundInReference: false
    };
  }

  // 3. Buscar en reference_data
  try {
    console.log('🔍 Buscando en reference_data:', { numero_expediente, numero_accion, numero_grupo });

    const result = await sql`
      SELECT * FROM reference_data
      WHERE user_id = ${userId}
      AND (
        data->>'numero_expediente' = ${numero_expediente}
        OR data->>'expediente' = ${numero_expediente}
      )
      AND (
        data->>'numero_accion' = ${numero_accion}
        OR data->>'accion' = ${numero_accion}
        OR data->>'num_accion' = ${numero_accion}
      )
      AND (
        data->>'numero_grupo' = ${numero_grupo}
        OR data->>'grupo' = ${numero_grupo}
      )
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      console.log('❌ No encontrado en reference_data');
      return {
        isValid: false,
        canProcess: false,
        reason: `Documento no existe en Excel de referencia. Expediente: ${numero_expediente}, Acción: ${numero_accion}, Grupo: ${numero_grupo}`,
        category: 'sin_referencia',
        foundInReference: false
      };
    }

    console.log('✅ Documento encontrado en reference_data');
    return {
      isValid: true,
      canProcess: true,
      foundInReference: true,
      referenceData: result.rows[0]
    };

  } catch (error: any) {
    console.error('❌ Error buscando en reference_data:', error);
    return {
      isValid: false,
      canProcess: false,
      reason: `Error al validar contra Excel de referencia: ${error.message}`,
      category: 'error_critico',
      foundInReference: false
    };
  }
}
