/**
 * PLANTILLA GENÉRICA DE EXTRACCIÓN
 * src/constants/generic-template.ts
 *
 * Plantilla por defecto para documentos genéricos
 * Sin campos específicos de FUNDAE
 */

import type { SchemaField } from '../../types.ts';

/**
 * Schema genérico vacío - el modelo extraerá lo que encuentre
 */
export const GENERIC_SCHEMA: SchemaField[] = [];

/**
 * Prompt genérico para extracción de documentos
 */
export const GENERIC_EXTRACTION_PROMPT = `Eres un experto en extracción de datos de documentos.

INSTRUCCIONES:
1. Analiza el documento proporcionado
2. Extrae TODOS los campos de texto, números, fechas y datos que encuentres
3. Organiza los datos de forma estructurada
4. Para checkboxes marcados, indica el valor seleccionado
5. Para campos vacíos o ilegibles, usa "NC" (No Consta)

FORMATO DE RESPUESTA:
Devuelve un objeto JSON con todos los campos extraídos.
Usa nombres de campo descriptivos en snake_case.

Ejemplo de formato:
{
  "titulo_documento": "...",
  "fecha": "...",
  "numero_referencia": "...",
  ...
}`;

export default {
  GENERIC_SCHEMA,
  GENERIC_EXTRACTION_PROMPT
};
