import * as fs from 'fs';
import * as path from 'path';

// --- Tipos de Datos ---
interface BoundingBox {
  vertices: { x: number; y: number }[];
  normalizedVertices?: { x: number; y: number }[];
}
interface Word {
  boundingBox: BoundingBox;
  symbols: { text: string }[];
}
interface Page {
  blocks: { paragraphs: { words: Word[] }[] }[];
}
interface OcrResult {
  responses: { fullTextAnnotation: { pages: Page[] } }[];
}

// --- Tipos para Coordenadas de Campos ---
type CheckboxOption = {
  value: string;
  code: string;
  page: number;
  box: { minX: number; maxX: number; minY: number; maxY: number };
};

type CheckboxOptions = CheckboxOption[];

type TextFieldCoord = {
  page: number;
  box: { minX: number; maxX: number; minY: number; maxY: number };
};

type FieldCoordinates = {
  mainLayout: {
    checkbox_fields: { [key: string]: CheckboxOptions };
    text_fields: { [key: string]: TextFieldCoord };
  };
};

type ValuationItemOption = {
  code: string;
  box: { minX: number; maxX: number; minY: number; maxY: number };
};

type ValuationItem = {
  page: number;
  options: ValuationItemOption[];
};

type ValuationItemDual = {
  formadores: ValuationItem;
  tutores: ValuationItem;
};

type ValuationCoordinates = {
  organizacion_curso: { item_1_1: ValuationItem; item_1_2: ValuationItem };
  contenidos_metodologia: { item_2_1: ValuationItem; item_2_2: ValuationItem };
  duracion_horario: { item_3_1: ValuationItem; item_3_2: ValuationItem };
  formadores_tutores: { item_4_1: ValuationItemDual; item_4_2: ValuationItemDual };
  medios_didacticos: { item_5_1: ValuationItem; item_5_2: ValuationItem };
  instalaciones_medios_tecnicos: { item_6_1: ValuationItem; item_6_2: ValuationItem };
  solo_teleformacion_mixta: { item_7_1: ValuationItem; item_7_2: ValuationItem };
  valoracion_general_curso: { item_9_1: ValuationItem; item_9_2: ValuationItem; item_9_3: ValuationItem; item_9_4: ValuationItem; item_9_5: ValuationItem };
  grado_satisfaccion_general: { item_10: ValuationItem };
};

