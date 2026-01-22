/**
 * validationRules.ts
 *
 * Reglas de validación para formularios FUNDAE
 *
 * Incluye validadores para:
 * - Identificadores: CIF, DNI, NIE
 * - Fechas: formato, rangos, coherencia
 * - Números: códigos postales, teléfonos
 * - Campos específicos FUNDAE
 */

export interface ValidationResult {
  isValid: boolean;
  errorType?: string;
  errorMessage?: string;
  expectedFormat?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================================================
// VALIDADORES DE IDENTIFICADORES
// ============================================================================

/**
 * Valida formato y dígito de control de CIF español
 * Formato: Letra + 8 dígitos (ej: B12345678)
 * La letra indica el tipo de organización
 */
export function validateCIF(cif: string | null | undefined): ValidationResult {
  if (!cif) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'CIF es obligatorio',
      severity: 'critical'
    };
  }

  // Limpiar espacios
  const cleanCIF = cif.trim().toUpperCase();

  // Formato: Letra + 7 dígitos + dígito/letra control
  const regex = /^[A-Z]\d{7}[A-Z0-9]$/;

  if (!regex.test(cleanCIF)) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: 'Formato de CIF incorrecto',
      expectedFormat: 'Letra + 7 dígitos + dígito control (ej: B12345678)',
      severity: 'critical'
    };
  }

  // Validar letra inicial (tipos válidos de organización)
  const firstLetter = cleanCIF[0];
  const validFirstLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'N', 'P', 'Q', 'R', 'S', 'U', 'V', 'W'];

  if (!validFirstLetters.includes(firstLetter)) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: `CIF con letra inicial inválida: ${firstLetter}`,
      expectedFormat: 'Letras válidas: A, B, C, D, E, F, G, H, J, N, P, Q, R, S, U, V, W',
      severity: 'high'
    };
  }

  // Validar dígito de control
  const digits = cleanCIF.substring(1, 8);
  const controlChar = cleanCIF[8];

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(digits[i]);
    if (i % 2 === 0) {
      // Posiciones pares: multiplicar por 2 y sumar dígitos
      const doubled = digit * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      // Posiciones impares: sumar directamente
      sum += digit;
    }
  }

  const unitDigit = sum % 10;
  const controlDigit = unitDigit === 0 ? 0 : 10 - unitDigit;
  const controlLetter = 'JABCDEFGHI'[controlDigit];

  // Algunos CIFs usan letra, otros número
  const isValidControl = controlChar === String(controlDigit) || controlChar === controlLetter;

  if (!isValidControl) {
    return {
      isValid: false,
      errorType: 'invalid_control_digit',
      errorMessage: `Dígito de control incorrecto. Esperado: ${controlDigit} o ${controlLetter}`,
      severity: 'high'
    };
  }

  return { isValid: true };
}

/**
 * Valida formato y letra de DNI español
 * Formato: 8 dígitos + letra (ej: 12345678Z)
 */
export function validateDNI(dni: string | null | undefined): ValidationResult {
  if (!dni) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'DNI es obligatorio',
      severity: 'critical'
    };
  }

  // Limpiar espacios y guiones
  const cleanDNI = dni.trim().toUpperCase().replace(/[-\s]/g, '');

  // Formato: 8 dígitos + letra
  const regex = /^(\d{8})([A-Z])$/;
  const match = cleanDNI.match(regex);

  if (!match) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: 'Formato de DNI incorrecto',
      expectedFormat: '8 dígitos + letra (ej: 12345678Z)',
      severity: 'critical'
    };
  }

  const numbers = match[1];
  const letter = match[2];

  // Calcular letra correcta
  const validLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const expectedLetter = validLetters[parseInt(numbers) % 23];

  if (letter !== expectedLetter) {
    return {
      isValid: false,
      errorType: 'invalid_letter',
      errorMessage: `Letra de DNI incorrecta. Esperada: ${expectedLetter}`,
      severity: 'critical'
    };
  }

  return { isValid: true };
}

