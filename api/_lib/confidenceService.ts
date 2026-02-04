/**
 * SERVICIO DE CÁLCULO DE CONFIANZA - MODO GENÉRICO
 * api/_lib/confidenceService.ts
 *
 * Calcula un score de confianza basado en:
 * 1. Cantidad de campos extraídos
 * 2. Campos no vacíos
 * 3. Validez de formatos comunes (CIF, email, fechas)
 */

// Patrones de validación de formato genéricos
const FORMAT_VALIDATORS: { [key: string]: (value: any) => boolean } = {
  // CIF/NIF español
  cif: (v) => {
    if (!v) return false;
    const str = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z]\d{8}$/.test(str) || /^\d{8}[A-Z]$/.test(str);
  },
  cif_empresa: (v) => FORMAT_VALIDATORS.cif(v),
  nif: (v) => FORMAT_VALIDATORS.cif(v),

  // Email
  email: (v) => {
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));
  },

  // Teléfono español
  telefono: (v) => {
    if (!v) return false;
    const str = String(v).replace(/[^0-9]/g, '');
    return /^[6789]\d{8}$/.test(str);
  },

  // Fecha (varios formatos)
  fecha: (v) => {
    if (!v) return false;
    const str = String(v);
    return /^\d{2}\/\d{2}\/\d{4}$/.test(str) || /^\d{4}-\d{2}-\d{2}$/.test(str);
  },

  // Código postal español
  codigo_postal: (v) => {
    if (!v) return false;
    return /^\d{5}$/.test(String(v));
  }
};

export interface ConfidenceResult {
  score: number;           // 0-1
  level: 'high' | 'medium' | 'low';
  details: {
    totalFields: number;
    nonEmptyFields: number;
    validFormats: string[];
    invalidFormats: string[];
    missingCritical: string[];
  };
  recommendation: string;
}

/**
 * Calcula el score de confianza de una extracción
 * MODO GENÉRICO: Sin validación de campos FUNDAE específicos
 */
export function calculateConfidenceScore(extractedData: Record<string, any>): ConfidenceResult {
  // Ignorar campos internos que empiezan con _
  const fields = Object.keys(extractedData).filter(k => !k.startsWith('_'));
  const totalFields = fields.length;

  // Contar campos no vacíos
  const nonEmptyFields = fields.filter(field => {
    const value = extractedData[field];
    return value !== null && value !== undefined && value !== '' && value !== 'NC';
  }).length;

  // Validar formatos conocidos
  const validFormats: string[] = [];
  const invalidFormats: string[] = [];

  for (const field of fields) {
    // Buscar validador por nombre de campo o parte del nombre
    let validator: ((v: any) => boolean) | undefined;

    if (FORMAT_VALIDATORS[field]) {
      validator = FORMAT_VALIDATORS[field];
    } else {
      // Buscar por coincidencia parcial
      for (const [pattern, fn] of Object.entries(FORMAT_VALIDATORS)) {
        if (field.toLowerCase().includes(pattern.toLowerCase())) {
          validator = fn;
          break;
        }
      }
    }

    if (validator) {
      const value = extractedData[field];
      if (value && value !== '' && value !== 'NC') {
        if (validator(value)) {
          validFormats.push(field);
        } else {
          invalidFormats.push(field);
        }
      }
    }
  }

  // Calcular score base
  let score = 0.5; // Score base

  // +40% si hay campos extraídos
  if (totalFields > 0) {
    const fillRate = nonEmptyFields / totalFields;
    score += fillRate * 0.4;
  }

  // +10% si los formatos son válidos
  const totalFormatsChecked = validFormats.length + invalidFormats.length;
  if (totalFormatsChecked > 0) {
    const formatValidRate = validFormats.length / totalFormatsChecked;
    score += formatValidRate * 0.1;
  }

  // Penalizar formatos inválidos
  score -= invalidFormats.length * 0.02;

  // Asegurar rango 0-1
  score = Math.max(0, Math.min(1, score));

  // Determinar nivel
  let level: 'high' | 'medium' | 'low';
  let recommendation: string;

  if (score >= 0.85) {
    level = 'high';
    recommendation = 'Extracción confiable - verificación opcional';
  } else if (score >= 0.65) {
    level = 'medium';
    recommendation = 'Verificar campos importantes antes de aprobar';
  } else {
    level = 'low';
    recommendation = 'Revisar documento completo - baja confianza';
  }

  return {
    score: Math.round(score * 100) / 100,
    level,
    details: {
      totalFields,
      nonEmptyFields,
      validFormats,
      invalidFormats,
      missingCritical: [] // No hay campos críticos en modo genérico
    },
    recommendation
  };
}

export default {
  calculateConfidenceScore
};
