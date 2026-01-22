/**
 * fundaeValidationRules.ts
 *
 * Reglas de validación específicas para formularios FUNDAE
 * Orden TAS 2307/2025 del 27 de Julio
 *
 * Incluye validación de:
 * - Encabezado del formulario
 * - Sección I: Datos identificativos de la acción formativa
 * - Sección II: Datos de clasificación del participante
 * - Sección III: Valoración de las acciones formativas
 * - Detección de múltiples respuestas → NC (No Consta)
 */

import { validateCIF, validateAge, type ValidationResult } from './validationRules';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SeccionIDatos {
  expediente: string;          // Campo 1
  empresa?: string;
  modalidad?: string;
  cif: string;                 // Campo 4 (CRÍTICO)
  denominacion_aaff: string;   // Campo 5 (CRÍTICO)
}

export interface SeccionIIDatos {
  edad: number;                    // 1. Edad (número)
  sexo: string;                    // 2. Sexo (Mujer/Varón)
  titulacion: string;              // 3. Titulación
  lugar_trabajo: string;           // 4. Lugar de trabajo (CÓDIGO CIUDAD)
  categoria_profesional: string;   // 5. Categoría
  tamaño_empresa?: string;         // 6. Tamaño empresa
}

export interface Valoraciones {
  [pregunta: string]: number | string;  // 1-4 o texto libre
}

export interface ValidationError {
  field_name: string;
  error_type: string;
  error_message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  extracted_value: string | null;
  expected_format?: string;
}

// ============================================================================
// VALIDACIÓN DE ENCABEZADO
// ============================================================================

/**
 * Valida que el documento sea un formulario FUNDAE válido
 * Encabezado debe contener: "FORMACIÓN DE DEMANDA" y "orden TAS 2307/2025 del 27 de Julio"
 */
export function validateFundaeHeader(extractedData: any): ValidationResult {
  const headerText = extractedData.header || extractedData.encabezado || extractedData.titulo || '';

  // Buscar "FORMACIÓN DE DEMANDA" (con variaciones de acentos y espacios)
  const hasFormacionDemanda = /FORMACI[OÓ]N\s+DE\s+DEMANDA/i.test(headerText);

  // Buscar "orden TAS 2307/2025" o "TAS 2307-2025"
  const hasTAS2307 = /TAS\s*2307[\/\-]2025/i.test(headerText) ||
                     /orden.*2307.*2025/i.test(headerText);

  if (!hasFormacionDemanda || !hasTAS2307) {
    return {
      isValid: false,
      errorType: 'invalid_document_type',
      errorMessage: 'No es un formulario FUNDAE válido (orden TAS 2307/2025)',
      expectedFormat: 'Encabezado debe contener "FORMACIÓN DE DEMANDA" y "orden TAS 2307/2025"',
      severity: 'critical'
    };
  }

  return { isValid: true };
}

// ============================================================================
// VALIDACIÓN SECCIÓN I: DATOS IDENTIFICATIVOS
// ============================================================================

/**
 * Valida sección I del formulario FUNDAE
 * Campos críticos: 1 (expediente), 4 (CIF), 5 (denominación AAFF)
 * Deben coincidir con Excel de referencia si existe
 */
