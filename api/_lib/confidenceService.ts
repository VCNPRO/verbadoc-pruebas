/**
 * SERVICIO DE CÁLCULO DE CONFIANZA REAL
 * api/_lib/confidenceService.ts
 *
 * Calcula un score de confianza REAL basado en:
 * 1. Campos extraídos vs esperados
 * 2. Validez de formatos
 * 3. Campos vacíos/nulos
 * 4. Consistencia entre campos relacionados
 */

// Schema FUNDAE embebido para evitar problemas de ESM/CommonJS con imports de src/
const FUNDAE_SCHEMA = [
  { id: 'numero_expediente', name: 'numero_expediente', type: 'STRING' },
  { id: 'perfil', name: 'perfil', type: 'STRING' },
  { id: 'cif_empresa', name: 'cif_empresa', type: 'STRING' },
  { id: 'numero_accion', name: 'numero_accion', type: 'STRING' },
  { id: 'numero_grupo', name: 'numero_grupo', type: 'STRING' },
  { id: 'denominacion_aaff', name: 'denominacion_aaff', type: 'STRING' },
  { id: 'modalidad', name: 'modalidad', type: 'STRING' },
  { id: 'edad', name: 'edad', type: 'NUMBER' },
  { id: 'sexo', name: 'sexo', type: 'STRING' },
  { id: 'titulacion', name: 'titulacion', type: 'STRING' },
  { id: 'titulacion_codigo', name: 'titulacion_codigo', type: 'STRING' },
  { id: 'lugar_trabajo', name: 'lugar_trabajo', type: 'STRING' },
  { id: 'categoria_profesional', name: 'categoria_profesional', type: 'STRING' },
  { id: 'categoria_profesional_otra', name: 'categoria_profesional_otra', type: 'STRING' },
  { id: 'horario_curso', name: 'horario_curso', type: 'STRING' },
  { id: 'porcentaje_jornada', name: 'porcentaje_jornada', type: 'STRING' },
  { id: 'tamano_empresa', name: 'tamano_empresa', type: 'STRING' },
  { id: 'valoracion_1_1', name: 'valoracion_1_1', type: 'STRING' },
  { id: 'valoracion_1_2', name: 'valoracion_1_2', type: 'STRING' },
  { id: 'valoracion_2_1', name: 'valoracion_2_1', type: 'STRING' },
  { id: 'valoracion_2_2', name: 'valoracion_2_2', type: 'STRING' },
  { id: 'valoracion_3_1', name: 'valoracion_3_1', type: 'STRING' },
  { id: 'valoracion_3_2', name: 'valoracion_3_2', type: 'STRING' },
  { id: 'valoracion_4_1_formadores', name: 'valoracion_4_1_formadores', type: 'STRING' },
  { id: 'valoracion_4_1_tutores', name: 'valoracion_4_1_tutores', type: 'STRING' },
  { id: 'valoracion_4_2_formadores', name: 'valoracion_4_2_formadores', type: 'STRING' },
  { id: 'valoracion_4_2_tutores', name: 'valoracion_4_2_tutores', type: 'STRING' },
  { id: 'valoracion_5_1', name: 'valoracion_5_1', type: 'STRING' },
  { id: 'valoracion_5_2', name: 'valoracion_5_2', type: 'STRING' },
  { id: 'valoracion_6_1', name: 'valoracion_6_1', type: 'STRING' },
  { id: 'valoracion_6_2', name: 'valoracion_6_2', type: 'STRING' },
  { id: 'valoracion_7_1', name: 'valoracion_7_1', type: 'STRING' },
  { id: 'valoracion_7_2', name: 'valoracion_7_2', type: 'STRING' },
  { id: 'valoracion_8_1', name: 'valoracion_8_1', type: 'STRING' },
  { id: 'valoracion_8_2', name: 'valoracion_8_2', type: 'STRING' },
  { id: 'valoracion_9_1', name: 'valoracion_9_1', type: 'STRING' },
  { id: 'valoracion_9_2', name: 'valoracion_9_2', type: 'STRING' },
  { id: 'valoracion_9_3', name: 'valoracion_9_3', type: 'STRING' },
  { id: 'valoracion_9_4', name: 'valoracion_9_4', type: 'STRING' },
  { id: 'valoracion_9_5', name: 'valoracion_9_5', type: 'STRING' },
  { id: 'valoracion_10', name: 'valoracion_10', type: 'STRING' },
  { id: 'recomendaria_curso', name: 'recomendaria_curso', type: 'STRING' },
  { id: 'sugerencias', name: 'sugerencias', type: 'STRING' },
  { id: 'fecha_cumplimentacion', name: 'fecha_cumplimentacion', type: 'STRING' },
  { id: 'registro_entrada', name: 'registro_entrada', type: 'STRING' },
];