/**
 * Valida formato y letra de NIE (extranjeros)
 * Formato: X/Y/Z + 7 dígitos + letra (ej: X1234567L)
 */
export function validateNIE(nie: string | null | undefined): ValidationResult {
  if (!nie) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'NIE es obligatorio',
      severity: 'critical'
    };
  }

  // Limpiar espacios y guiones
  const cleanNIE = nie.trim().toUpperCase().replace(/[-\s]/g, '');

  // Formato: X/Y/Z + 7 dígitos + letra
  const regex = /^([XYZ])(\d{7})([A-Z])$/;
  const match = cleanNIE.match(regex);

  if (!match) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: 'Formato de NIE incorrecto',
      expectedFormat: 'X/Y/Z + 7 dígitos + letra (ej: X1234567L)',
      severity: 'critical'
    };
  }

  const firstLetter = match[1];
  const numbers = match[2];
  const letter = match[3];

  // Convertir primera letra a número para cálculo
  const prefixMap: Record<string, string> = { 'X': '0', 'Y': '1', 'Z': '2' };
  const fullNumber = prefixMap[firstLetter] + numbers;

  // Calcular letra correcta
  const validLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const expectedLetter = validLetters[parseInt(fullNumber) % 23];

  if (letter !== expectedLetter) {
    return {
      isValid: false,
      errorType: 'invalid_letter',
      errorMessage: `Letra de NIE incorrecta. Esperada: ${expectedLetter}`,
      severity: 'critical'
    };
  }

  return { isValid: true };
}

/**
 * Detecta automáticamente el tipo de identificador y valida
 */
export function validateSpanishID(id: string | null | undefined): ValidationResult {
  if (!id) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'Identificador es obligatorio',
      severity: 'critical'
    };
  }

  const cleanID = id.trim().toUpperCase().replace(/[-\s]/g, '');

  // Detectar tipo
  if (/^[XYZ]/.test(cleanID)) {
    // NIE
    return validateNIE(id);
  } else if (/^\d{8}[A-Z]$/.test(cleanID)) {
    // DNI
    return validateDNI(id);
  } else if (/^[A-Z]\d{7}[A-Z0-9]$/.test(cleanID)) {
    // CIF
    return validateCIF(id);
  } else {
    return {
      isValid: false,
      errorType: 'unknown_format',
      errorMessage: 'No se pudo identificar el tipo de documento (DNI/NIE/CIF)',
      expectedFormat: 'DNI: 12345678Z, NIE: X1234567L, CIF: B12345678',
      severity: 'critical'
    };
  }
}

// ============================================================================
// VALIDADORES DE FECHAS
// ============================================================================

/**
 * Valida formato de fecha DD/MM/YYYY
 */
export function validateDateFormat(date: string | null | undefined): ValidationResult {
  if (!date) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'Fecha es obligatoria',
      severity: 'critical'
    };
  }

  const cleanDate = date.trim();

  // Formatos aceptados: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const regex = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/;
  const match = cleanDate.match(regex);

  if (!match) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: 'Formato de fecha incorrecto',
      expectedFormat: 'DD/MM/YYYY (ej: 15/03/2024)',
      severity: 'high'
    };
  }

  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);

  // Validar rangos
  if (month < 1 || month > 12) {
    return {
      isValid: false,
      errorType: 'invalid_month',
      errorMessage: `Mes inválido: ${month}`,
      expectedFormat: 'Mes debe estar entre 01 y 12',
      severity: 'high'
    };
  }

  if (day < 1 || day > 31) {
    return {
      isValid: false,
      errorType: 'invalid_day',
      errorMessage: `Día inválido: ${day}`,
      expectedFormat: 'Día debe estar entre 01 y 31',
      severity: 'high'
    };
  }

  // Validar días por mes
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Año bisiesto
  if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
    daysInMonth[1] = 29;
  }

  if (day > daysInMonth[month - 1]) {
    return {
      isValid: false,
      errorType: 'invalid_day_for_month',
      errorMessage: `El mes ${month} no tiene ${day} días`,
      severity: 'high'
    };
  }

  // Validar año razonable (entre 1900 y 2100)
  if (year < 1900 || year > 2100) {
    return {
      isValid: false,
      errorType: 'invalid_year',
      errorMessage: `Año fuera de rango: ${year}`,
      expectedFormat: 'Año debe estar entre 1900 y 2100',
      severity: 'medium'
    };
  }

  return { isValid: true };
}