export const FIELD_COORDINATES: FieldCoordinates = {
  mainLayout: {
    checkbox_fields: {
      modalidad: [
        { value: 'Presencial', code: 'Presencial', page: 1, box: { minX: 0.333, maxX: 0.353, minY: 0.352, maxY: 0.365 } },
        { value: 'Teleformación', code: 'Teleformación', page: 1, box: { minX: 0.572, maxX: 0.592, minY: 0.352, maxY: 0.365 } },
        { value: 'Mixta', code: 'Mixta', page: 1, box: { minX: 0.764, maxX: 0.784, minY: 0.352, maxY: 0.365 } },
      ],
      sexo: [
        { value: 'Mujer', code: '1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.408, maxY: 0.418 } },
        { value: 'Hombre', code: '2', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.423, maxY: 0.433 } },
        { value: 'No contesta', code: '9', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.438, maxY: 0.448 } },
      ],
      titulacion: [
        { value: 'Sin titulación', code: '1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.468, maxY: 0.478 } },
        { value: 'Certificado de Profesionalidad Nivel 1', code: '11', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.483, maxY: 0.493 } },
        { value: 'Educación Primaria', code: '111', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.498, maxY: 0.508 } },
        { value: 'Formación Profesional Básica', code: '12', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.513, maxY: 0.523 } },
        { value: 'Título de graduado E.S.O./Graduado escolar', code: '2', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.528, maxY: 0.538 } },
        { value: 'Certificado de Profesionalidad Nivel 2', code: '21', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.543, maxY: 0.553 } },
        { value: 'Título de Bachiller', code: '3', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.557, maxY: 0.567 } },
        { value: 'Título de Técnico/ FP grado medio', code: '4', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.573, maxY: 0.583 } },
        { value: 'Título Profesional enseñanzas música-danza', code: '41', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.587, maxY: 0.597 } },
        { value: 'Certificado de Profesionalidad Nivel 3', code: '42', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.603, maxY: 0.613 } },
        { value: 'Título de Técnico Superior/ FP grado superior', code: '5', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.618, maxY: 0.628 } },
        { value: 'E. universitarios 1º ciclo (Diplomatura)', code: '6', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.633, maxY: 0.643 } },
        { value: 'Grados universitarios de hasta 240 créditos', code: '6.1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.647, maxY: 0.657 } },
        { value: 'E. universitarios 2º ciclo (Licenciatura-Máster)', code: '7', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.663, maxY: 0.673 } },
        { value: 'Grados universitarios de más 240 créditos', code: '7.1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.677, maxY: 0.687 } },
        { value: 'Másteres oficiales universitarios', code: '7.3', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.692, maxY: 0.702 } },
        { value: 'Especialidades en CC. salud (residentes)', code: '7.4', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.707, maxY: 0.717 } },
        { value: 'E. universitarios 3º ciclo (Doctor)', code: '8', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.722, maxY: 0.732 } },
        { value: 'Título de Doctor', code: '9', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.737, maxY: 0.747 } },
        { value: 'No contesta (titulacion)', code: '99', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.752, maxY: 0.762 } },
        { value: 'Carnet profesional / Profesiones reguladas', code: 'otra_1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.781, maxY: 0.791 } },
        { value: 'Idiomas', code: 'otra_2', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.796, maxY: 0.806 } },
        { value: 'No contesta (otra_titulacion)', code: 'otra_9', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.811, maxY: 0.821 } },
        { value: 'Nivel A1 del MCER', code: 'A1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.844, maxY: 0.854 } },
        { value: 'Nivel A2 del MCER', code: 'A2', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.859, maxY: 0.869 } },
        { value: 'Nivel B1 del MCER', code: 'B1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.874, maxY: 0.884 } },
        { value: 'Nivel B2 del MCER', code: 'B2', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.889, maxY: 0.899 } },
        { value: 'Nivel C1 del MCER', code: 'C1', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.904, maxY: 0.914 } },
        { value: 'Nivel C2 del MCER', code: 'C2', page: 1, box: { minX: 0.458, maxX: 0.472, minY: 0.919, maxY: 0.929 } },
      ],
      categoria_profesional: [
        { value: 'Directivo/a', code: '1', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.465, maxY: 0.475 } },
        { value: 'Mando Intermedio', code: '2', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.480, maxY: 0.490 } },
        { value: 'Técnico/a', code: '3', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.495, maxY: 0.505 } },
        { value: 'Trabajador/a cualificado/a', code: '4', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.510, maxY: 0.520 } },
        { value: 'Trabajador/a de baja cualificación', code: '5', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.525, maxY: 0.535 } },
        { value: 'Otra categoría', code: '6', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.539, maxY: 0.549 } },
        { value: 'No contesta', code: '9', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.554, maxY: 0.564 } },
      ],
      horario_curso: [
        { value: 'Dentro de la jornada laboral', code: '1', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.594, maxY: 0.604 } },
        { value: 'Fuera de la jornada laboral', code: '2', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.609, maxY: 0.619 } },
        { value: 'Ambas', code: '3', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.624, maxY: 0.634 } },
        { value: 'No contesta', code: '9', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.639, maxY: 0.649 } },
      ],
      porcentaje_jornada: [
        { value: 'Menos del 25%', code: '1', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.675, maxY: 0.685 } },
        { value: 'Entre el 25% al 50%', code: '2', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.690, maxY: 0.700 } },
        { value: 'Más del 50%', code: '3', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.705, maxY: 0.715 } },
        { value: 'No contesta', code: '9', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.720, maxY: 0.730 } },
      ],
      tamaño_empresa: [
        { value: 'De 1 a 9 empleados', code: '1', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.758, maxY: 0.768 } },
        { value: 'De 10 a 49 empleados', code: '2', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.773, maxY: 0.783 } },
        { value: 'De 50 a 99 empleados', code: '3', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.788, maxY: 0.798 } },
        { value: 'De 100 a 250 empleados', code: '4', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.803, maxY: 0.813 } },
        { value: 'De más de 250 empleados', code: '5', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.818, maxY: 0.828 } },
        { value: 'No contesta', code: '9', page: 1, box: { minX: 0.909, maxX: 0.923, minY: 0.833, maxY: 0.843 } },
      ],
      nivel_idioma_mcer: [
        { value: 'Nivel A1 del MCER', code: 'A1', page: 2, box: { minX: 0.458, maxX: 0.472, minY: 0.844, maxY: 0.854 } },
        { value: 'Nivel A2 del MCER', code: 'A2', page: 2, box: { minX: 0.458, maxX: 0.472, minY: 0.859, maxY: 0.869 } },
        { value: 'Nivel B1 del MCER', code: 'B1', page: 2, box: { minX: 0.458, maxX: 0.472, minY: 0.874, maxY: 0.884 } },
        { value: 'Nivel B2 del MCER', code: 'B2', page: 2, box: { minX: 0.458, maxX: 0.472, minY: 0.889, maxY: 0.899 } },
        { value: 'Nivel C1 del MCER', code: 'C1', page: 2, box: { minX: 0.458, maxX: 0.472, minY: 0.904, maxY: 0.914 } },
        { value: 'Nivel C2 del MCER', code: 'C2', page: 2, box: { minX: 0.458, maxX: 0.472, minY: 0.919, maxY: 0.929 } },
      ],
      evaluacion_mecanismos_8_1_si: [{ value: 'Si', code: 'Si', page: 2, box: { minX: 0.839, maxX: 0.856, minY: 0.614, maxY: 0.628 } }],
      evaluacion_mecanismos_8_1_no: [{ value: 'No', code: 'No', page: 2, box: { minX: 0.911, maxX: 0.928, minY: 0.614, maxY: 0.628 } }],
      evaluacion_mecanismos_8_2_si: [{ value: 'Si', code: 'Si', page: 2, box: { minX: 0.839, maxX: 0.856, minY: 0.647, maxY: 0.661 } }],
      evaluacion_mecanismos_8_2_no: [{ value: 'No', code: 'No', page: 2, box: { minX: 0.911, maxX: 0.928, minY: 0.647, maxY: 0.661 } }],
      curso_recomendaria_si: [{ value: 'Si', code: 'Si', page: 2, box: { minX: 0.839, maxX: 0.856, minY: 0.811, maxY: 0.825 } }],
      curso_recomendaria_no: [{ value: 'No', code: 'No', page: 2, box: { minX: 0.911, maxX: 0.928, minY: 0.811, maxY: 0.825 } }],
    },
    text_fields: {
      numero_expediente: { page: 1, box: { minX: 0.177, maxX: 0.302, minY: 0.300, maxY: 0.314 } },
      cif_empresa: { page: 1, box: { minX: 0.143, maxX: 0.287, minY: 0.318, maxY: 0.332 } },
      perfil: { page: 1, box: { minX: 0.399, maxX: 0.543, minY: 0.300, maxY: 0.314 } },
      numero_accion: { page: 1, box: { minX: 0.407, maxX: 0.551, minY: 0.318, maxY: 0.332 } },
      numero_grupo: { page: 1, box: { minX: 0.655, maxX: 0.799, minY: 0.318, maxY: 0.332 } },
      denominacion_aaff: { page: 1, box: { minX: 0.233, maxX: 0.925, minY: 0.334, maxY: 0.348 } },
      edad: { page: 1, box: { minX: 0.143, maxX: 0.238, minY: 0.410, maxY: 0.424 } },
      lugar_trabajo: { page: 1, box: { minX: 0.690, maxX: 0.925, minY: 0.408, maxY: 0.442 } },
      otra_titulacion_esp: { page: 1, box: { minX: 0.238, maxX: 0.475, minY: 0.939, maxY: 0.968 } },
      suggestion_field: { page: 2, box: { minX: 0.071, maxX: 0.929, minY: 0.852, maxY: 0.917 } },
      date_field: { page: 2, box: { minX: 0.681, maxX: 0.906, minY: 0.917, maxY: 0.935 } },
    },
  },
};

