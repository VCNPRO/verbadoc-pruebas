/**
 * FUNDAE Excel Columns - Definición OFICIAL de las 45 columnas
 *
 * CRÍTICO: Este archivo define las 45 columnas EXACTAS que debe tener
 * el Excel de salida FUNDAE. NO MODIFICAR sin verificar contra el
 * formulario oficial (Orden TAS 2307/2007).
 *
 * Cualquier cambio debe mantener EXACTAMENTE 45 columnas.
 */

export interface FundaeColumn {
  field: string;           // Nombre del campo en row_data (JSON)
  header: string;          // Nombre de la columna en Excel
  excelColumn: string;     // Letra de columna Excel (A, B, ... AS)
  required: boolean;       // Si es campo crítico
  type: 'string' | 'number' | 'date';
}

/**
 * Las 45 columnas oficiales FUNDAE en orden exacto
 * Basado en el formulario "Cuestionario para la Evaluación de la Calidad"
 */
export const FUNDAE_EXCEL_COLUMNS: FundaeColumn[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SECCIÓN I: DATOS IDENTIFICATIVOS (Columnas A-G)
  // ═══════════════════════════════════════════════════════════════════════════
  { field: 'numero_expediente', header: 'Nº Expediente', excelColumn: 'A', required: true, type: 'string' },
  { field: 'perfil', header: 'Perfil', excelColumn: 'B', required: false, type: 'string' },
  { field: 'cif_empresa', header: 'CIF Empresa', excelColumn: 'C', required: true, type: 'string' },
  { field: 'numero_accion', header: 'Nº Acción', excelColumn: 'D', required: true, type: 'string' },
  { field: 'numero_grupo', header: 'Nº Grupo', excelColumn: 'E', required: true, type: 'string' },
  { field: 'denominacion_aaff', header: 'Denominación AAFF', excelColumn: 'F', required: true, type: 'string' },
  { field: 'modalidad', header: 'Modalidad', excelColumn: 'G', required: false, type: 'string' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECCIÓN II: DATOS DEL PARTICIPANTE (Columnas H-Q)
  // ═══════════════════════════════════════════════════════════════════════════
  { field: 'edad', header: 'Edad', excelColumn: 'H', required: false, type: 'number' },
  { field: 'sexo', header: 'Sexo', excelColumn: 'I', required: false, type: 'string' },
  { field: 'titulacion', header: 'Titulación', excelColumn: 'J', required: false, type: 'string' },
  { field: 'titulacion_codigo', header: 'Código Titulación', excelColumn: 'K', required: false, type: 'string' },
  { field: 'lugar_trabajo', header: 'Lugar Trabajo', excelColumn: 'L', required: false, type: 'string' },
  { field: 'categoria_profesional', header: 'Categoría Profesional', excelColumn: 'M', required: false, type: 'string' },
  { field: 'categoria_profesional_otra', header: 'Cat. Prof. Otra', excelColumn: 'N', required: false, type: 'string' },
  { field: 'horario_curso', header: 'Horario Curso', excelColumn: 'O', required: false, type: 'string' },
  { field: 'porcentaje_jornada', header: '% Jornada', excelColumn: 'P', required: false, type: 'string' },
  { field: 'tamano_empresa', header: 'Tamaño Empresa', excelColumn: 'Q', required: false, type: 'string' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECCIÓN III: VALORACIONES (Columnas R-AS)
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Organización del curso (R-S)
  { field: 'valoracion_1_1', header: 'Val 1.1 Organización', excelColumn: 'R', required: false, type: 'number' },
  { field: 'valoracion_1_2', header: 'Val 1.2 Nº Alumnos', excelColumn: 'S', required: false, type: 'number' },

  // 2. Contenidos y metodología (T-U)
  { field: 'valoracion_2_1', header: 'Val 2.1 Contenidos', excelColumn: 'T', required: false, type: 'number' },
  { field: 'valoracion_2_2', header: 'Val 2.2 Teoría/Práctica', excelColumn: 'U', required: false, type: 'number' },

  // 3. Duración y horario (V-W)
  { field: 'valoracion_3_1', header: 'Val 3.1 Duración', excelColumn: 'V', required: false, type: 'number' },
  { field: 'valoracion_3_2', header: 'Val 3.2 Horario', excelColumn: 'W', required: false, type: 'number' },

  // 4. Formadores/Tutores (X-AA)
  { field: 'valoracion_4_1_formadores', header: 'Val 4.1 Formadores', excelColumn: 'X', required: false, type: 'number' },
  { field: 'valoracion_4_1_tutores', header: 'Val 4.1 Tutores', excelColumn: 'Y', required: false, type: 'number' },
  { field: 'valoracion_4_2_formadores', header: 'Val 4.2 Formadores', excelColumn: 'Z', required: false, type: 'number' },
  { field: 'valoracion_4_2_tutores', header: 'Val 4.2 Tutores', excelColumn: 'AA', required: false, type: 'number' },

  // 5. Medios didácticos (AB-AC)
  { field: 'valoracion_5_1', header: 'Val 5.1 Documentación', excelColumn: 'AB', required: false, type: 'number' },
  { field: 'valoracion_5_2', header: 'Val 5.2 Medios Actualizados', excelColumn: 'AC', required: false, type: 'number' },

  // 6. Instalaciones (AD-AE)
  { field: 'valoracion_6_1', header: 'Val 6.1 Instalaciones', excelColumn: 'AD', required: false, type: 'number' },
  { field: 'valoracion_6_2', header: 'Val 6.2 Medios Técnicos', excelColumn: 'AE', required: false, type: 'number' },

  // 7. Teleformación (AF-AG)
  { field: 'valoracion_7_1', header: 'Val 7.1 Guías Tutoriales', excelColumn: 'AF', required: false, type: 'number' },
  { field: 'valoracion_7_2', header: 'Val 7.2 Medios Apoyo', excelColumn: 'AG', required: false, type: 'number' },

  // 8. Evaluación (AH-AI) - Campos Sí/No
  { field: 'valoracion_8_1', header: 'Val 8.1 Pruebas Evaluación', excelColumn: 'AH', required: false, type: 'string' },
  { field: 'valoracion_8_2', header: 'Val 8.2 Acreditación', excelColumn: 'AI', required: false, type: 'string' },

  // 9. Valoración general (AJ-AN)
  { field: 'valoracion_9_1', header: 'Val 9.1 Mercado Trabajo', excelColumn: 'AJ', required: false, type: 'number' },
  { field: 'valoracion_9_2', header: 'Val 9.2 Habilidades', excelColumn: 'AK', required: false, type: 'number' },
  { field: 'valoracion_9_3', header: 'Val 9.3 Cambio Puesto', excelColumn: 'AL', required: false, type: 'number' },
  { field: 'valoracion_9_4', header: 'Val 9.4 Conocimientos', excelColumn: 'AM', required: false, type: 'number' },
  { field: 'valoracion_9_5', header: 'Val 9.5 Desarrollo Personal', excelColumn: 'AN', required: false, type: 'number' },

  // 10. Satisfacción final (AO-AP)
  { field: 'valoracion_10', header: 'Satisfacción General', excelColumn: 'AO', required: false, type: 'number' },
  { field: 'recomendaria_curso', header: 'Recomendaría', excelColumn: 'AP', required: false, type: 'string' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPOS ADICIONALES (AQ-AS)
  // ═══════════════════════════════════════════════════════════════════════════
  { field: 'sugerencias', header: 'Sugerencias', excelColumn: 'AQ', required: false, type: 'string' },
  { field: 'fecha_cumplimentacion', header: 'Fecha', excelColumn: 'AR', required: false, type: 'date' },
  { field: 'registro_entrada', header: 'Registro Entrada', excelColumn: 'AS', required: false, type: 'string' },
];

/**
 * Número EXACTO de columnas requeridas
 * CRÍTICO: Cambiar esto requiere actualizar toda la documentación
 */
export const FUNDAE_REQUIRED_COLUMNS = 45;

/**
 * Validar que tenemos exactamente 45 columnas
 * Esta función debe llamarse al iniciar la exportación
 */
export function validateColumnCount(): { valid: boolean; count: number; error?: string } {
  const count = FUNDAE_EXCEL_COLUMNS.length;

  if (count !== FUNDAE_REQUIRED_COLUMNS) {
    return {
      valid: false,
      count,
      error: `ERROR CRÍTICO: Se esperan ${FUNDAE_REQUIRED_COLUMNS} columnas pero hay ${count}. El Excel NO se puede generar.`
    };
  }

  return { valid: true, count };
}

/**
 * Obtener solo los headers para el Excel
 */
export function getExcelHeaders(): string[] {
  return FUNDAE_EXCEL_COLUMNS.map(col => col.header);
}

/**
 * Obtener solo los nombres de campo
 */
export function getFieldNames(): string[] {
  return FUNDAE_EXCEL_COLUMNS.map(col => col.field);
}

/**
 * Obtener campos requeridos (críticos)
 */
export function getRequiredFields(): string[] {
  return FUNDAE_EXCEL_COLUMNS.filter(col => col.required).map(col => col.field);
}

/**
 * Extraer una fila de datos en el orden correcto de columnas
 */
export function extractRowInOrder(rowData: Record<string, any>): any[] {
  return FUNDAE_EXCEL_COLUMNS.map(col => {
    const value = rowData[col.field];
    return value !== undefined && value !== null ? value : '';
  });
}

// Verificación automática al importar el módulo
const validation = validateColumnCount();
if (!validation.valid) {
  console.error('🚨🚨🚨 ' + validation.error);
  throw new Error(validation.error);
}

console.log(`✅ FUNDAE Excel Columns: ${validation.count} columnas verificadas`);
