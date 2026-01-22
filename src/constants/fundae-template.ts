/**
 * Template FUNDAE Oficial - Cuestionario de Evaluación de Calidad
 * Orden TAS 2307/2007, de 27 de julio
 *
 * Este template define TODOS los campos del formulario FUNDAE oficial
 * para que el sistema pueda extraerlos correctamente de los PDFs.
 */

import type { SchemaField } from '../types';

/**
 * Schema completo del formulario FUNDAE
 * Incluye los ~100 campos del formulario oficial
 */
export const FUNDAE_SCHEMA: SchemaField[] = [
  // ============================================================================
  // SECCIÓN I: DATOS IDENTIFICATIVOS DE LA ACCIÓN FORMATIVA
  // ============================================================================
  { id: 'numero_expediente', name: 'numero_expediente', type: 'STRING' },
  { id: 'perfil', name: 'perfil', type: 'STRING' },
  { id: 'cif_empresa', name: 'cif_empresa', type: 'STRING' },
  { id: 'numero_accion', name: 'numero_accion', type: 'STRING' },
  { id: 'numero_grupo', name: 'numero_grupo', type: 'STRING' },
  { id: 'denominacion_aaff', name: 'denominacion_aaff', type: 'STRING' },
  { id: 'modalidad', name: 'modalidad', type: 'STRING' }, // Presencial, Teleformación, Mixta

  // ============================================================================
  // SECCIÓN II: DATOS DE CLASIFICACIÓN DEL PARTICIPANTE
  // ============================================================================
  { id: 'edad', name: 'edad', type: 'NUMBER' },
  { id: 'sexo', name: 'sexo', type: 'STRING' }, // Mujer, Varón, No contesta

  // Titulación actual (campo complejo con muchas opciones)
  { id: 'titulacion', name: 'titulacion', type: 'STRING' },
  { id: 'titulacion_codigo', name: 'titulacion_codigo', type: 'STRING' }, // Código numérico

  // Lugar de trabajo
  { id: 'lugar_trabajo', name: 'lugar_trabajo', type: 'STRING' }, // Provincia

  // Categoría profesional
  { id: 'categoria_profesional', name: 'categoria_profesional', type: 'STRING' },
  { id: 'categoria_profesional_otra', name: 'categoria_profesional_otra', type: 'STRING' }, // Si especifica otra

  // Horario del curso
  { id: 'horario_curso', name: 'horario_curso', type: 'STRING' }, // Dentro/Fuera/Ambas/No contesta
  { id: 'porcentaje_jornada', name: 'porcentaje_jornada', type: 'STRING' }, // <25%, 25-50%, >50%, No contesta

  // Tamaño de la empresa
  { id: 'tamano_empresa', name: 'tamano_empresa', type: 'STRING' }, // 1-9, 10-49, 50-99, 100-250, >250, No contesta

  // ============================================================================
  // SECCIÓN III: VALORACIÓN DE LAS ACCIONES FORMATIVAS
  // Escala 1-4: 1=Completamente en desacuerdo, 2=En desacuerdo,
  //            3=De acuerdo, 4=Completamente de acuerdo
  // ============================================================================

  // 1. Organización del curso (STRING para permitir "NC")
  { id: 'valoracion_1_1', name: 'valoracion_1_1', type: 'STRING' }, // Curso bien organizado
  { id: 'valoracion_1_2', name: 'valoracion_1_2', type: 'STRING' }, // Número de alumnos adecuado

  // 2. Contenidos y metodología de impartición
  { id: 'valoracion_2_1', name: 'valoracion_2_1', type: 'STRING' }, // Contenidos responden a necesidades
  { id: 'valoracion_2_2', name: 'valoracion_2_2', type: 'STRING' }, // Combinación teoría/práctica

  // 3. Duración y horario
  { id: 'valoracion_3_1', name: 'valoracion_3_1', type: 'STRING' }, // Duración suficiente
  { id: 'valoracion_3_2', name: 'valoracion_3_2', type: 'STRING' }, // Horario favorece asistencia

  // 4. Formadores / Tutores (dos columnas)
  { id: 'valoracion_4_1_formadores', name: 'valoracion_4_1_formadores', type: 'STRING' }, // Forma de impartir (formadores)
  { id: 'valoracion_4_1_tutores', name: 'valoracion_4_1_tutores', type: 'STRING' }, // Forma de tutorizar (tutores)
  { id: 'valoracion_4_2_formadores', name: 'valoracion_4_2_formadores', type: 'STRING' }, // Conocen temas (formadores)
  { id: 'valoracion_4_2_tutores', name: 'valoracion_4_2_tutores', type: 'STRING' }, // Conocen temas (tutores)

  // 5. Medios didácticos
  { id: 'valoracion_5_1', name: 'valoracion_5_1', type: 'STRING' }, // Documentación comprensible
  { id: 'valoracion_5_2', name: 'valoracion_5_2', type: 'STRING' }, // Medios actualizados

  // 6. Instalaciones y medios técnicos
  { id: 'valoracion_6_1', name: 'valoracion_6_1', type: 'STRING' }, // Instalaciones apropiadas
  { id: 'valoracion_6_2', name: 'valoracion_6_2', type: 'STRING' }, // Medios técnicos adecuados

  // 7. Solo para teleformación/mixta (STRING para permitir "NA" en presencial)
  { id: 'valoracion_7_1', name: 'valoracion_7_1', type: 'STRING' }, // Guías tutoriales
  { id: 'valoracion_7_2', name: 'valoracion_7_2', type: 'STRING' }, // Medios de apoyo

  // 8. Mecanismos para la evaluación del aprendizaje
  { id: 'valoracion_8_1', name: 'valoracion_8_1', type: 'STRING' }, // Pruebas de evaluación (Sí/No)
  { id: 'valoracion_8_2', name: 'valoracion_8_2', type: 'STRING' }, // Acreditación (Sí/No)

  // 9. Valoración general del curso (STRING para permitir "NC")
  { id: 'valoracion_9_1', name: 'valoracion_9_1', type: 'STRING' }, // Incorporación mercado trabajo
  { id: 'valoracion_9_2', name: 'valoracion_9_2', type: 'STRING' }, // Nuevas habilidades aplicables
  { id: 'valoracion_9_3', name: 'valoracion_9_3', type: 'STRING' }, // Mejora posibilidades cambio puesto
  { id: 'valoracion_9_4', name: 'valoracion_9_4', type: 'STRING' }, // Ampliado conocimientos carrera
  { id: 'valoracion_9_5', name: 'valoracion_9_5', type: 'STRING' }, // Favorecido desarrollo personal

  // 10. Grado de satisfacción general
  { id: 'valoracion_10', name: 'valoracion_10', type: 'STRING' }, // Satisfacción general (1-4)
  { id: 'recomendaria_curso', name: 'recomendaria_curso', type: 'STRING' }, // Sí/No o 1-4

  // 11. Sugerencias y observaciones
  { id: 'sugerencias', name: 'sugerencias', type: 'STRING' },

  // Fecha de cumplimentación
  { id: 'fecha_cumplimentacion', name: 'fecha_cumplimentacion', type: 'STRING' },

  // ============================================================================
  // CAMPOS ADICIONALES PARA METADATOS Y CONTROL
  // ============================================================================
  // NOTA: csv_fundae y codigo_barras eliminados - no son necesarios para formularios FUNDAE
  { id: 'registro_entrada', name: 'registro_entrada', type: 'STRING' }, // Número de registro FUNDAE
];