export const VALUATION_COORDINATES: ValuationCoordinates = {
  organizacion_curso: {
    item_1_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.193, maxY: 0.207 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.193, maxY: 0.207 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.193, maxY: 0.207 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.193, maxY: 0.207 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.193, maxY: 0.207 } },
    ]},
    item_1_2: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.208, maxY: 0.222 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.208, maxY: 0.222 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.208, maxY: 0.222 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.208, maxY: 0.222 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.208, maxY: 0.222 } },
    ]},
  },
  contenidos_metodologia: {
    item_2_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.243, maxY: 0.257 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.243, maxY: 0.257 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.243, maxY: 0.257 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.243, maxY: 0.257 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.243, maxY: 0.257 } },
    ]},
    item_2_2: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.258, maxY: 0.272 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.258, maxY: 0.272 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.258, maxY: 0.272 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.258, maxY: 0.272 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.258, maxY: 0.272 } },
    ]},
  },
  duracion_horario: {
    item_3_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.293, maxY: 0.307 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.293, maxY: 0.307 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.293, maxY: 0.307 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.293, maxY: 0.307 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.293, maxY: 0.307 } },
    ]},
    item_3_2: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.308, maxY: 0.322 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.308, maxY: 0.322 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.308, maxY: 0.322 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.308, maxY: 0.322 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.308, maxY: 0.322 } },
    ]},
  },
  formadores_tutores: {
    item_4_1: {
      formadores: { page: 2, options: [
        { code: 'NC', box: { minX: 0.688, maxX: 0.705, minY: 0.358, maxY: 0.372 } },
        { code: '1', box: { minX: 0.713, maxX: 0.730, minY: 0.358, maxY: 0.372 } },
        { code: '2', box: { minX: 0.738, maxX: 0.755, minY: 0.358, maxY: 0.372 } },
        { code: '3', box: { minX: 0.763, maxX: 0.780, minY: 0.358, maxY: 0.372 } },
        { code: '4', box: { minX: 0.788, maxX: 0.805, minY: 0.358, maxY: 0.372 } },
      ]},
      tutores: { page: 2, options: [
        { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.358, maxY: 0.372 } },
        { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.358, maxY: 0.372 } },
        { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.358, maxY: 0.372 } },
        { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.358, maxY: 0.372 } },
        { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.358, maxY: 0.372 } },
      ]},
    },
    item_4_2: {
      formadores: { page: 2, options: [
        { code: 'NC', box: { minX: 0.688, maxX: 0.705, minY: 0.373, maxY: 0.387 } },
        { code: '1', box: { minX: 0.713, maxX: 0.730, minY: 0.373, maxY: 0.387 } },
        { code: '2', box: { minX: 0.738, maxX: 0.755, minY: 0.373, maxY: 0.387 } },
        { code: '3', box: { minX: 0.763, maxX: 0.780, minY: 0.373, maxY: 0.387 } },
        { code: '4', box: { minX: 0.788, maxX: 0.805, minY: 0.373, maxY: 0.387 } },
      ]},
      tutores: { page: 2, options: [
        { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.373, maxY: 0.387 } },
        { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.373, maxY: 0.387 } },
        { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.373, maxY: 0.387 } },
        { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.373, maxY: 0.387 } },
        { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.373, maxY: 0.387 } },
      ]},
    },
  },
  medios_didacticos: {
    item_5_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.411, maxY: 0.425 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.411, maxY: 0.425 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.411, maxY: 0.425 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.411, maxY: 0.425 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.411, maxY: 0.425 } },
    ]},
    item_5_2: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.426, maxY: 0.440 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.426, maxY: 0.440 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.426, maxY: 0.440 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.426, maxY: 0.440 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.426, maxY: 0.440 } },
    ]},
  },
  instalaciones_medios_tecnicos: {
    item_6_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.471, maxY: 0.485 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.471, maxY: 0.485 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.471, maxY: 0.485 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.471, maxY: 0.485 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.471, maxY: 0.485 } },
    ]},
    item_6_2: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.493, maxY: 0.507 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.493, maxY: 0.507 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.493, maxY: 0.507 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.493, maxY: 0.507 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.493, maxY: 0.507 } },
    ]},
  },
  solo_teleformacion_mixta: {
    item_7_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.538, maxY: 0.552 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.538, maxY: 0.552 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.538, maxY: 0.552 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.538, maxY: 0.552 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.538, maxY: 0.552 } },
    ]},
    item_7_2: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.566, maxY: 0.580 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.566, maxY: 0.580 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.566, maxY: 0.580 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.566, maxY: 0.580 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.566, maxY: 0.580 } },
    ]},
  },
  valoracion_general_curso: {
    item_9_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.686, maxY: 0.700 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.686, maxY: 0.700 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.686, maxY: 0.700 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.686, maxY: 0.700 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.686, maxY: 0.700 } },
    ]},
    item_9_2: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.701, maxY: 0.715 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.701, maxY: 0.715 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.701, maxY: 0.715 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.701, maxY: 0.715 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.701, maxY: 0.715 } },
    ]},
    item_9_3: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.716, maxY: 0.730 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.716, maxY: 0.730 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.716, maxY: 0.730 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.716, maxY: 0.730 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.716, maxY: 0.730 } },
    ]},
    item_9_4: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.731, maxY: 0.745 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.731, maxY: 0.745 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.731, maxY: 0.745 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.731, maxY: 0.745 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.731, maxY: 0.745 } },
    ]},
    item_9_5: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.746, maxY: 0.760 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.746, maxY: 0.760 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.746, maxY: 0.760 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.746, maxY: 0.760 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.746, maxY: 0.760 } },
    ]},
  },
  grado_satisfaccion_general: {
    item_10: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.788, maxY: 0.802 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.788, maxY: 0.802 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.788, maxY: 0.802 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.788, maxY: 0.802 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.788, maxY: 0.802 } },
    ]},
  },
};


