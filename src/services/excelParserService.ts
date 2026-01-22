/**
 * Servicio para parsear archivos Excel
 *
 * Convierte hojas de Excel en datos estructurados JSON
 * para validación cruzada con extracciones de IA
 */

import * as XLSX from 'xlsx';

// ============================================================================
// TIPOS
// ============================================================================

export interface ParsedExcelRow {
  formIdentifier: string;
  fields: Record<string, any>;
  rowNumber: number;
}

export interface ExcelParseResult {
  success: boolean;
  data?: ParsedExcelRow[];
  error?: string;
  metadata?: {
    filename: string;
    sheetName: string;
    totalRows: number;
    columnsFound: string[];
  };
}

// ============================================================================
// CONFIGURACIÓN DE CAMPOS
// ============================================================================

/**
 * Mapeo de columnas del Excel a campos internos
 *
 * El Excel del cliente puede tener nombres de columnas en español
 * Los mapeamos a nombres internos consistentes
 */
const FIELD_MAPPINGS: Record<string, string> = {
  // Identificadores
  'numero_expediente': 'numero_expediente',
  'expediente': 'numero_expediente',
  'nº expediente': 'numero_expediente',
  'num expediente': 'numero_expediente',
  'd_expediente': 'numero_expediente',  // FUNDAE format

  // NIF/CIF
  'nif': 'nif_empresa',
  'cif': 'nif_empresa',
  'nif/cif': 'nif_empresa',
  'nif empresa': 'nif_empresa',
  'd_cif': 'nif_empresa',  // FUNDAE format
  'cif.y': 'nif_empresa',  // FUNDAE alternative

  // Razón social
  'razon_social': 'razon_social',
  'razon social': 'razon_social',
  'empresa': 'razon_social',
  'nombre empresa': 'razon_social',
  'd_razon_social': 'razon_social',  // FUNDAE format

  // Importes
  'importe': 'importe_total',
  'importe_total': 'importe_total',
  'importe total': 'importe_total',
  'coste': 'importe_total',

  // Participantes
  'participantes': 'numero_participantes',
  'num_participantes': 'numero_participantes',
  'nº participantes': 'numero_participantes',
  'numero participantes': 'numero_participantes',

  // Fechas
  'fecha_inicio': 'fecha_inicio',
  'fecha inicio': 'fecha_inicio',
  'inicio': 'fecha_inicio',

  'fecha_fin': 'fecha_fin',
  'fecha fin': 'fecha_fin',
  'fin': 'fecha_fin',

  // Otros campos comunes
  'modalidad': 'modalidad',
  'tipo_formacion': 'tipo_formacion',
  'tipo formacion': 'tipo_formacion',
  'horas': 'horas_formacion',
  'duracion': 'horas_formacion',
  'n_horas': 'horas_formacion',  // FUNDAE format
  'n_formados': 'numero_participantes',  // FUNDAE format
  'd_accion_formativa': 'accion_formativa',  // FUNDAE format
  'd_estado_grupo': 'estado_grupo',  // FUNDAE format
  'f_fin': 'fecha_fin',  // FUNDAE format
  'cod_grupo': 'codigo_grupo',  // FUNDAE format
  'd_cod_grupo': 'codigo_grupo_detalle',  // FUNDAE format
};

/**
 * Campo que identifica de forma única cada fila
 * (usado para hacer el match con las extracciones)
 */
const IDENTIFIER_FIELDS = ['numero_expediente', 'expediente', 'nº expediente', 'd_expediente'];

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Parsear archivo Excel desde buffer (Node.js) o ArrayBuffer (navegador)
 */
export function parseExcelFromBuffer(
  buffer: Buffer | ArrayBuffer,
  filename: string,
  options?: {
    sheetName?: string;
    startRow?: number;
    identifierField?: string;
  }
): ExcelParseResult {
  try {
    // Detectar si es Buffer o ArrayBuffer y usar el tipo apropiado
    const bufferType = buffer instanceof ArrayBuffer ? 'array' : 'buffer';
    // Leer workbook desde buffer
    const workbook = XLSX.read(buffer, { type: bufferType });

    // Determinar qué hoja usar
    const sheetName = options?.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return {
        success: false,
        error: `Hoja "${sheetName}" no encontrada en el Excel`
      };
    }

    // Convertir hoja a JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Convertir a strings
      defval: null // Valores vacíos como null
    });

    if (rawData.length === 0) {
      return {
        success: false,
        error: 'La hoja de Excel está vacía'
      };
    }

    // Detectar columnas
    const firstRow = rawData[0];
    const columnsFound = Object.keys(firstRow);

    // Normalizar y mapear datos
    const parsedData: ParsedExcelRow[] = [];
    const startRow = options?.startRow || 0;

    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      const normalizedFields = normalizeFields(row);

      // Buscar identificador
      const formIdentifier = extractIdentifier(normalizedFields, options?.identifierField);

      if (!formIdentifier) {
        console.warn(`Fila ${i + 2} sin identificador válido, saltando...`);
        continue;
      }

      parsedData.push({
        formIdentifier,
        fields: normalizedFields,
        rowNumber: i + 2 // +2 porque Excel empieza en 1 y tiene header
      });
    }

    if (parsedData.length === 0) {
      return {
        success: false,
        error: 'No se encontraron filas con identificadores válidos'
      };
    }

    return {
      success: true,
      data: parsedData,
      metadata: {
        filename,
        sheetName,
        totalRows: parsedData.length,
        columnsFound
      }
    };

  } catch (error: any) {
    console.error('Error al parsear Excel:', error);
    return {
      success: false,
      error: `Error al parsear Excel: ${error.message}`
    };
  }
}