/**
 * Prompt optimizado para la extracción de formularios FUNDAE
 * VERSIÓN 2.0 - Optimizado para MÁXIMA FIABILIDAD en documentos gubernamentales
 */
export const FUNDAE_EXTRACTION_PROMPT = `TAREA: Extraer datos del formulario FUNDAE oficial "Cuestionario para la Evaluación de la Calidad de las Acciones Formativas" (Orden TAS 2307/2007).

═══════════════════════════════════════════════════════════════════════════════
⚠️⚠️⚠️ REGLAS CRÍTICAS DE FIABILIDAD - LEE ESTO PRIMERO ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════════════════════

ESTE SISTEMA PROCESARÁ 18,000 DOCUMENTOS. UN ERROR ES INACEPTABLE.

REGLA 1 - NUNCA INVENTES:
- Si NO ves una marca clara en una casilla → devuelve "NC"
- Si la casilla está VACÍA → devuelve "NC"
- NUNCA adivines un valor probable

REGLA 2 - MARCAS MÚLTIPLES = NC:
- Si hay DOS o MÁS marcas en la misma fila de opciones → devuelve "NC"
- Ejemplo: Si casilla 3 Y casilla 4 tienen marca → "NC"

REGLA 3 - VERIFICACIÓN VISUAL OBLIGATORIA:
- Para cada valoración, MIRA físicamente la fila de casillas
- CUENTA las casillas de izquierda a derecha: 1, 2, 3, 4
- IDENTIFICA cuál casilla tiene la marca
- El número de la POSICIÓN es el valor (no lo que parezca escrito cerca)

REGLA 4 - CASILLAS VACÍAS EN SECCIONES:
- Si una sección completa (ej: TUTORES) no tiene ninguna marca → todos "NC"
- Si una fila específica no tiene marca → ese campo = "NC"

REGLA 5 - ANTE LA DUDA → "NC":
- Marca poco clara → "NC"
- No estás seguro → "NC"
- Parece tachado/corregido → "NC"

Las marcas válidas son: X, ✓, ✗, círculo, tachado, o relleno completo de casilla.

═══════════════════════════════════════════════════════════════════════════════
SECCIÓN I - DATOS IDENTIFICATIVOS (parte superior del formulario)
═══════════════════════════════════════════════════════════════════════════════

- numero_expediente: Formato "F24XXXX" o similar. Buscar en encabezado.
- perfil: "B" (Bonificada) o similar. Una letra mayúscula.
- cif_empresa: Formato letra + 8 dígitos (ej: "B12345678"). VERIFICAR que tenga 9 caracteres.
- numero_accion: Número de 1-4 dígitos (ej: "1", "12", "001").
- numero_grupo: Número de 1-4 dígitos (ej: "1", "5", "001").
- denominacion_aaff: Nombre completo del curso. Puede ser largo.
- modalidad: SOLO valores válidos: "Presencial", "Teleformación", "Mixta".
  Buscar casilla marcada en la fila "Modalidad de impartición".

═══════════════════════════════════════════════════════════════════════════════
SECCIÓN II - DATOS DEL PARTICIPANTE
═══════════════════════════════════════════════════════════════════════════════

- edad: Número entero entre 16 y 99. Si no es legible, null.

- sexo: CÓDIGOS EXACTOS:
  • "1" = Mujer (casilla marcada en "Mujer")
  • "2" = Varón (casilla marcada en "Varón" u "Hombre")
  • "9" = No contesta (casilla NC marcada o ninguna marcada)

- titulacion/titulacion_codigo: ⚠️ IMPORTANTE - Buscar UNA casilla marcada en la tabla de "Titulación académica".
  La tabla tiene múltiples opciones con códigos del "01" al "12":
  • "01" = Sin titulación
  • "02" = Graduado escolar / ESO
  • "03" = Bachiller / BUP / COU
  • "04" = FP I / Ciclo Formativo Grado Medio
  • "05" = FP II / Ciclo Formativo Grado Superior
  • "06" = Diplomatura
  • "07" = Licenciatura / Grado universitario
  • "08" = Doctorado
  • "09" = Certificado de profesionalidad
  • "10" = Otros
  Extraer TANTO el nombre (titulacion) COMO el código (titulacion_codigo).
  Si hay una X o marca en cualquier casilla de esta tabla, DEBES extraer el valor.

- lugar_trabajo: Nombre de provincia española. Si dice código, buscar correspondencia.

- categoria_profesional: ⚠️ IMPORTANTE - Buscar la casilla marcada en "Categoría profesional".
  INSTRUCCIONES: Hay 6 opciones + NC. Identificar cuál tiene la X o marca.
  DEVOLVER EL CÓDIGO NUMÉRICO correspondiente:
  • "1" = Directivo (dirección, gerencia)
  • "2" = Mando intermedio (jefes de equipo, supervisores)
  • "3" = Técnico (profesionales cualificados con título)
  • "4" = Trabajador cualificado (oficial, especialista)
  • "5" = Trabajador no cualificado (peón, ayudante)
  • "6" = Otra (ver campo categoria_profesional_otra)
  • "9" = No contesta / NC
  ⚠️ NO confundir con otros campos. La casilla está en la sección de datos del participante.

- horario_curso: CÓDIGOS EXACTOS:
  • "1" = Dentro de la jornada laboral
  • "2" = Fuera de la jornada laboral
  • "3" = Ambas
  • "9" = No contesta

- porcentaje_jornada: CÓDIGOS EXACTOS:
  • "1" = Menos del 25%
  • "2" = Entre 25% y 50%
  • "3" = Más del 50%
  • "9" = No contesta

- tamano_empresa: CÓDIGOS EXACTOS:
  • "1" = 1-9 trabajadores
  • "2" = 10-49 trabajadores
  • "3" = 50-99 trabajadores
  • "4" = 100-250 trabajadores
  • "5" = Más de 250 trabajadores
  • "9" = No contesta

═══════════════════════════════════════════════════════════════════════════════
SECCIÓN III - VALORACIONES (escala 1-4)
═══════════════════════════════════════════════════════════════════════════════

⚠️ MÉTODO DE LECTURA OBLIGATORIO PARA CADA VALORACIÓN:

PASO 1: Localiza la fila de la pregunta
PASO 2: Identifica las 4 casillas de esa fila (están bajo columnas 1, 2, 3, 4)
PASO 3: CUENTA desde la IZQUIERDA: primera casilla=1, segunda=2, tercera=3, cuarta=4
PASO 4: Mira cuál casilla tiene marca (X, ✓, círculo, relleno)
PASO 5: Devuelve el número de la POSICIÓN donde está la marca

ESCALA:
  • Posición 1 (izquierda) = Completamente en desacuerdo
  • Posición 2 = En desacuerdo
  • Posición 3 = De acuerdo
  • Posición 4 (derecha) = Completamente de acuerdo

⚠️ CASOS ESPECIALES:
  • Si NINGUNA casilla tiene marca → "NC"
  • Si HAY MARCA EN DOS O MÁS casillas → "NC"
  • Si la marca no es clara → "NC"

ORGANIZACIÓN (valoracion_1_X):
- valoracion_1_1: "El curso ha estado bien organizado"
- valoracion_1_2: "El número de alumnos ha sido adecuado"

CONTENIDOS (valoracion_2_X):
- valoracion_2_1: "Los contenidos responden a las necesidades"
- valoracion_2_2: "La combinación de teoría y práctica ha sido adecuada"

DURACIÓN Y HORARIO (valoracion_3_X):
- valoracion_3_1: "La duración del curso ha sido suficiente"
- valoracion_3_2: "El horario ha favorecido la asistencia"

FORMADORES/TUTORES (valoracion_4_X - ⚠️⚠️⚠️ ATENCIÓN ESPECIAL ⚠️⚠️⚠️):

Esta sección es DIFERENTE. Cada fila tiene DOS GRUPOS de 4 casillas:

    ESTRUCTURA VISUAL DE CADA FILA:
    ┌─────────────────────────┬─────────────────────────┐
    │      FORMADORES         │        TUTORES          │
    │   [1] [2] [3] [4]       │    [1] [2] [3] [4]      │
    └─────────────────────────┴─────────────────────────┘

⚠️ MÉTODO DE LECTURA:
1. Las 4 PRIMERAS casillas de la fila = FORMADORES
2. Las 4 SIGUIENTES casillas de la fila = TUTORES
3. Busca marca SOLO en el grupo correspondiente

⚠️ REGLA CRÍTICA PARA TUTORES:
- Si las 4 casillas de TUTORES están VACÍAS → devuelve "NC"
- Si NO hay ninguna marca en la columna de tutores → "NC"
- NUNCA inventes un valor para tutores si no hay marca

- valoracion_4_1_formadores: Grupo IZQUIERDO, fila 4.1 (1-4 o "NC")
- valoracion_4_1_tutores: Grupo DERECHO, fila 4.1 (1-4 o "NC" si vacío)
- valoracion_4_2_formadores: Grupo IZQUIERDO, fila 4.2 (1-4 o "NC")
- valoracion_4_2_tutores: Grupo DERECHO, fila 4.2 (1-4 o "NC" si vacío)

MEDIOS DIDÁCTICOS (valoracion_5_X):
- valoracion_5_1: "La documentación es comprensible"
- valoracion_5_2: "Los medios están actualizados"

INSTALACIONES (valoracion_6_X):
- valoracion_6_1: "Las instalaciones son apropiadas"
- valoracion_6_2: "Los medios técnicos son adecuados"

TELEFORMACIÓN (valoracion_7_X) - CONDICIONAL POR MODALIDAD:
⚠️ REGLA CRÍTICA:
  • Si modalidad = "Presencial" → valoracion_7_1 = "NA" y valoracion_7_2 = "NA"
  • Si modalidad = "Teleformación" o "Mixta" → Leer las casillas marcadas (valor 1-4)
- valoracion_7_1: "Las guías tutoriales han sido útiles"
- valoracion_7_2: "Los medios de apoyo han sido suficientes"

EVALUACIÓN (valoracion_8_X) - ⚠️ RESPUESTAS SÍ/NO (NO escala 1-4):
Esta sección tiene SOLO DOS CASILLAS por pregunta: "Sí" y "No".
⚠️ NO son casillas 1-2-3-4. Son casillas de SI/NO.

- valoracion_8_1: Buscar casilla marcada → devolver "Sí" o "No"
  Pregunta: "¿Se han realizado pruebas de evaluación?"
- valoracion_8_2: Buscar casilla marcada → devolver "Sí" o "No"
  Pregunta: "¿Se entrega diploma/certificado/acreditación?"

⚠️ Si hay marca en la casilla SÍ, devolver exactamente "Sí"
⚠️ Si hay marca en la casilla NO, devolver exactamente "No"

VALORACIÓN GENERAL (valoracion_9_X):
- valoracion_9_1: Incorporación al mercado de trabajo (1-4)
- valoracion_9_2: Nuevas habilidades aplicables (1-4)
- valoracion_9_3: Mejorado posibilidades de cambio (1-4)
- valoracion_9_4: Ampliado conocimientos (1-4)
- valoracion_9_5: Favorecido desarrollo personal (1-4)

SATISFACCIÓN FINAL:
- valoracion_10: Grado de satisfacción general (1-4)
- recomendaria_curso: "Sí" o "No" (o número 1-4 si es escala)

═══════════════════════════════════════════════════════════════════════════════
CAMPOS ADICIONALES
═══════════════════════════════════════════════════════════════════════════════

- sugerencias: Texto libre escrito por el participante. Transcribir literalmente.
- fecha_cumplimentacion: Formato DD/MM/YYYY. Verificar que sea fecha válida.
- registro_entrada: Número de registro si aparece en el encabezado.

═══════════════════════════════════════════════════════════════════════════════
RESUMEN DE VALIDACIONES AUTOMÁTICAS:
═══════════════════════════════════════════════════════════════════════════════

• CIF: Debe tener 9 caracteres (letra + 8 números o 8 números + letra)
• Edad: Entre 16 y 99
• Valoraciones 1-4: Solo números 1, 2, 3 o 4
• Códigos de categoría: Solo "1" a "6" o "9"
• Fechas: Formato DD/MM/YYYY, año entre 2020 y 2030

Si un valor NO cumple estas validaciones pero está claramente escrito,
extráelo tal cual y el sistema lo marcará para revisión humana.

Devuelve los datos en formato JSON según el esquema proporcionado.`;

/**
 * Template de ejemplo para "Mis Modelos"
 */
export const FUNDAE_TEMPLATE_FOR_PANEL = {
  id: 'fundae-oficial-2024',
  name: 'FUNDAE - Cuestionario Oficial Evaluación Calidad',
  description: 'Formulario oficial FUNDAE según Orden TAS 2307/2007. Incluye datos identificativos, clasificación del participante y 26 valoraciones (escala 1-4).',
  type: 'modelo' as const,
  icon: 'file' as const,
  schema: FUNDAE_SCHEMA,
  prompt: FUNDAE_EXTRACTION_PROMPT,
  custom: false, // Es template oficial
  archived: false,
  departamento: 'mis_modelos' as const, // era 'rrhh'
  visiblePara: ['user_premium', 'admin'], // Restricción
  category: 'modelos_propios',
};
