// AI Agent Service - Clasificación y Validación Inteligente
import { extractDataFromDocument, type GeminiModel } from './geminiService.ts';
import type { SchemaField } from '../types.ts';

// Tipos importados del servicio de barcode (backend)
export interface BarcodeDetectionResult {
  codesDetected: number;
  codes: DetectedCode[];
  documentType?: string;
  structuredData?: any;
  validationStatus?: 'VALID' | 'INVALID' | 'UNVERIFIED';
  processingTime: number;
}

export interface DetectedCode {
  type: string;
  rawData: string;
  parsedData?: any;
  confidence: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================
// TIPOS Y INTERFACES
// ============================================

export interface DocumentClassification {
  type: string;
  subtype?: string;
  confidence: number;
  reasoning: string;
  keyIndicators: string[];
  suggestedTemplate?: string;
  suggestedPrompt?: string;
  suggestedSchema?: SchemaField[];
  barcodeData?: BarcodeDetectionResult; // 🔥 NUEVO: Datos de códigos detectados
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  suggestions: string[];
  score: number; // 0-100
}

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestedFix?: any;
  originalValue?: any;
}

// ============================================
// VALIDACIÓN CRUZADA DE CÓDIGOS DE BARRAS Y QR
// ============================================

// NOTA: La detección de códigos QR/barras se realiza en el backend (api/services/barcodeService.ts)
// Este archivo solo contiene funciones de validación cruzada que se ejecutan en el frontend

/**
 * Valida cruzadamente datos de QR/barcode vs datos extraídos por OCR
 * @param barcodeData - Datos del código detectado
 * @param ocrData - Datos extraídos por OCR/IA
 * @returns Array de discrepancias encontradas
 */
export function crossValidateData(
  barcodeData: any,
  ocrData: any
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!barcodeData || !ocrData) return issues;

  // Validaciones específicas por tipo de documento

  // FACTURA: Comparar número, CIF, total, fecha
  if (barcodeData.numeroFactura && ocrData.numero_factura) {
    if (normalizeString(barcodeData.numeroFactura) !== normalizeString(ocrData.numero_factura)) {
      issues.push({
        field: 'numero_factura',
        severity: 'warning',
        message: `Discrepancia: QR dice "${barcodeData.numeroFactura}" pero OCR dice "${ocrData.numero_factura}"`,
        suggestedFix: barcodeData.numeroFactura, // QR tiene más confianza
        originalValue: ocrData.numero_factura
      });
    }
  }

  if (barcodeData.cif && ocrData.cliente_cif) {
    if (normalizeString(barcodeData.cif) !== normalizeString(ocrData.cliente_cif)) {
      issues.push({
        field: 'cliente_cif',
        severity: 'warning',
        message: `Discrepancia CIF: QR "${barcodeData.cif}" vs OCR "${ocrData.cliente_cif}"`,
        suggestedFix: barcodeData.cif,
        originalValue: ocrData.cliente_cif
      });
    }
  }

  if (barcodeData.total && ocrData.total) {
    const qrTotal = parseFloat(barcodeData.total);
    const ocrTotal = parseFloat(ocrData.total);
    const diff = Math.abs(qrTotal - ocrTotal);

    if (diff > 0.01) { // Tolerancia de 1 céntimo
      issues.push({
        field: 'total',
        severity: 'error',
        message: `DIFERENCIA DE IMPORTE: QR ${qrTotal.toFixed(2)}€ vs OCR ${ocrTotal.toFixed(2)}€ (diferencia: ${diff.toFixed(2)}€)`,
        suggestedFix: qrTotal,
        originalValue: ocrTotal
      });
    }
  }

  // DNI: Comparar número DNI, nombre
  if (barcodeData.dni && ocrData.numero_dni) {
    if (normalizeString(barcodeData.dni) !== normalizeString(ocrData.numero_dni)) {
      issues.push({
        field: 'numero_dni',
        severity: 'error',
        message: `DNI no coincide: PDF417 "${barcodeData.dni}" vs OCR "${ocrData.numero_dni}"`,
        suggestedFix: barcodeData.dni,
        originalValue: ocrData.numero_dni
      });
    }
  }

  if (barcodeData.nombre && ocrData.nombre_completo) {
    const barcodeNombre = normalizeString(`${barcodeData.nombre} ${barcodeData.apellidos || ''}`);
    const ocrNombre = normalizeString(ocrData.nombre_completo);

    if (barcodeNombre !== ocrNombre && !ocrNombre.includes(barcodeData.nombre)) {
      issues.push({
        field: 'nombre_completo',
        severity: 'warning',
        message: `Posible discrepancia en nombre: PDF417 vs OCR`,
        originalValue: ocrData.nombre_completo
      });
    }
  }

  // MULTA: Comparar expediente, matrícula, importe
  if (barcodeData.numeroExpediente && ocrData.expediente) {
    if (normalizeString(barcodeData.numeroExpediente) !== normalizeString(ocrData.expediente)) {
      issues.push({
        field: 'expediente',
        severity: 'warning',
        message: `Expediente: QR "${barcodeData.numeroExpediente}" vs OCR "${ocrData.expediente}"`,
        suggestedFix: barcodeData.numeroExpediente,
        originalValue: ocrData.expediente
      });
    }
  }

  if (barcodeData.importe && ocrData.importe) {
    const qrImporte = parseFloat(barcodeData.importe);
    const ocrImporte = parseFloat(ocrData.importe);
    const diff = Math.abs(qrImporte - ocrImporte);

    if (diff > 0.01) {
      issues.push({
        field: 'importe',
        severity: 'error',
        message: `IMPORTE MULTA no coincide: QR ${qrImporte.toFixed(2)}€ vs OCR ${ocrImporte.toFixed(2)}€`,
        suggestedFix: qrImporte,
        originalValue: ocrImporte
      });
    }
  }

  return issues;
}