/**
 * Valida que la fecha no sea futura
 */
export function validateNotFutureDate(date: string | null | undefined): ValidationResult {
  const formatValidation = validateDateFormat(date);
  if (!formatValidation.isValid) {
    return formatValidation;
  }

  // Parse fecha
  const regex = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/;
  const match = date!.trim().match(regex)!;
  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);

  const inputDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inputDate > today) {
    return {
      isValid: false,
      errorType: 'future_date',
      errorMessage: 'La fecha no puede ser futura',
      severity: 'high'
    };
  }

  return { isValid: true };
}

/**
 * Valida rango de edad (para fechas de nacimiento)
 */
export function validateAge(birthDate: string | null | undefined, minAge: number = 16, maxAge: number = 67): ValidationResult {
  const formatValidation = validateDateFormat(birthDate);
  if (!formatValidation.isValid) {
    return formatValidation;
  }

  // Parse fecha
  const regex = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/;
  const match = birthDate!.trim().match(regex)!;
  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);

  const birth = new Date(year, month - 1, day);
  const today = new Date();

  // Calcular edad
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < minAge) {
    return {
      isValid: false,
      errorType: 'age_too_young',
      errorMessage: `Edad insuficiente: ${age} años (mínimo ${minAge})`,
      severity: 'critical'
    };
  }

  if (age > maxAge) {
    return {
      isValid: false,
      errorType: 'age_too_old',
      errorMessage: `Edad fuera de rango: ${age} años (máximo ${maxAge})`,
      severity: 'medium'
    };
  }

  return { isValid: true };
}

/**
 * Valida que fecha de fin sea posterior a fecha de inicio
 */
export function validateDateRange(startDate: string | null | undefined, endDate: string | null | undefined): ValidationResult {
  const startValidation = validateDateFormat(startDate);
  if (!startValidation.isValid) {
    return startValidation;
  }

  const endValidation = validateDateFormat(endDate);
  if (!endValidation.isValid) {
    return endValidation;
  }

  // Parse fechas
  const parseDate = (dateStr: string) => {
    const regex = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/;
    const match = dateStr.trim().match(regex)!;
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    return new Date(year, month - 1, day);
  };

  const start = parseDate(startDate!);
  const end = parseDate(endDate!);

  if (end < start) {
    return {
      isValid: false,
      errorType: 'invalid_date_range',
      errorMessage: 'La fecha de fin debe ser posterior a la fecha de inicio',
      severity: 'high'
    };
  }

  return { isValid: true };
}

// ============================================================================
// VALIDADORES NUMÉRICOS
// ============================================================================

/**
 * Valida código postal español (5 dígitos)
 */
export function validatePostalCode(cp: string | null | undefined): ValidationResult {
  if (!cp) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'Código postal es obligatorio',
      severity: 'high'
    };
  }

  const cleanCP = cp.trim();

  // Formato: 5 dígitos
  const regex = /^\d{5}$/;

  if (!regex.test(cleanCP)) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: 'Formato de código postal incorrecto',
      expectedFormat: '5 dígitos (ej: 28001)',
      severity: 'high'
    };
  }

  // Validar rango de provincias (01-52)
  const province = parseInt(cleanCP.substring(0, 2));

  if (province < 1 || province > 52) {
    return {
      isValid: false,
      errorType: 'invalid_province',
      errorMessage: `Código de provincia inválido: ${province}`,
      expectedFormat: 'Primeros 2 dígitos deben estar entre 01 y 52',
      severity: 'medium'
    };
  }

  return { isValid: true };
}