export function validateSeccionI(
  datos: SeccionIDatos,
  referenceData?: any
): ValidationResult {
  const errors: string[] = [];

  // 1. Campo expediente (formato: Letra + 6-8 dígitos + 1-3 letras)
  const expedienteRegex = /^[A-Z]\d{6,8}[A-Z]{1,3}$/;
  if (!datos.expediente) {
    errors.push('Número de expediente es obligatorio');
  } else if (!expedienteRegex.test(datos.expediente.trim().toUpperCase())) {
    errors.push(`Formato de expediente inválido: "${datos.expediente}" (esperado: B241579AC)`);
  }

  // 4. Campo CIF
  if (!datos.cif) {
    errors.push('CIF es obligatorio');
  } else {
    const cifValidation = validateCIF(datos.cif);
    if (!cifValidation.isValid) {
      errors.push(`CIF inválido: ${cifValidation.errorMessage}`);
    }
  }

  // 5. Campo denominación
  if (!datos.denominacion_aaff || datos.denominacion_aaff.trim().length < 3) {
    errors.push('Denominación de acción formativa es obligatoria y debe tener al menos 3 caracteres');
  }

  // Validación cruzada con Excel (si existe)
  if (referenceData) {
    const expedienteNormalizado = datos.expediente?.trim().toUpperCase();
    const expedienteRefNormalizado = referenceData.expediente?.trim().toUpperCase();

    if (expedienteNormalizado !== expedienteRefNormalizado) {
      errors.push(`Expediente no coincide con Excel: esperado "${referenceData.expediente}", encontrado "${datos.expediente}"`);
    }

    const cifNormalizado = datos.cif?.trim().toUpperCase();
    const cifRefNormalizado = referenceData.cif?.trim().toUpperCase();

    if (cifNormalizado !== cifRefNormalizado) {
      errors.push(`CIF no coincide con Excel: esperado "${referenceData.cif}", encontrado "${datos.cif}"`);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errorType: 'seccion_i_invalid',
      errorMessage: errors.join('; '),
      severity: 'critical'
    };
  }

  return { isValid: true };
}

// ============================================================================
// VALIDACIÓN SECCIÓN II: CLASIFICACIÓN DEL PARTICIPANTE
// ============================================================================

/**
 * Valida sección II completa
 */
export function validateSeccionII(
  datos: SeccionIIDatos,
  cityCodesMap?: Record<string, string>  // BCN → Barcelona
): ValidationResult {
  const errors: string[] = [];

  // 1. Edad (16-67 años)
  if (datos.edad === null || datos.edad === undefined) {
    errors.push('Edad es obligatoria');
  } else {
    const edadValidation = validateAge(String(datos.edad), 16, 67);
    if (!edadValidation.isValid) {
      errors.push(`Edad: ${edadValidation.errorMessage}`);
    }
  }

  // 2. Sexo
  if (!datos.sexo) {
    errors.push('Sexo es obligatorio');
  } else {
    const sexoValido = ['Mujer', 'Varón', 'Hombre', 'Masculino', 'Femenino', 'Otro'].some(v =>
      datos.sexo?.toLowerCase().includes(v.toLowerCase())
    );
    if (!sexoValido) {
      errors.push(`Sexo: valor inválido "${datos.sexo}" (debe ser Mujer, Varón, u Otro)`);
    }
  }

  // 3. Titulación
  if (!datos.titulacion || datos.titulacion.trim().length < 2) {
    errors.push('Titulación es obligatoria');
  }

  // 4. Lugar de trabajo - resolver código ciudad si existe catálogo
  if (!datos.lugar_trabajo) {
    errors.push('Lugar de trabajo es obligatorio');
  } else if (cityCodesMap) {
    const upperCity = datos.lugar_trabajo.trim().toUpperCase();
    if (cityCodesMap[upperCity]) {
      // Expandir código: BCN → Barcelona
      datos.lugar_trabajo = cityCodesMap[upperCity];
    }
  }

  // 5. Categoría profesional
  if (!datos.categoria_profesional) {
    errors.push('Categoría profesional es obligatoria');
  } else {
    const categoriasValidas = [
      'Directivo/a',
      'Directivo',
      'Directiva',
      'Técnico/a',
      'Técnico',
      'Técnica',
      'Trabajador/a cualificado/a',
      'Trabajador cualificado',
      'Trabajadora cualificada',
      'Trabajador/a no cualificado/a',
      'Trabajador no cualificado',
      'Trabajadora no cualificada'
    ];

    const categoriaValida = categoriasValidas.some(c =>
      datos.categoria_profesional?.toLowerCase().includes(c.toLowerCase())
    );

    if (!categoriaValida) {
      errors.push(`Categoría profesional no válida: "${datos.categoria_profesional}"`);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errorType: 'seccion_ii_invalid',
      errorMessage: errors.join('; '),
      severity: 'high'
    };
  }

  return { isValid: true };
}

// ============================================================================
// VALIDACIÓN SECCIÓN III: VALORACIONES
// ============================================================================

/**
 * Valida todas las preguntas de valoración
 * La mayoría deben ser 1-4, excepto pregunta 10 (puede ser texto libre)
 */