// Campos críticos que DEBEN existir (peso alto)
const CRITICAL_FIELDS = [
  'numero_expediente',
  'numero_accion',
  'numero_grupo',
  'cif_empresa',
  'denominacion_aaff'
];

// Campos importantes (peso medio)
const IMPORTANT_FIELDS = [
  'modalidad',
  'edad',
  'sexo',
  'lugar_trabajo',
  'categoria_profesional',
  'fecha_cumplimentacion'
];

// Pesos de penalización
const WEIGHTS = {
  MISSING_CRITICAL: 0.15,    // -15% por cada campo crítico faltante
  MISSING_IMPORTANT: 0.05,   // -5% por cada campo importante faltante
  MISSING_OTHER: 0.01,       // -1% por cada otro campo faltante
  INVALID_FORMAT: 0.03,      // -3% por cada campo con formato inválido
  EMPTY_VALORACION: 0.02,    // -2% por cada valoración vacía
  INCONSISTENCY: 0.05        // -5% por cada inconsistencia detectada
};

// Patrones de validación de formato
const FORMAT_VALIDATORS: { [key: string]: (value: any) => boolean } = {
  // CIF: Letra + 8 dígitos o 8 dígitos + letra
  cif_empresa: (v) => {
    if (!v) return false;
    const str = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z]\d{8}$/.test(str) || /^\d{8}[A-Z]$/.test(str);
  },

  // Expediente: Patrón F24XXXX o similar
  numero_expediente: (v) => {
    if (!v) return false;
    return /^[A-Z]\d{2,}/.test(String(v).toUpperCase());
  },

  // Número de acción: 1-4 dígitos
  numero_accion: (v) => {
    if (!v) return false;
    const num = String(v).replace(/[^\d]/g, '');
    return num.length >= 1 && num.length <= 4;
  },

  // Número de grupo: 1-4 dígitos
  numero_grupo: (v) => {
    if (!v) return false;
    const num = String(v).replace(/[^\d]/g, '');
    return num.length >= 1 && num.length <= 4;
  },

  // Edad: número entre 16 y 99
  edad: (v) => {
    if (v === null || v === undefined) return true; // Puede estar vacío
    const num = parseInt(String(v));
    return !isNaN(num) && num >= 16 && num <= 99;
  },

  // Sexo: 1, 2 o 9
  sexo: (v) => {
    if (!v) return true;
    const str = String(v);
    return ['1', '2', '9', 'Mujer', 'Varón', 'Hombre', 'No contesta'].includes(str);
  },

  // Modalidad
  modalidad: (v) => {
    if (!v) return true;
    const str = String(v).toLowerCase();
    return str.includes('presencial') || str.includes('teleformación') ||
           str.includes('teleformacion') || str.includes('mixta');
  },

  // Fecha: DD/MM/YYYY
  fecha_cumplimentacion: (v) => {
    if (!v) return true;
    const str = String(v);
    // Acepta DD/MM/YYYY o YYYY-MM-DD
    return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str) || /^\d{4}-\d{2}-\d{2}$/.test(str);
  }
};

// Validador de valoraciones (1-4)
const isValidValoracion = (value: any): boolean => {
  if (value === null || value === undefined || value === '') return false;
  const num = parseInt(String(value));
  return !isNaN(num) && num >= 1 && num <= 4;
};

// Validador de códigos de categoría (1-6 o 9)
const isValidCategoryCode = (value: any): boolean => {
  if (value === null || value === undefined || value === '') return true;
  const str = String(value);
  return ['1', '2', '3', '4', '5', '6', '9'].includes(str);
};

export interface ConfidenceResult {
  score: number;                    // 0.00 - 1.00
  percentage: number;               // 0 - 100
  level: 'high' | 'medium' | 'low'; // Nivel de confianza
  details: {
    totalExpectedFields: number;
    extractedFields: number;
    missingCritical: string[];
    missingImportant: string[];
    invalidFormats: string[];
    emptyValoraciones: string[];
    inconsistencies: string[];
  };
  recommendation: string;
}

