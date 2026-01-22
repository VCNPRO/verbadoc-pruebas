/**
 * SERVICIO DE DOBLE VERIFICACIÓN
 * api/_lib/doubleVerificationService.ts
 *
 * Re-extrae campos CRÍTICOS con un prompt diferente y compara resultados.
 * Si hay discrepancias, marca el documento para revisión humana.
 *
 * Técnica: "Self-Consistency" - Si la IA da la misma respuesta dos veces
 * con prompts diferentes, es más probable que sea correcta.
 */

// Campos críticos que se verificarán dos veces
const CRITICAL_FIELDS_TO_VERIFY = [
  'numero_expediente',
  'numero_accion',
  'numero_grupo',
  'cif_empresa'
];

/**
 * Prompt alternativo para verificación (diferente al principal)
 * Usa un enfoque más directo y minimalista
 */
const VERIFICATION_PROMPT = `VERIFICACIÓN DE DATOS CRÍTICOS - FORMULARIO FUNDAE

Lee el documento y extrae ÚNICAMENTE estos 4 campos. NO INVENTES DATOS.

1. numero_expediente: El código de expediente (formato F24XXXX o similar). Busca en la parte superior.
2. numero_accion: El número de la acción formativa. Un número simple.
3. numero_grupo: El número del grupo. Un número simple.
4. cif_empresa: El CIF/NIF de la empresa. Formato: letra + 8 dígitos.

IMPORTANTE:
- Si un campo NO es visible o legible, devuelve null
- NO adivines, NO completes datos
- Solo extrae lo que puedes leer claramente

Responde SOLO con JSON:
{
  "numero_expediente": "valor o null",
  "numero_accion": "valor o null",
  "numero_grupo": "valor o null",
  "cif_empresa": "valor o null"
}`;

export interface VerificationResult {
  verified: boolean;
  matchingFields: string[];
  discrepantFields: {
    field: string;
    original: any;
    verification: any;
  }[];
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
}

/**
 * Normaliza un valor para comparación
 * - Elimina espacios
 * - Convierte a mayúsculas
 * - Elimina caracteres especiales de números
 */
function normalizeValue(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Compara dos valores de campo (con tolerancia)
 */
function valuesMatch(original: any, verification: any): boolean {
  const normOrig = normalizeValue(original);
  const normVerif = normalizeValue(verification);

  // Ambos vacíos = match
  if (!normOrig && !normVerif) return true;

  // Uno vacío y otro no = no match
  if (!normOrig || !normVerif) return false;

  // Comparación exacta
  if (normOrig === normVerif) return true;

  // Para números de acción/grupo, comparar sin ceros a la izquierda
  const origNum = normOrig.replace(/^0+/, '');
  const verifNum = normVerif.replace(/^0+/, '');
  if (origNum === verifNum && origNum.length > 0) return true;

  // Para expedientes, pueden tener variaciones menores
  if (normOrig.includes(normVerif) || normVerif.includes(normOrig)) return true;

  return false;
}

/**
 * Ejecuta la doble verificación de campos críticos
 * @param originalData - Datos extraídos en la primera pasada
 * @param verificationData - Datos extraídos con el prompt de verificación
 * @returns Resultado de la verificación
 */
export function verifyExtraction(
  originalData: any,
  verificationData: any
): VerificationResult {
  const matchingFields: string[] = [];
  const discrepantFields: { field: string; original: any; verification: any }[] = [];

  for (const field of CRITICAL_FIELDS_TO_VERIFY) {
    const originalValue = originalData[field];
    const verificationValue = verificationData[field];

    if (valuesMatch(originalValue, verificationValue)) {
      matchingFields.push(field);
    } else {
      discrepantFields.push({
        field,
        original: originalValue,
        verification: verificationValue
      });
    }
  }

  // Calcular confianza basada en matches
  const matchRatio = matchingFields.length / CRITICAL_FIELDS_TO_VERIFY.length;
  let confidence: 'high' | 'medium' | 'low';
  let recommendation: string;

  if (matchRatio === 1) {
    confidence = 'high';
    recommendation = 'Todos los campos críticos verificados correctamente.';
  } else if (matchRatio >= 0.75) {
    confidence = 'medium';
    recommendation = `Verificar manualmente: ${discrepantFields.map(d => d.field).join(', ')}`;
  } else {
    confidence = 'low';
    recommendation = 'ATENCIÓN: Múltiples discrepancias detectadas. Revisión manual obligatoria.';
  }

  return {
    verified: discrepantFields.length === 0,
    matchingFields,
    discrepantFields,
    confidence,
    recommendation
  };
}

/**
 * Genera el prompt de verificación para usar con la API
 */
export function getVerificationPrompt(): string {
  return VERIFICATION_PROMPT;
}

/**
 * Obtiene la lista de campos críticos a verificar
 */
export function getCriticalFieldsToVerify(): string[] {
  return [...CRITICAL_FIELDS_TO_VERIFY];
}

/**
 * Combina los resultados de verificación con el original
 * Usa el valor con mayor confianza en caso de discrepancia
 */
export function mergeWithVerification(
  originalData: any,
  verificationData: any,
  verificationResult: VerificationResult
): { mergedData: any; fieldsUpdated: string[] } {
  const mergedData = { ...originalData };
  const fieldsUpdated: string[] = [];

  // Para campos discrepantes, preferir el valor de verificación
  // si el original parece inválido
  for (const discrepancy of verificationResult.discrepantFields) {
    const { field, original, verification } = discrepancy;

    // Si el original está vacío y la verificación tiene valor, usar verificación
    if ((!original || original === '') && verification) {
      mergedData[field] = verification;
      fieldsUpdated.push(field);
      continue;
    }

    // Si la verificación está vacía, mantener original (puede ser válido)
    if (!verification || verification === '') {
      continue;
    }

    // Validaciones específicas por campo
    switch (field) {
      case 'cif_empresa':
        // Preferir el que tenga formato válido de CIF
        const origCifValid = /^[A-Z]\d{8}$/i.test(normalizeValue(original));
        const verifCifValid = /^[A-Z]\d{8}$/i.test(normalizeValue(verification));
        if (!origCifValid && verifCifValid) {
          mergedData[field] = verification;
          fieldsUpdated.push(field);
        }
        break;

      case 'numero_expediente':
        // Preferir el que tenga formato de expediente
        const origExpValid = /^[A-Z]\d{2,}/.test(normalizeValue(original));
        const verifExpValid = /^[A-Z]\d{2,}/.test(normalizeValue(verification));
        if (!origExpValid && verifExpValid) {
          mergedData[field] = verification;
          fieldsUpdated.push(field);
        }
        break;

      default:
        // Para números de acción/grupo, mantener original si es válido
        break;
    }
  }

  return { mergedData, fieldsUpdated };
}

export default {
  verifyExtraction,
  getVerificationPrompt,
  getCriticalFieldsToVerify,
  mergeWithVerification
};