function extractValuationItem(item: { page: number; options: { code: string; box: { minX: number; maxX: number; minY: number; maxY: number } }[] }, allWordsByPage: { [page: number]: Word[] }): string | null {
  const allWordsForPage = allWordsByPage[item.page] || [];

  for (const option of item.options) {
    const textInBox = getTextInBoundingBox(option.box, allWordsForPage);
    const cleanedText = textInBox ? textInBox.toLowerCase().trim() : '';

    // Prioridad 1: Marcas explícitas (X, ✓, v)
    if (cleanedText.match(/[x✓v]/)) {
      console.log(`DEBUG (extractValuationItem): Marca explícita detectada en casilla ${option.code} (Página ${item.page}). Texto detectado: "${textInBox}"`);
      return option.code;
    }
    // Prioridad 2: Si el OCR detecta el propio código de la opción (ej. "3" en la casilla '3')
    else if (cleanedText === option.code.toLowerCase()) {
      console.log(`DEBUG (extractValuationItem): Código de opción detectado en su propia casilla ${option.code} (Página ${item.page}). Asumiendo marca. Texto detectado: "${textInBox}"`);
      return option.code;
    }
    // Para depuración: si encuentra texto que no es ninguna de las anteriores
    else if (cleanedText) {
      console.log(`DEBUG (extractValuationItem): Texto detectado en casilla ${option.code} (Página ${item.page}) pero no es una marca explícita ni el código de opción: "${textInBox}"`);
    }
  }
  return 'NC'; // Si no se marca nada, devuelve "No Contesta"
}