/**
 * Valida teléfono español (9 dígitos)
 */
export function validateSpanishPhone(phone: string | null | undefined): ValidationResult {
  if (!phone) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'Teléfono es obligatorio',
      severity: 'medium'
    };
  }

  // Limpiar espacios, guiones, paréntesis
  const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');

  // Formato: 9 dígitos, empezando por 6, 7, 8 o 9
  const regex = /^[6-9]\d{8}$/;

  if (!regex.test(cleanPhone)) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: 'Formato de teléfono incorrecto',
      expectedFormat: '9 dígitos empezando por 6, 7, 8 o 9 (ej: 612345678)',
      severity: 'medium'
    };
  }

  return { isValid: true };
}

/**
 * Valida que un valor sea numérico y esté en un rango
 */
export function validateNumericRange(value: string | number | null | undefined, min: number, max: number, fieldName: string): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: `${fieldName} es obligatorio`,
      severity: 'high'
    };
  }

  const numValue = typeof value === 'number' ? value : parseFloat(String(value).trim());

  if (isNaN(numValue)) {
    return {
      isValid: false,
      errorType: 'not_numeric',
      errorMessage: `${fieldName} debe ser un número`,
      severity: 'high'
    };
  }

  if (numValue < min || numValue > max) {
    return {
      isValid: false,
      errorType: 'out_of_range',
      errorMessage: `${fieldName} fuera de rango: ${numValue} (debe estar entre ${min} y ${max})`,
      severity: 'medium'
    };
  }

  return { isValid: true };
}

// ============================================================================
// VALIDADORES ESPECIALES FUNDAE
// ============================================================================

/**
 * Detecta múltiples respuestas (cuando Gemini devuelve array o valores separados)
 */
export function validateSingleResponse(value: any): ValidationResult {
  // Si es array con más de un elemento
  if (Array.isArray(value) && value.length > 1) {
    return {
      isValid: false,
      errorType: 'multiple_responses',
      errorMessage: `Se detectaron ${value.length} respuestas. Debe haber solo una. Marcar como "NC"`,
      severity: 'critical'
    };
  }

  // Si es string con separadores (/ , ; |)
  if (typeof value === 'string') {
    const separators = ['/', ',', ';', '|'];
    for (const sep of separators) {
      if (value.includes(sep)) {
        const parts = value.split(sep).filter(p => p.trim().length > 0);
        if (parts.length > 1) {
          return {
            isValid: false,
            errorType: 'multiple_responses',
            errorMessage: `Se detectaron múltiples valores separados por "${sep}". Debe haber solo uno. Marcar como "NC"`,
            severity: 'critical'
          };
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * Valida que un campo no esté vacío
 */
export function validateRequired(value: any, fieldName: string): ValidationResult {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: `${fieldName} es obligatorio`,
      severity: 'critical'
    };
  }

  return { isValid: true };
}

/**
 * Valida email
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email) {
    return {
      isValid: false,
      errorType: 'missing_value',
      errorMessage: 'Email es obligatorio',
      severity: 'medium'
    };
  }

  const cleanEmail = email.trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regex.test(cleanEmail)) {
    return {
      isValid: false,
      errorType: 'invalid_format',
      errorMessage: 'Formato de email incorrecto',
      expectedFormat: 'ejemplo@dominio.com',
      severity: 'medium'
    };
  }

  return { isValid: true };
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Normaliza un string (trim, uppercase, sin acentos)
 */
export function normalizeString(str: string): string {
  return str
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remover acentos
}

/**
 * Detecta si un valor es "No Consta" (NC)
 */
export function isNC(value: any): boolean {
  if (!value) return false;

  const strValue = String(value).trim().toUpperCase();
  const ncVariants = ['NC', 'N/C', 'N.C.', 'NO CONSTA', 'NO APLICA', 'N/A', 'NA'];

  return ncVariants.includes(strValue);
}
