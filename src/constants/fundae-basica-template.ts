/**
 * Template FUNDAE BÁSICA - Solo campos de validación
 * Versión simplificada con únicamente los 3 campos que se validan contra Excel
 * 
 * Campos:
 * 1. numero_expediente
 * 4. numero_accion  
 * 5. numero_grupo
 */

import type { SchemaField } from '../types';

/**
 * Schema simplificado FUNDAE BÁSICA
 * Solo los 3 campos necesarios para validación con Excel del cliente
 */
export const FUNDAE_BASICA_SCHEMA: SchemaField[] = [
  { id: 'numero_expediente', name: 'numero_expediente', type: 'STRING' },
  { id: 'numero_accion', name: 'numero_accion', type: 'STRING' },
  { id: 'numero_grupo', name: 'numero_grupo', type: 'STRING' },
];

/**
 * Prompt optimizado para extracción de los 3 campos de validación FUNDAE
 */
export const FUNDAE_BASICA_EXTRACTION_PROMPT = `TAREA: Extraer ÚNICAMENTE los 3 campos de identificación del formulario FUNDAE para validación.

═══════════════════════════════════════════════════════════════════════════════
⚠️ REGLAS CRÍTICAS - SOLO 3 CAMPOS ⚠️
═══════════════════════════════════════════════════════════════════════════════

EXTRAE ÚNICAMENTE ESTOS 3 CAMPOS de la parte superior del formulario:

1. numero_expediente: 
   - Formato típico: "F24XXXX" o similar
   - Buscar en el encabezado del documento
   - Si no se ve claramente → "NC"

2. numero_accion:
   - Número de 1-4 dígitos (ej: "1", "12", "001")
   - Campo "Nº Acción" en la cabecera
   - Si no se ve claramente → "NC"

3. numero_grupo:
   - Número de 1-4 dígitos (ej: "1", "5", "001")
   - Campo "Nº Grupo" en la cabecera
   - Si no se ve claramente → "NC"

═══════════════════════════════════════════════════════════════════════════════
⚠️ IMPORTANTE: ESTOS CAMPOS SE VALIDAN CONTRA EXCEL DEL CLIENTE
═══════════════════════════════════════════════════════════════════════════════

- Si NO ves el valor claramente → devuelve "NC"
- NUNCA inventes valores
- Los valores deben coincidir EXACTAMENTE con los del Excel de referencia

Devuelve los datos en formato JSON con SOLO estos 3 campos.`;

/**
 * Template para el panel "Mis Modelos"
 */
export const FUNDAE_BASICA_TEMPLATE_FOR_PANEL = {
  id: 'fundae-basica-2024',
  name: 'FUNDAE BÁSICA - Validación Excel',
  description: 'Plantilla simplificada con solo 3 campos (expediente, acción, grupo) para validación contra Excel del cliente.',
  type: 'otro' as const,
  icon: 'file' as const,
  schema: FUNDAE_BASICA_SCHEMA,
  prompt: FUNDAE_BASICA_EXTRACTION_PROMPT,
  custom: false,
  archived: false,
  departamento: 'mis_modelos' as const,
  category: 'modelos_propios',
};
