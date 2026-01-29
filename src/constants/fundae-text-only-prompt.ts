/**
 * FASE 4: Prompt de texto simplificado para extracción híbrida
 * src/constants/fundae-text-only-prompt.ts
 *
 * Este prompt se usa cuando los checkboxes se extraen con CV Judge.
 * Gemini SOLO necesita extraer campos de texto, eliminando la fuente
 * principal de alucinaciones (lectura errónea de checkboxes).
 *
 * Config recomendada: temperature: 0.1, topK: 1, topP: 0.1
 */

export const FUNDAE_TEXT_ONLY_PROMPT = `TAREA: Extraer SOLO los campos de TEXTO de este formulario FUNDAE oficial.

IMPORTANTE: NO extraigas checkboxes, marcas, ni escalas de valoración 1-4.
Esos campos se procesan por otro sistema. Solo extrae texto escrito/impreso.

CAMPOS A EXTRAER:
1. numero_expediente - Formato "F24XXXX" o similar. Buscar en la parte superior del formulario.
2. perfil - Una letra mayúscula (normalmente "B" de Bonificada).
3. cif_empresa - Formato: 1 letra + 8 dígitos (ej: "B12345678"). VERIFICAR que tenga 9 caracteres.
4. numero_accion - Número de 1-4 dígitos.
5. numero_grupo - Número de 1-4 dígitos.
6. denominacion_aaff - Nombre completo del curso/acción formativa. Puede ser largo.
7. edad - Número entero entre 16 y 99. Si no es legible, devuelve null.
8. lugar_trabajo - Nombre de provincia española.
9. otra_titulacion_especificar - Texto libre si el participante ha especificado otra titulación.
10. sugerencias - Texto libre escrito por el participante en la sección de sugerencias.
11. fecha_cumplimentacion - Formato DD/MM/YYYY.

REGLAS ESTRICTAS:
- Si un campo no es legible o no existe, devuelve null para ese campo.
- NO inventes ni adivines valores.
- NO extraigas checkboxes, valoraciones, ni campos de selección múltiple.
- Devuelve EXCLUSIVAMENTE un JSON con estos 11 campos.
- Para CIF, verifica que tenga exactamente 9 caracteres (letra + 8 dígitos).
- Para edad, verifica que sea un número razonable (16-99).

Devuelve los datos en formato JSON.`;

export const FUNDAE_TEXT_ONLY_GEMINI_CONFIG = {
  temperature: 0.1,
  topK: 1,
  topP: 0.1,
};