/**
 * Parsear archivo Excel desde path (para testing local)
 */
export function parseExcelFromFile(
  filepath: string,
  options?: {
    sheetName?: string;
    startRow?: number;
    identifierField?: string;
  }
): ExcelParseResult {
  try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = options?.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return {
        success: false,
        error: `Hoja "${sheetName}" no encontrada`
      };
    }

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    });

    const columnsFound = Object.keys(rawData[0] || {});
    const parsedData: ParsedExcelRow[] = [];
    const startRow = options?.startRow || 0;

    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      const normalizedFields = normalizeFields(row);
      const formIdentifier = extractIdentifier(normalizedFields, options?.identifierField);

      if (formIdentifier) {
        parsedData.push({
          formIdentifier,
          fields: normalizedFields,
          rowNumber: i + 2
        });
      }
    }

    return {
      success: true,
      data: parsedData,
      metadata: {
        filename: filepath.split('/').pop() || filepath,
        sheetName,
        totalRows: parsedData.length,
        columnsFound
      }
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Error al leer archivo: ${error.message}`
    };
  }
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Normalizar nombres de campos usando el mapping
 */
function normalizeFields(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    // Normalizar nombre de columna
    const normalizedKey = key.toLowerCase().trim();
    const mappedKey = FIELD_MAPPINGS[normalizedKey] || normalizedKey;

    // Normalizar valor
    normalized[mappedKey] = normalizeValue(value);
  }

  return normalized;
}

/**
 * Normalizar valores (limpiar espacios, convertir tipos, etc.)
 */
function normalizeValue(value: any): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Si es string, limpiar
  if (typeof value === 'string') {
    const cleaned = value.trim();

    // Intentar convertir a número si parece número
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
      return parseFloat(cleaned);
    }

    return cleaned;
  }

  return value;
}

/**
 * Extraer identificador único de la fila
 */
function extractIdentifier(
  fields: Record<string, any>,
  customField?: string
): string | null {
  // Si se especificó un campo custom, usarlo
  if (customField && fields[customField]) {
    return String(fields[customField]).trim();
  }

  // Buscar en campos identificadores comunes
  for (const fieldName of IDENTIFIER_FIELDS) {
    if (fields[fieldName]) {
      return String(fields[fieldName]).trim();
    }
  }

  // Buscar por clave exacta "numero_expediente"
  if (fields['numero_expediente']) {
    return String(fields['numero_expediente']).trim();
  }

  return null;
}

/**
 * Validar estructura del Excel antes de procesarlo
 */
export function validateExcelStructure(
  buffer: Buffer | ArrayBuffer,
  requiredColumns?: string[],
  options?: { skipIdentifierCheck?: boolean }
): { valid: boolean; error?: string; columnsFound?: string[] } {
  try {
    // Detectar si es Buffer o ArrayBuffer y usar el tipo apropiado
    const bufferType = buffer instanceof ArrayBuffer ? 'array' : 'buffer';
    const workbook = XLSX.read(buffer, { type: bufferType });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return { valid: false, error: 'No se encontró ninguna hoja en el Excel' };
    }

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rawData.length < 2) {
      return { valid: false, error: 'El Excel debe tener al menos header + 1 fila de datos' };
    }

    const headers = rawData[0] as string[];
    const columnsFound = headers.map(h => String(h).toLowerCase().trim());

    // Verificar que tenga al menos un identificador (omitir si se especifica)
    if (!options?.skipIdentifierCheck) {
      const hasIdentifier = IDENTIFIER_FIELDS.some(id =>
        columnsFound.some(col => col.includes(id.toLowerCase()))
      );

      if (!hasIdentifier) {
        return {
          valid: false,
          error: `El Excel debe tener una columna de identificación (${IDENTIFIER_FIELDS.join(', ')})`,
          columnsFound
        };
      }
    }

    // Verificar columnas requeridas (si se especificaron)
    if (requiredColumns && requiredColumns.length > 0) {
      const missingColumns = requiredColumns.filter(req =>
        !columnsFound.some(col => col.includes(req.toLowerCase()))
      );

      if (missingColumns.length > 0) {
        return {
          valid: false,
          error: `Faltan columnas requeridas: ${missingColumns.join(', ')}`,
          columnsFound
        };
      }
    }

    return { valid: true, columnsFound };

  } catch (error: any) {
    return { valid: false, error: `Error al validar Excel: ${error.message}` };
  }
}

/**
 * Obtener preview de las primeras filas del Excel
 */
export function getExcelPreview(
  buffer: Buffer | ArrayBuffer,
  maxRows: number = 5
): { success: boolean; preview?: any[]; error?: string } {
  try {
    // Detectar si es Buffer o ArrayBuffer y usar el tipo apropiado
    const bufferType = buffer instanceof ArrayBuffer ? 'array' : 'buffer';
    const workbook = XLSX.read(buffer, { type: bufferType });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data: any[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    });

    return {
      success: true,
      preview: data.slice(0, maxRows)
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