/**
 * Calcula el score de confianza real para una extracción FUNDAE
 */
export function calculateConfidenceScore(extractedData: any): ConfidenceResult {
  const details = {
    totalExpectedFields: FUNDAE_SCHEMA.length,
    extractedFields: 0,
    missingCritical: [] as string[],
    missingImportant: [] as string[],
    invalidFormats: [] as string[],
    emptyValoraciones: [] as string[],
    inconsistencies: [] as string[]
  };

  let penaltyScore = 0;

  // 1. Verificar campos críticos
  for (const field of CRITICAL_FIELDS) {
    const value = extractedData[field];
    if (!value || value === '' || value === null) {
      details.missingCritical.push(field);
      penaltyScore += WEIGHTS.MISSING_CRITICAL;
    } else {
      details.extractedFields++;

      // Validar formato si tiene validador
      if (FORMAT_VALIDATORS[field] && !FORMAT_VALIDATORS[field](value)) {
        details.invalidFormats.push(`${field}: "${value}"`);
        penaltyScore += WEIGHTS.INVALID_FORMAT;
      }
    }
  }

  // 2. Verificar campos importantes
  for (const field of IMPORTANT_FIELDS) {
    const value = extractedData[field];
    if (!value || value === '' || value === null) {
      details.missingImportant.push(field);
      penaltyScore += WEIGHTS.MISSING_IMPORTANT;
    } else {
      details.extractedFields++;

      // Validar formato si tiene validador
      if (FORMAT_VALIDATORS[field] && !FORMAT_VALIDATORS[field](value)) {
        details.invalidFormats.push(`${field}: "${value}"`);
        penaltyScore += WEIGHTS.INVALID_FORMAT;
      }
    }
  }

  // 3. Verificar valoraciones (1-4)
  const valoracionFields = FUNDAE_SCHEMA.filter(f =>
    f.name.startsWith('valoracion_') && f.type === 'NUMBER'
  );

  for (const field of valoracionFields) {
    const value = extractedData[field.name];
    if (!isValidValoracion(value)) {
      details.emptyValoraciones.push(field.name);
      penaltyScore += WEIGHTS.EMPTY_VALORACION;
    } else {
      details.extractedFields++;
    }
  }

  // 4. Verificar códigos de categoría
  const categoryFields = ['categoria_profesional', 'horario_curso', 'porcentaje_jornada', 'tamano_empresa'];
  for (const field of categoryFields) {
    const value = extractedData[field];
    if (value && !isValidCategoryCode(value)) {
      details.invalidFormats.push(`${field}: "${value}" (esperado 1-6 o 9)`);
      penaltyScore += WEIGHTS.INVALID_FORMAT;
    }
  }

  // 5. Verificar consistencias
  // 5a. Si modalidad es Presencial, valoraciones 7.x deberían estar vacías o ser N/A
  const modalidad = String(extractedData.modalidad || '').toLowerCase();
  if (modalidad.includes('presencial') && !modalidad.includes('mixta')) {
    const v7_1 = extractedData.valoracion_7_1;
    const v7_2 = extractedData.valoracion_7_2;
    if (isValidValoracion(v7_1) || isValidValoracion(v7_2)) {
      details.inconsistencies.push('Modalidad Presencial pero valoraciones 7.x tienen valores (solo aplican para Teleformación/Mixta)');
      penaltyScore += WEIGHTS.INCONSISTENCY;
    }
  }

  // 5b. Si hay valoraciones tutores, debería haber modalidad Teleformación/Mixta
  const hasTutorValues = isValidValoracion(extractedData.valoracion_4_1_tutores) ||
                         isValidValoracion(extractedData.valoracion_4_2_tutores);
  if (hasTutorValues && modalidad.includes('presencial') && !modalidad.includes('mixta') && !modalidad.includes('tele')) {
    details.inconsistencies.push('Valores de tutores presentes pero modalidad no incluye Teleformación');
    penaltyScore += WEIGHTS.INCONSISTENCY;
  }

  // 6. Contar otros campos extraídos
  const allFieldNames = FUNDAE_SCHEMA.map(f => f.name);
  const checkedFields = [...CRITICAL_FIELDS, ...IMPORTANT_FIELDS, ...valoracionFields.map(f => f.name)];
  const otherFields = allFieldNames.filter(f => !checkedFields.includes(f));

  for (const field of otherFields) {
    const value = extractedData[field];
    if (value && value !== '' && value !== null) {
      details.extractedFields++;
    }
  }

  // Calcular score final (máximo 1.0, mínimo 0.0)
  const rawScore = Math.max(0, 1 - penaltyScore);
  const score = Math.round(rawScore * 100) / 100; // Redondear a 2 decimales

  // Determinar nivel
  let level: 'high' | 'medium' | 'low';
  let recommendation: string;

  if (score >= 0.85) {
    level = 'high';
    recommendation = 'Extracción fiable. Verificar solo campos marcados como dudosos.';
  } else if (score >= 0.65) {
    level = 'medium';
    recommendation = 'Extracción parcialmente fiable. Revisar campos críticos e importantes.';
  } else {
    level = 'low';
    recommendation = 'Extracción poco fiable. Se recomienda revisión manual completa.';
  }

  // Añadir detalles a la recomendación
  if (details.missingCritical.length > 0) {
    recommendation += ` Faltan campos críticos: ${details.missingCritical.join(', ')}.`;
  }

  return {
    score,
    percentage: Math.round(score * 100),
    level,
    details,
    recommendation
  };
}