// --- Funciones de Extracción y Validación ---

function getTextInBoundingBox(box: { minX: number; maxX: number; minY: number; maxY: number }, allWords: Word[]): string | null {
  const getVertices = (b: BoundingBox) => b.normalizedVertices || b.vertices;
  const wordsInBox = allWords.filter(word => {
    const wordVertices = getVertices(word.boundingBox);
    const wordCenterX = (wordVertices[0].x + wordVertices[1].x) / 2;
    const wordCenterY = (wordVertices[0].y + wordVertices[3].y) / 2;
    return wordCenterX >= box.minX && wordCenterX <= box.maxX && wordCenterY >= box.minY && wordCenterY <= box.maxY;
  });
  if (wordsInBox.length > 0) {
    wordsInBox.sort((a, b) => getVertices(a.boundingBox)[0].x - getVertices(b.boundingBox)[0].x);
    return wordsInBox.map(word => word.symbols.map(s => s.text).join('')).join(' ');
  }
  return null;
}

function getCheckedValue(options: CheckboxOptions, allWordsByPage: { [page: number]: Word[] }): string[] | null {
    const foundValues: string[] = [];
    for (const option of options) {
        const allWordsForPage = allWordsByPage[option.page] || [];
        const textInBox = getTextInBoundingBox(option.box, allWordsForPage);
        const cleanedText = textInBox ? textInBox.toLowerCase().trim() : '';

        // Prioridad 1: Marcas explícitas (X, ✓, v)
        if (cleanedText.match(/[x✓v]/)) {
            foundValues.push(option.code);
        }
        // Prioridad 2: Si el OCR detecta el propio código de la opción (ej. "3" en la casilla '3')
        // Esto es un workaround para cuando el OCR misinterpreta la marca como el número de la opción
        else if (cleanedText === option.code.toLowerCase()) {
            foundValues.push(option.code);
        }
    }

    if (foundValues.length === 0) {
        // Si no se encontró ningún valor, verificar si hay opción "No contesta"
        if (options.some(opt => opt.value === 'No contesta')) {
            return ['9']; // Devolver un array con '9' si no contesta
        }
        return null;
    }

    return foundValues; // Devolver todas las opciones marcadas
}