// Helper para normalizar strings (sin espacios, mayúsculas, guiones)
function normalizeString(str: string): string {
  return str.toString().toUpperCase().replace(/[\s\-\.]/g, '');
}

// Helper para convertir File a base64 (sin prefijo data:)
async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Quitar el prefijo "data:image/jpeg;base64,"
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('No se pudo convertir a base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// CLASIFICACIÓN AUTOMÁTICA DE DOCUMENTOS
// ============================================

// Helper para convertir File a base64
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('No se pudo leer el archivo'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });

  try {
    const data = await base64EncodedDataPromise;
    return {
      inlineData: {
        data,
        mimeType: file.type,
      },
    };
  } catch (error) {
    console.error('❌ Error convirtiendo archivo a base64:', error);
    throw error;
  }
};

// Función auxiliar para llamar a la API de Vercel (sin schema)
const callVertexAIAPIRaw = async (file: File, prompt: string, model: GeminiModel): Promise<string> => {
  try {
    const baseURL = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:5173';

    const url = `${baseURL}/api/extract`;

    console.log(`📤 Llamando a ${url} con modelo ${model}`);
    console.log(`📄 Archivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const generativePart = await fileToGenerativePart(file);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        contents: {
          role: 'user',
          parts: [
            { text: prompt },
            generativePart
          ]
        },
        config: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP ${response.status}:`, errorText);
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`Error ${response.status}: ${errorMessage}`);
    }

    const result = await response.json();
    console.log('✅ Respuesta recibida del servidor');
    return result.text;

  } catch (error) {
    console.error('❌ Error en callVertexAIAPIRaw:', error);
    throw error;
  }
};

/**
 * Clasifica automáticamente un documento usando Gemini Vision
 * @param file - Archivo a clasificar (PDF, imagen)
 * @param model - Modelo Gemini a usar (por defecto: flash estándar)
 * @param apiKey - API Key para detección de códigos (opcional)
 * @returns Clasificación del documento con sugerencias
 */
