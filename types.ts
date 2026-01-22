export type UploadedFileStatus = 'pendiente' | 'procesando' | 'completado' | 'error';

export interface UploadedFile {
  id: string;
  file: File;
  status: UploadedFileStatus;
  extractedData?: object;
  transcription?: string;
  error?: string;
}

// --- NEW DETAILED TYPES FOR HEALTH SECTOR ---

// 1. Field Data Types
export type FieldDataType =
  | 'texto'
  | 'numero'
  | 'fecha'
  | 'hora'
  | 'fecha_hora'
  | 'seleccion'
  | 'multiseleccion'
  | 'espacio_libre'
  | 'tabla'
  | 'telefono'
  | 'email'
  | 'combo_cie10'; // Special type for CIE-10 codes

// 2. Options for Selectable Fields
export interface Option {
  valor: string;
  etiqueta: string;
}

// 3. Validations
export interface Validation {
  longitud_minima?: number;
  longitud_maxima?: number;
  patron_regex?: string;
  rango_fechas?: {
    desde: string;
    hasta: string;
  };
  minimo?: number;
  maximo?: number;
  decimales?: number;
  formato_por_pais?: Record<string, { patron: string }>;
  logica?: {
    condicion: string;
    mensaje_error: string;
  };
}

// 4. Extraction Configuration
export interface ExtractionConfig {
  buscar_automaticamente?: boolean;
  metodo_extraccion?: ('ocr' | 'nlp' | 'regex' | 'modelo_ia')[];
}

// 5. Table Structure
export interface TableColumn {
  nombre: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'seleccion';
  obligatorio?: boolean;
  opciones?: Option[];
}

// 6. Security and Compliance
export type PhiSensitivity = 'muy_alta' | 'alta' | 'media' | 'baja';

export interface SecurityMetadata {
  is_phi: boolean;
  phi_sensitivity?: PhiSensitivity;
  hipaa_identifier?: boolean; // Is it one of the 18 HIPAA identifiers?
}

// 7. Field Definition
export interface Field {
  nombre_campo: string;
  etiqueta: string;
  tipo_dato: FieldDataType;
  orden: number;
  obligatorio: boolean;
  placeholder?: string;
  ayuda?: string;
  opciones?: Option[];
  estructura_filas?: {
    [key: string]: {
      columnas: TableColumn[];
    };
  };
  mapeo_estandares?: {
    hl7_field?: string;
    fhir_path?: string;
    cie10_code?: boolean;
  };
  validaciones?: Validation;
  configuracion_extraccion?: ExtractionConfig;
  security?: SecurityMetadata;
}

// 8. Section Definition
export interface Section {
  id: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  obligatoria: boolean;
  campos: Field[];
}

// 9. Template Metadata
export interface TemplateMetadata {
  departamento?: string;
  nivel_complejidad?: 'basica' | 'intermedia' | 'avanzada';
  requiere_firma_digital?: boolean;
  confidencialidad_nivel?: 'publico' | 'interno' | 'confidencial' | 'altamente_confidencial';
}

// 10. Main Health Template Definition
export interface HealthTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  tipo: 'predefinida' | 'personalizada';
  version: string;
  estandares_aplicados?: ('HL7_v2' | 'FHIR_R4')[];
  metadatos?: TemplateMetadata;
  secciones: Section[];
}


// --- EXTRACTION RULES AND ENGINE CONFIG ---

export type ExtractionRuleType = 'palabra_clave' | 'regex' | 'patron_posicion' | 'busqueda_tabla' | 'modelo_ia';

export interface ExtractionRule {
    id: string;
    tipo: ExtractionRuleType;
    patron?: string | string[];
    peso: number;
    ejemplos_positivos?: string[];
    ejemplos_negativos?: string[];
    transformacion?: any; // This can be very complex, using 'any' for now
    grupos_captura?: { grupo: number; campo: string; tipo?: string }[];
    mapear_a?: Record<string, string[]>;
}


// --- ORIGINAL TYPES (to be reviewed/merged later) ---

export type SchemaFieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY_OF_STRINGS' | 'OBJECT' | 'ARRAY_OF_OBJECTS';

export interface SchemaField {
  id: string;
  name: string;
  type: SchemaFieldType;
  children?: SchemaField[];
  error?: string;
}

export interface ExtractionResult {
    id: string;
    type: 'extraction' | 'transcription';
    fileId: string;
    fileName: string;
    timestamp: string;
    extractedData?: object; // Para extracciones
    schema?: SchemaField[];   // Para extracciones
    transcription?: string; // Para transcripciones
    metadata?: Metadata; // Para metadatos generados
}

export interface Metadata {
  title: string;
  summary: string;
  keywords: string[];
}

export type Departamento = 'contabilidad' | 'finanzas' | 'marketing' | 'legal' | 'rrhh' | 'general' | 'mis_modelos';
export type TemplateType = 'factura' | 'informe' | 'contrato' | 'otro';

export interface DepartamentoInfo {
    id: Departamento;
    name: string;
    description: string;
    icon: string;
    theme?: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        cardBg: string;
        border: string;
        text: string;
        textSecondary: string;
    };
    recommendedModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    certifications?: string[];
}