export function validateValoraciones(
  valoraciones: Valoraciones
): ValidationResult {
  const errors: string[] = [];

  for (const [pregunta, valor] of Object.entries(valoraciones)) {
    // Pregunta 10 permite texto libre
    if (pregunta.includes('10') ||
        pregunta.toLowerCase().includes('satisfacción general') ||
        pregunta.toLowerCase().includes('satisfaccion general')) {
      continue;  // Skip validación numérica
    }

    // Preguntas 8.1 y 8.2 son Sí/No/NC (no escala 1-4)
    if (pregunta.includes('8_1') || pregunta.includes('8_2') ||
        pregunta.includes('8.1') || pregunta.includes('8.2')) {
      // Validar que sea Sí, No o NC
      const valorStr = String(valor).toLowerCase().trim();
      const valoresValidos = ['si', 'sí', 'no', 'nc', 'no contesta', 's', 'n'];
      if (valor !== null && valor !== undefined && valor !== '' &&
          !valoresValidos.includes(valorStr)) {
        errors.push(`${pregunta}: valor "${valor}" no válido (debe ser Sí, No o NC)`);
      }
      continue;  // Skip validación numérica
    }

    // Resto: validar escala 1-4
    const valorNum = typeof valor === 'number' ? valor : parseInt(String(valor));

    if (isNaN(valorNum)) {
      errors.push(`${pregunta}: valor no numérico "${valor}"`);
    } else if (![1, 2, 3, 4].includes(valorNum)) {
      errors.push(`${pregunta}: valor ${valorNum} fuera de escala (debe ser 1-4)`);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errorType: 'valoraciones_invalid',
      errorMessage: `${errors.length} valoraciones incorrectas: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`,
      severity: 'medium'
    };
  }

  return { isValid: true };
}

// ============================================================================
// DETECCIÓN DE MÚLTIPLES RESPUESTAS
// ============================================================================

/**
 * Detecta si un campo tiene múltiples respuestas (2 X marcadas)
 * Si detecta múltiples → marcar como "NC" (No Consta)
 */
export function detectMultipleAnswers(
  fieldValue: any,
  fieldName: string
): {
  hasMultiple: boolean;
  suggestedValue?: string;
  details?: string;
} {
  // Si es array con más de 1 elemento
  if (Array.isArray(fieldValue) && fieldValue.length > 1) {
    return {
      hasMultiple: true,
      suggestedValue: 'NC',
      details: `Detectadas ${fieldValue.length} respuestas: ${fieldValue.join(', ')}`
    };
  }

  // Si es string con separadores
  if (typeof fieldValue === 'string') {
    const separators = ['/', ',', ';', '|', ' y ', ' Y ', ' e '];
    for (const sep of separators) {
      if (fieldValue.includes(sep)) {
        const parts = fieldValue.split(sep).filter(p => p.trim().length > 0);
        if (parts.length > 1) {
          return {
            hasMultiple: true,
            suggestedValue: 'NC',
            details: `Múltiples valores separados por "${sep}": ${parts.join(', ')}`
          };
        }
      }
    }
  }

  return { hasMultiple: false };
}

/**
 * Procesa todos los campos del formulario buscando múltiples respuestas
 * Excluye campos que legítimamente pueden tener múltiples valores
 */
export function processMultipleAnswers(extractedData: any): {
  data: any;
  ncFields: string[];
} {
  const ncFields: string[] = [];
  const processedData = { ...extractedData };

  // Campos que NO deben ser convertidos a NC (pueden tener múltiples valores)
  const excludedFields = ['valoraciones', 'observaciones', 'comentarios', 'notas'];

  for (const [fieldName, fieldValue] of Object.entries(extractedData)) {
    // Skip campos excluidos
    if (excludedFields.some(excluded => fieldName.toLowerCase().includes(excluded))) {
      continue;
    }

    const detection = detectMultipleAnswers(fieldValue, fieldName);

    if (detection.hasMultiple) {
      processedData[fieldName] = 'NC';
      ncFields.push(`${fieldName}: ${detection.details}`);
    }
  }

  return { data: processedData, ncFields };
}

// ============================================================================
// VALIDACIÓN COMPLETA DE FORMULARIO FUNDAE
// ============================================================================