export async function classifyDocument(
  file: File,
  model: GeminiModel = 'gemini-3-pro-preview',
  apiKey?: string
): Promise<DocumentClassification> {

  console.log(`🤖 Clasificando documento: ${file.name}`);
  console.log(`📏 Tamaño del archivo: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

  // Verificar tamaño del archivo (límite de Vercel: 4.5MB)
  const MAX_SIZE_MB = 4;
  const fileSizeMB = file.size / 1024 / 1024;

  if (fileSizeMB > MAX_SIZE_MB) {
    console.warn(`⚠️ Archivo demasiado grande (${fileSizeMB.toFixed(2)} MB > ${MAX_SIZE_MB} MB)`);
    throw new Error(`El archivo es demasiado grande para clasificación automática (${fileSizeMB.toFixed(1)} MB). Por favor, selecciona el tipo de documento manualmente o usa un PDF más pequeño.`);
  }

  // NOTA: La detección de códigos QR/barras se hace en el backend
  // Este valor se pasará desde el backend cuando esté disponible
  let barcodeData: BarcodeDetectionResult | null = null;

  const classificationPrompt = `Analiza este documento e identifica su tipo exacto.

TIPOS CONOCIDOS:
- factura_comercial (facturas de venta)
- factura_proveedor (facturas recibidas)
- albaran_entrega (albaranes de mercancía)
- contrato_laboral (contratos de trabajo)
- contrato_arrendamiento (contratos de alquiler)
- contrato_compraventa (contratos de venta)
- dni_frontal (DNI/NIE cara frontal)
- dni_completo (DNI ambas caras)
- pasaporte
- receta_medica (recetas médicas)
- informe_medico (informes clínicos)
- analisis_clinico (resultados de análisis)
- nomina (nóminas laborales)
- certificado_empresa
- certificado_academico
- escritura_publica (notariales)
- otro (si no encaja en ninguna categoría)

INSTRUCCIONES:
1. Examina el documento cuidadosamente
2. Identifica características clave (logos, formatos, campos típicos)
3. Determina el tipo más específico posible
4. Indica tu nivel de confianza (0-1)
5. Explica brevemente por qué clasificaste así

Responde SOLO en JSON (sin markdown):
{
  "type": "tipo_principal",
  "subtype": "subtipo_opcional",
  "confidence": 0.95,
  "reasoning": "Breve explicación de la clasificación",
  "keyIndicators": ["indicador1", "indicador2", "indicador3"]
}`;

  try {
    // Llamar directamente a la API sin schema
    console.log('🔄 Enviando documento a Vertex AI para clasificación...');
    const resultText = await callVertexAIAPIRaw(file, classificationPrompt, model);

    console.log('📥 Respuesta recibida, parseando JSON...');
    let result;
    try {
      result = JSON.parse(resultText);
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError);
      console.error('Texto recibido:', resultText.substring(0, 500));
      throw new Error('La respuesta de la IA no es un JSON válido');
    }

    if (!result.type) {
      console.error('❌ Respuesta sin campo "type":', result);
      throw new Error('La respuesta no contiene el tipo de documento');
    }

    console.log(`✅ Clasificado como: ${result.type} (${(result.confidence * 100).toFixed(0)}%)`);
    console.log(`   Razón: ${result.reasoning}`);

    // Obtener plantilla y esquema sugeridos según el tipo
    console.log('📋 Obteniendo plantilla para:', result.type);
    const templateData = await getTemplateForDocumentType(result.type);

    return {
      type: result.type,
      subtype: result.subtype,
      confidence: result.confidence,
      reasoning: result.reasoning,
      keyIndicators: result.keyIndicators || [],
      ...templateData,
      barcodeData: barcodeData || undefined // 🔥 NUEVO: Incluir datos de códigos
    };

  } catch (error) {
    console.error('❌ Error clasificando documento:', error);
    if (error instanceof Error) {
      throw new Error(`Error al clasificar: ${error.message}`);
    }
    throw new Error('No se pudo clasificar el documento. Intenta manualmente.');
  }
}

/**
 * Obtiene la plantilla predefinida según el tipo de documento
 */
async function getTemplateForDocumentType(docType: string): Promise<{
  suggestedTemplate?: string;
  suggestedPrompt?: string;
  suggestedSchema?: SchemaField[];
}> {

  // Mapeo de tipos a plantillas
  const TEMPLATES: Record<string, {
    templateId: string;
    prompt: string;
    schema: SchemaField[];
  }> = {
    'factura_comercial': {
      templateId: 'factura-comercial-v1',
      prompt: 'Extrae todos los datos clave de esta factura comercial, incluyendo cliente, productos, importes e impuestos.',
      schema: [
        { id: '1', name: 'numero_factura', type: 'STRING' },
        { id: '2', name: 'fecha_emision', type: 'STRING' },
        { id: '3', name: 'fecha_vencimiento', type: 'STRING' },
        { id: '4', name: 'cliente_nombre', type: 'STRING' },
        { id: '5', name: 'cliente_cif', type: 'STRING' },
        { id: '6', name: 'cliente_direccion', type: 'STRING' },
        { id: '7', name: 'productos', type: 'ARRAY_OF_OBJECTS', children: [
          { id: '7-1', name: 'descripcion', type: 'STRING' },
          { id: '7-2', name: 'cantidad', type: 'NUMBER' },
          { id: '7-3', name: 'precio_unitario', type: 'NUMBER' },
          { id: '7-4', name: 'importe', type: 'NUMBER' }
        ]},
        { id: '8', name: 'base_imponible', type: 'NUMBER' },
        { id: '9', name: 'iva_porcentaje', type: 'NUMBER' },
        { id: '10', name: 'iva_importe', type: 'NUMBER' },
        { id: '11', name: 'total', type: 'NUMBER' }
      ]
    },
    'factura_proveedor': {
      templateId: 'factura-proveedor-v1',
      prompt: 'Extrae los datos de esta factura recibida de proveedor.',
      schema: [
        { id: '1', name: 'numero_factura', type: 'STRING' },
        { id: '2', name: 'fecha', type: 'STRING' },
        { id: '3', name: 'proveedor_nombre', type: 'STRING' },
        { id: '4', name: 'proveedor_cif', type: 'STRING' },
        { id: '5', name: 'concepto', type: 'STRING' },
        { id: '6', name: 'base_imponible', type: 'NUMBER' },
        { id: '7', name: 'iva', type: 'NUMBER' },
        { id: '8', name: 'total', type: 'NUMBER' }
      ]
    },
    'dni_frontal': {
      templateId: 'dni-frontal-v1',
      prompt: 'Extrae todos los datos visibles del DNI/NIE español.',
      schema: [
        { id: '1', name: 'nombre_completo', type: 'STRING' },
        { id: '2', name: 'numero_dni', type: 'STRING' },
        { id: '3', name: 'fecha_nacimiento', type: 'STRING' },
        { id: '4', name: 'nacionalidad', type: 'STRING' },
        { id: '5', name: 'sexo', type: 'STRING' },
        { id: '6', name: 'fecha_expedicion', type: 'STRING' },
        { id: '7', name: 'fecha_caducidad', type: 'STRING' }
      ]
    },
    'receta_medica': {
      templateId: 'receta-medica-v1',
      prompt: 'Extrae los datos de esta receta médica.',
      schema: [
        { id: '1', name: 'paciente_nombre', type: 'STRING' },
        { id: '2', name: 'medico_nombre', type: 'STRING' },
        { id: '3', name: 'fecha', type: 'STRING' },
        { id: '4', name: 'medicamentos', type: 'ARRAY_OF_OBJECTS', children: [
          { id: '4-1', name: 'nombre', type: 'STRING' },
          { id: '4-2', name: 'dosis', type: 'STRING' },
          { id: '4-3', name: 'frecuencia', type: 'STRING' }
        ]},
        { id: '5', name: 'diagnostico', type: 'STRING' }
      ]
    },
    'nomina': {
      templateId: 'nomina-v1',
      prompt: 'Extrae los datos de esta nómina laboral.',
      schema: [
        { id: '1', name: 'trabajador_nombre', type: 'STRING' },
        { id: '2', name: 'trabajador_dni', type: 'STRING' },
        { id: '3', name: 'empresa', type: 'STRING' },
        { id: '4', name: 'periodo', type: 'STRING' },
        { id: '5', name: 'salario_base', type: 'NUMBER' },
        { id: '6', name: 'complementos', type: 'NUMBER' },
        { id: '7', name: 'total_devengado', type: 'NUMBER' },
        { id: '8', name: 'seguridad_social', type: 'NUMBER' },
        { id: '9', name: 'irpf', type: 'NUMBER' },
        { id: '10', name: 'liquido_a_percibir', type: 'NUMBER' }
      ]
    },
    'albaran_entrega': {
      templateId: 'albaran-v1',
      prompt: 'Extrae los datos de este albarán de entrega.',
      schema: [
        { id: '1', name: 'numero_albaran', type: 'STRING' },
        { id: '2', name: 'fecha', type: 'STRING' },
        { id: '3', name: 'proveedor', type: 'STRING' },
        { id: '4', name: 'cliente', type: 'STRING' },
        { id: '5', name: 'articulos', type: 'ARRAY_OF_OBJECTS', children: [
          { id: '5-1', name: 'descripcion', type: 'STRING' },
          { id: '5-2', name: 'cantidad', type: 'NUMBER' }
        ]}
      ]
    }
  };

  const template = TEMPLATES[docType];

  if (template) {
    return {
      suggestedTemplate: template.templateId,
      suggestedPrompt: template.prompt,
      suggestedSchema: template.schema
    };
  }

  // Si no hay plantilla predefinida, retornar esquema genérico
  return {
    suggestedTemplate: undefined,
    suggestedPrompt: 'Extrae la información clave de este documento.',
    suggestedSchema: [
      { id: '1', name: 'tipo_documento', type: 'STRING' },
      { id: '2', name: 'fecha', type: 'STRING' },
      { id: '3', name: 'emisor', type: 'STRING' },
      { id: '4', name: 'receptor', type: 'STRING' },
      { id: '5', name: 'informacion_relevante', type: 'STRING' }
    ]
  };
}

// ============================================
// VALIDACIÓN INTELIGENTE DE DATOS
// ============================================

/**
 * Valida los datos extraídos de un documento
 * @param extractedData - Datos extraídos a validar
 * @param schema - Esquema esperado
 * @param originalFile - Archivo original (opcional, para análisis adicional)
 * @param model - Modelo a usar
 * @param barcodeData - Datos de códigos de barras/QR (opcional, para cross-validation)
 * @returns Resultado de validación con issues detectados
 */
export async function validateExtractedData(
  extractedData: object,
  schema: SchemaField[],
  originalFile?: File,
  model: GeminiModel = 'gemini-3-pro-preview',
  barcodeData?: BarcodeDetectionResult
): Promise<ValidationResult> {

  console.log(`🔍 Validando datos extraídos...`);

  // Validación básica sin IA (más rápida y gratis)
  const basicValidation = performBasicValidation(extractedData, schema);

  // 🔥 NUEVO: Cross-validation con datos de códigos de barras/QR
  let crossValidationIssues: ValidationIssue[] = [];
  if (barcodeData && barcodeData.codesDetected > 0 && barcodeData.structuredData) {
    console.log(`🔍 Validando cruzadamente con datos de códigos detectados...`);
    crossValidationIssues = crossValidateData(barcodeData.structuredData, extractedData);

    if (crossValidationIssues.length > 0) {
      console.warn(`⚠️ Encontradas ${crossValidationIssues.length} discrepancias entre código y OCR`);
    } else {
      console.log(`✅ Datos de código coinciden con OCR`);
    }
  }

  // Si la validación básica detecta errores críticos, no gastar en IA
  if (basicValidation.issues.filter(i => i.severity === 'error').length > 3) {
    console.log(`⚠️ Validación básica detectó ${basicValidation.issues.length} problemas`);
    return {
      ...basicValidation,
      issues: [...basicValidation.issues, ...crossValidationIssues] // Incluir issues de cross-validation
    };
  }

  // Si no hay archivo original o no hay issues básicos, retornar validación básica
  if (!originalFile || (basicValidation.issues.length === 0 && crossValidationIssues.length === 0)) {
    return {
      ...basicValidation,
      issues: [...basicValidation.issues, ...crossValidationIssues]
    };
  }

  // Validación avanzada con IA (solo si es necesario)
  try {
    const validationPrompt = `Revisa estos datos extraídos de un documento y detecta ERRORES o INCONSISTENCIAS.

DATOS EXTRAÍDOS:
${JSON.stringify(extractedData, null, 2)}

ESQUEMA ESPERADO:
${JSON.stringify(schema.map(s => ({ name: s.name, type: s.type })), null, 2)}

VALIDACIONES A REALIZAR:
1. ¿Todos los campos obligatorios están completos?
2. ¿Los formatos son correctos? (fechas, números, emails, CIF/NIF, etc.)
3. ¿Hay coherencia entre campos? (ej: total = base + IVA, fechas lógicas)
4. ¿Valores sospechosos? (fechas futuras, precios negativos, textos sin sentido)
5. ¿Los datos coinciden con lo visible en el documento?

IMPORTANTE:
- Marca como "error" solo problemas graves
- Marca como "warning" inconsistencias menores
- Sugiere correcciones cuando sea posible

Responde SOLO en JSON (sin markdown):
{
  "isValid": true,
  "confidence": 0.95,
  "score": 92,
  "issues": [
    {
      "field": "nombre_campo",
      "severity": "error",
      "message": "Descripción clara del problema",
      "suggestedFix": "valor_corregido_si_aplica"
    }
  ],
  "suggestions": ["sugerencia general 1", "sugerencia 2"]
}`;

    // Llamar directamente a la API sin schema
    const resultText = await callVertexAIAPIRaw(originalFile, validationPrompt, model);
    const result = JSON.parse(resultText);

    console.log(`✅ Validación IA completada: Score ${result.score}/100`);

    return {
      isValid: result.isValid ?? true,
      confidence: result.confidence ?? 0.8,
      score: result.score ?? 85,
      issues: [...basicValidation.issues, ...crossValidationIssues, ...(result.issues || [])], // Incluir todos los issues
      suggestions: result.suggestions || []
    };

  } catch (error) {
    console.error('⚠️ Error en validación IA, usando validación básica:', error);
    return {
      ...basicValidation,
      issues: [...basicValidation.issues, ...crossValidationIssues]
    };
  }
}

/**
 * Validación básica sin IA (gratis y rápida)
 */
function performBasicValidation(data: any, schema: SchemaField[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  let filledFields = 0;
  let totalFields = 0;

  // Contar campos y validar tipos básicos
  schema.forEach(field => {
    totalFields++;
    const value = data[field.name];

    // Campo faltante
    if (value === null || value === undefined || value === '') {
      issues.push({
        field: field.name,
        severity: 'warning',
        message: `Campo vacío o faltante`,
        originalValue: value
      });
    } else {
      filledFields++;

      // Validar tipo NUMBER
      if (field.type === 'NUMBER') {
        const num = Number(value);
        if (isNaN(num)) {
          issues.push({
            field: field.name,
            severity: 'error',
            message: `Valor no es un número válido: "${value}"`,
            originalValue: value
          });
        } else if (num < 0 && !field.name.includes('descuento')) {
          issues.push({
            field: field.name,
            severity: 'warning',
            message: `Valor negativo sospechoso: ${num}`,
            originalValue: value
          });
        }
      }

      // Validar fechas (formato básico)
      if (field.name.toLowerCase().includes('fecha') && typeof value === 'string') {
        if (!isValidDateFormat(value)) {
          issues.push({
            field: field.name,
            severity: 'warning',
            message: `Formato de fecha no estándar: "${value}"`,
            originalValue: value
          });
        }
      }

      // Validar emails
      if (field.name.toLowerCase().includes('email') && typeof value === 'string') {
        if (!value.includes('@')) {
          issues.push({
            field: field.name,
            severity: 'error',
            message: `Email inválido: "${value}"`,
            originalValue: value
          });
        }
      }

      // Validar DNI/CIF/NIF español
      if ((field.name.toLowerCase().includes('dni') ||
           field.name.toLowerCase().includes('cif') ||
           field.name.toLowerCase().includes('nif')) &&
          typeof value === 'string') {
        if (!isValidSpanishID(value)) {
          issues.push({
            field: field.name,
            severity: 'warning',
            message: `Formato de DNI/CIF/NIF posiblemente incorrecto: "${value}"`,
            originalValue: value
          });
        }
      }
    }
  });

  // Calcular score
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const completeness = (filledFields / totalFields) * 100;
  const score = Math.max(0, completeness - (errorCount * 15) - (warningCount * 5));

  return {
    isValid: errorCount === 0,
    confidence: filledFields / totalFields,
    score: Math.round(score),
    issues,
    suggestions: issues.length > 0
      ? ['Revisa los campos marcados con errores o advertencias']
      : ['Los datos parecen correctos']
  };
}

// ============================================
// HELPERS DE VALIDACIÓN
// ============================================

function isValidDateFormat(date: string): boolean {
  // Acepta formatos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD de MMMM de YYYY
  const patterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    /^\d{1,2}-\d{1,2}-\d{4}$/,
    /^\d{4}-\d{1,2}-\d{1,2}$/,
    /^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}$/i
  ];
  return patterns.some(pattern => pattern.test(date));
}

function isValidSpanishID(id: string): boolean {
  // Validación básica de formato (8 dígitos + letra para DNI, o letra + 7-8 dígitos para CIF)
  const dniPattern = /^\d{8}[A-Z]$/i;
  const niePattern = /^[XYZ]\d{7}[A-Z]$/i;
  const cifPattern = /^[A-Z]\d{7,8}$/i;

  return dniPattern.test(id) || niePattern.test(id) || cifPattern.test(id);
}