// --- NUEVA FUNCIÓN DE VALIDACIÓN ---
function validateLugarTrabajo(text: string | null): string | null {
    if (!text) return null;

    // Si contiene una coma, es probable que sea "ciudad, provincia" y requiere revisión.
    if (text.includes(',')) {
        return `REQUIERE_REVISION: ${text}`;
    }

    // Aquí iría la lógica para comprobar contra la lista de provincias del Excel
    // Por ahora, si no tiene coma, lo damos por bueno.
    return text;
}


// --- Lógica del Parser Definitivo ---
function parseWithCoordinates(ocrResult: OcrResult) {
  const layout = FIELD_COORDINATES.mainLayout;
  const extractedData: { [key: string]: string | string[] | null } = {};
  const allWordsByPage: { [page: number]: Word[] } = {};
  let currentPageNumber = 1;
  ocrResult.responses.forEach(response => {
    response?.fullTextAnnotation?.pages.forEach((p) => {
      allWordsByPage[currentPageNumber] = p.blocks.flatMap(b => b.paragraphs.flatMap(par => par.words));
      currentPageNumber++;
    });
  });
  console.log(`DEBUG (parseWithCoordinates): Total de páginas OCR procesadas: ${Object.keys(allWordsByPage).length}`);

  if (Object.keys(allWordsByPage).length === 0) return {};

  // 1. Extraer campos de texto
  for (const field in layout.text_fields) {
    const textField = layout.text_fields[field as keyof typeof layout.text_fields];
    extractedData[field] = getTextInBoundingBox(textField.box, allWordsByPage[textField.page] || []);
  }

  // 2. Extraer campos de checkbox
  for (const field in layout.checkbox_fields) {
      const options = layout.checkbox_fields[field as keyof typeof layout.checkbox_fields];
      extractedData[field] = getCheckedValue(options, allWordsByPage);
  }

  // 3. Extraer tablas de valoración (Escala 1-4)
  if (VALUATION_COORDINATES.organizacion_curso) {
    extractedData.organizacion_curso_item_1_1 = extractValuationItem(VALUATION_COORDINATES.organizacion_curso.item_1_1, allWordsByPage);
    extractedData.organizacion_curso_item_1_2 = extractValuationItem(VALUATION_COORDINATES.organizacion_curso.item_1_2, allWordsByPage);
  }
  if (VALUATION_COORDINATES.contenidos_metodologia) {
    extractedData.contenidos_metodologia_item_2_1 = extractValuationItem(VALUATION_COORDINATES.contenidos_metodologia.item_2_1, allWordsByPage);
    extractedData.contenidos_metodologia_item_2_2 = extractValuationItem(VALUATION_COORDINATES.contenidos_metodologia.item_2_2, allWordsByPage);
  }
  if (VALUATION_COORDINATES.duracion_horario) {
    extractedData.duracion_horario_item_3_1 = extractValuationItem(VALUATION_COORDINATES.duracion_horario.item_3_1, allWordsByPage);
    extractedData.duracion_horario_item_3_2 = extractValuationItem(VALUATION_COORDINATES.duracion_horario.item_3_2, allWordsByPage);
  }
  if (VALUATION_COORDINATES.medios_didacticos) {
    extractedData.medios_didacticos_item_5_1 = extractValuationItem(VALUATION_COORDINATES.medios_didacticos.item_5_1, allWordsByPage);
    extractedData.medios_didacticos_item_5_2 = extractValuationItem(VALUATION_COORDINATES.medios_didacticos.item_5_2, allWordsByPage);
  }
  if (VALUATION_COORDINATES.instalaciones_medios_tecnicos) {
    extractedData.instalaciones_item_6_1 = extractValuationItem(VALUATION_COORDINATES.instalaciones_medios_tecnicos.item_6_1, allWordsByPage);
    extractedData.instalaciones_item_6_2 = extractValuationItem(VALUATION_COORDINATES.instalaciones_medios_tecnicos.item_6_2, allWordsByPage);
  }
  if (VALUATION_COORDINATES.solo_teleformacion_mixta) {
    extractedData.teleformacion_item_7_1 = extractValuationItem(VALUATION_COORDINATES.solo_teleformacion_mixta.item_7_1, allWordsByPage);
    extractedData.teleformacion_item_7_2 = extractValuationItem(VALUATION_COORDINATES.solo_teleformacion_mixta.item_7_2, allWordsByPage);
  }
  if (VALUATION_COORDINATES.valoracion_general_curso) {
    extractedData.valoracion_general_item_9_1 = extractValuationItem(VALUATION_COORDINATES.valoracion_general_curso.item_9_1, allWordsByPage);
    extractedData.valoracion_general_item_9_2 = extractValuationItem(VALUATION_COORDINATES.valoracion_general_curso.item_9_2, allWordsByPage);
    extractedData.valoracion_general_item_9_3 = extractValuationItem(VALUATION_COORDINATES.valoracion_general_curso.item_9_3, allWordsByPage);
    extractedData.valoracion_general_item_9_4 = extractValuationItem(VALUATION_COORDINATES.valoracion_general_curso.item_9_4, allWordsByPage);
    extractedData.valoracion_general_item_9_5 = extractValuationItem(VALUATION_COORDINATES.valoracion_general_curso.item_9_5, allWordsByPage);
  }
  if (VALUATION_COORDINATES.grado_satisfaccion_general) {
    extractedData.grado_satisfaccion_item_10 = extractValuationItem(VALUATION_COORDINATES.grado_satisfaccion_general.item_10, allWordsByPage);
  }

  // 4. Aplicar validaciones específicas
  if (extractedData.lugar_trabajo && typeof extractedData.lugar_trabajo === 'string') {
      extractedData.lugar_trabajo = validateLugarTrabajo(extractedData.lugar_trabajo);
  }

  return extractedData;
}


function main() {
  const ocrJsonPath = './ocr_output.json';
  if (!fs.existsSync(ocrJsonPath)) {
    console.error(`ERROR: No se encuentra el archivo ${ocrJsonPath}.`);
    return;
  }
  const ocrResult: OcrResult = JSON.parse(fs.readFileSync(ocrJsonPath, 'utf-8'));
  const finalData = parseWithCoordinates(ocrResult);
  console.log("\n--- DATOS EXTRAÍDOS (con Coordenadas) ---\n");
  console.log(JSON.stringify(finalData, null, 2));
}

main();