/**
 * Orquestador principal de validación FUNDAE
 * Orden de validación:
 * 1. Header (crítico) → Si falla, rechazar inmediatamente
 * 2. Detección múltiples respuestas → Convertir a NC
 * 3. Sección I (crítico) → Si falla, marcar para revisión
 * 4. Sección II (alto) → Si falla, marcar para revisión
 * 5. Valoraciones (medio) → Si falla, marcar campos específicos
 */
export async function validateFundaeFormulario(
  extractedData: any,
  referenceData?: any,
  cityCodesMap?: Record<string, string>
): Promise<{
  isValid: boolean;
  status: 'valid' | 'needs_review' | 'rejected';
  errors: ValidationError[];
  processedData: any;
  ncFields?: string[];
}> {
  const errors: ValidationError[] = [];
  let status: 'valid' | 'needs_review' | 'rejected' = 'valid';

  // 1. VALIDACIÓN HEADER (CRÍTICA)
  const headerValidation = validateFundaeHeader(extractedData);
  if (!headerValidation.isValid) {
    return {
      isValid: false,
      status: 'rejected',
      errors: [{
        field_name: 'header',
        error_type: headerValidation.errorType!,
        error_message: headerValidation.errorMessage!,
        severity: 'critical',
        extracted_value: null,
        expected_format: headerValidation.expectedFormat
      }],
      processedData: extractedData
    };
  }

  // 2. DETECCIÓN Y PROCESAMIENTO DE MÚLTIPLES RESPUESTAS
  const { data: processedData, ncFields } = processMultipleAnswers(extractedData);

  // 3. VALIDACIÓN SECCIÓN I
  const seccionI: SeccionIDatos = {
    expediente: processedData.expediente || processedData.numero_expediente || processedData.num_expediente,
    cif: processedData.cif || processedData.CIF,
    denominacion_aaff: processedData.denominacion_aaff || processedData.denominacion || processedData.accion_formativa
  };

  const seccionIValidation = validateSeccionI(seccionI, referenceData);
  if (!seccionIValidation.isValid) {
    errors.push({
      field_name: 'seccion_i',
      error_type: seccionIValidation.errorType!,
      error_message: seccionIValidation.errorMessage!,
      severity: seccionIValidation.severity!,
      extracted_value: JSON.stringify(seccionI),
      expected_format: 'Campos 1, 4, 5 deben coincidir con Excel de referencia'
    });
    status = 'needs_review';
  }

  // 4. VALIDACIÓN SECCIÓN II
  const seccionII: SeccionIIDatos = {
    edad: processedData.edad || processedData.age,
    sexo: processedData.sexo || processedData.genero,
    titulacion: processedData.titulacion || processedData.nivel_formacion,
    lugar_trabajo: processedData.lugar_trabajo || processedData.provincia || processedData.ciudad,
    categoria_profesional: processedData.categoria_profesional || processedData.categoria,
    tamaño_empresa: processedData.tamano_empresa || processedData.tamaño_empresa
  };

  const seccionIIValidation = validateSeccionII(seccionII, cityCodesMap);
  if (!seccionIIValidation.isValid) {
    errors.push({
      field_name: 'seccion_ii',
      error_type: seccionIIValidation.errorType!,
      error_message: seccionIIValidation.errorMessage!,
      severity: seccionIIValidation.severity!,
      extracted_value: JSON.stringify(seccionII),
      expected_format: undefined
    });
    if (status !== 'needs_review') status = 'needs_review';
  }

  // 5. VALIDACIÓN VALORACIONES
  if (processedData.valoraciones) {
    const valoracionesValidation = validateValoraciones(processedData.valoraciones);
    if (!valoracionesValidation.isValid) {
      errors.push({
        field_name: 'valoraciones',
        error_type: valoracionesValidation.errorType!,
        error_message: valoracionesValidation.errorMessage!,
        severity: valoracionesValidation.severity!,
        extracted_value: JSON.stringify(processedData.valoraciones),
        expected_format: 'Valores deben ser 1-4 (excepto 8.1, 8.2 y 10 que son Sí/No/NC)'
      });
      if (status !== 'needs_review') status = 'needs_review';
    }
  }

  // RESULTADO FINAL
  const isValid = errors.length === 0;
  if (isValid) status = 'valid';

  return {
    isValid,
    status,
    errors,
    processedData,
    ncFields
  };
}