/**
 * Versión simplificada que solo devuelve el score numérico (0-1)
 */
export function getConfidenceScore(extractedData: any): number {
  return calculateConfidenceScore(extractedData).score;
}

/**
 * Calcula confianza basada en resultados del CV Judge (análisis de píxeles).
 * Complementa la confianza general con datos deterministas de checkboxes.
 */
export function calculateHybridConfidence(
  extractedData: any,
  checkboxResults?: Record<string, {
    value: any;
    state: string; // 'CV_HIGH_CONFIDENCE' | 'CV_AMBIGUOUS' | 'GEMINI_FALLBACK'
    confidence: number;
    needsHumanReview: boolean;
  }>
): ConfidenceResult {
  // Base: confianza estándar
  const baseResult = calculateConfidenceScore(extractedData);

  if (!checkboxResults || Object.keys(checkboxResults).length === 0) {
    return baseResult;
  }

  // Ajustar score con datos del CV Judge
  const totalCVFields = Object.keys(checkboxResults).length;
  const highConfidence = Object.values(checkboxResults)
    .filter(r => r.state === 'CV_HIGH_CONFIDENCE').length;
  const ambiguous = Object.values(checkboxResults)
    .filter(r => r.state === 'CV_AMBIGUOUS').length;
  const fallback = Object.values(checkboxResults)
    .filter(r => r.state === 'GEMINI_FALLBACK').length;

  // CV Judge ratio (determinista = más fiable)
  const cvRatio = highConfidence / totalCVFields;

  // Penalizar por campos ambiguos y fallbacks
  const cvPenalty = (ambiguous * 0.03) + (fallback * 0.02);

  // Combinar: 60% CV Judge + 40% score estándar
  const hybridScore = Math.max(0, Math.min(1,
    (cvRatio * 0.6) + (baseResult.score * 0.4) - cvPenalty
  ));

  const roundedScore = Math.round(hybridScore * 100) / 100;

  let level: 'high' | 'medium' | 'low';
  let recommendation: string;

  if (roundedScore >= 0.85) {
    level = 'high';
    recommendation = 'Extracción híbrida fiable. CV Judge determinista en checkboxes.';
  } else if (roundedScore >= 0.65) {
    level = 'medium';
    recommendation = 'Extracción parcialmente fiable. Revisar campos ambiguos del CV Judge.';
  } else {
    level = 'low';
    recommendation = 'Extracción poco fiable. Revisión manual recomendada.';
  }

  if (ambiguous > 0) {
    recommendation += ` ${ambiguous} campo(s) con lectura ambigua de checkbox.`;
  }

  return {
    score: roundedScore,
    percentage: Math.round(roundedScore * 100),
    level,
    details: {
      ...baseResult.details,
      // Enrich with CV Judge info via inconsistencies
      inconsistencies: [
        ...baseResult.details.inconsistencies,
        ...(ambiguous > 0 ? [`CV Judge: ${ambiguous} checkbox(es) con densidad ambigua (3-12%)`] : []),
        ...(fallback > 0 ? [`CV Judge: ${fallback} campo(s) usaron Gemini como fallback`] : []),
      ],
    },
    recommendation,
  };
}

export default {
  calculateConfidenceScore,
  getConfidenceScore,
  calculateHybridConfidence,
};
