// Vertex AI Service - 🇪🇺 Procesamiento en Europa (Bélgica)
// Fix: Use explicit file extension in import.
import type { SchemaField, SchemaFieldType } from '../types.ts';
import * as pdfjs from 'pdfjs-dist';

// Configurar worker de pdfjs si no está ya configurado
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
}

// Límite seguro: archivos > 2.5 MB se comprimen (base64 añade ~33%)
const MAX_FILE_SIZE_FOR_DIRECT = 2.5 * 1024 * 1024;

// Helper: Comprimir PDF renderizando páginas a JPEG
const compressPdfToJpeg = async (file: File): Promise<{ data: string; mimeType: string }> => {
  console.log(`🗜️ Comprimiendo PDF: ${file.name} (${(file.size / 1024).toFixed(0)} KB)...`);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  // Renderizar cada página a canvas
  const pageCanvases: HTMLCanvasElement[] = [];
  const scale = 1.5; // Buena calidad sin exceso de tamaño
  let totalHeight = 0;
  let maxWidth = 0;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pageCanvases.push(canvas);
    totalHeight += viewport.height;
    maxWidth = Math.max(maxWidth, viewport.width);
  }

  // Combinar todas las páginas en una sola imagen vertical
  const combinedCanvas = document.createElement('canvas');
  combinedCanvas.width = maxWidth;
  combinedCanvas.height = totalHeight;
  const combinedCtx = combinedCanvas.getContext('2d')!;
  combinedCtx.fillStyle = '#FFFFFF';
  combinedCtx.fillRect(0, 0, maxWidth, totalHeight);

  let yOffset = 0;
  for (const pageCanvas of pageCanvases) {
    combinedCtx.drawImage(pageCanvas, 0, yOffset);
    yOffset += pageCanvas.height;
  }

  // Exportar como JPEG con calidad ajustada
  const jpegData = combinedCanvas.toDataURL('image/jpeg', 0.75).split(',')[1];
  const compressedSize = (jpegData.length * 3 / 4) / 1024;
  console.log(`✅ PDF comprimido: ${numPages} páginas → ${compressedSize.toFixed(0)} KB JPEG (escala ${scale}, calidad 75%)`);

  return { data: jpegData, mimeType: 'image/jpeg' };
};

// Helper para convertir File a base64 (con compresión automática de PDFs grandes)
const fileToGenerativePart = async (file: File) => {
  // Si es un PDF grande, comprimir renderizando a JPEG
  if (file.type === 'application/pdf' && file.size > MAX_FILE_SIZE_FOR_DIRECT) {
    const compressed = await compressPdfToJpeg(file);
    return {
      inlineData: compressed,
    };
  }

  // Archivo pequeño o no-PDF: enviar directamente
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        resolve('');
      }
    };
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

// Tipos para Vertex AI Schema
type SchemaType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';

interface VertexAISchema {
  type: SchemaType;
  properties?: any;
  required?: string[];
  items?: any;
}

// Lista de campos de valoración que deben usar ENUM restringido
const VALORACION_FIELDS = [
    'valoracion_1_1', 'valoracion_1_2',
    'valoracion_2_1', 'valoracion_2_2',
    'valoracion_3_1', 'valoracion_3_2',
    'valoracion_4_1_formadores', 'valoracion_4_1_tutores',
    'valoracion_4_2_formadores', 'valoracion_4_2_tutores',
    'valoracion_5_1', 'valoracion_5_2',
    'valoracion_6_1', 'valoracion_6_2',
    'valoracion_7_1', 'valoracion_7_2',
    'valoracion_9_1', 'valoracion_9_2', 'valoracion_9_3', 'valoracion_9_4', 'valoracion_9_5',
    'valoracion_10'
];

// Convertir nuestro schema a formato Vertex AI
// CRÍTICO: Usamos ENUM para campos de valoración para forzar valores válidos
const convertSchemaToVertexAI = (schema: SchemaField[]): VertexAISchema => {
    const properties: { [key: string]: any } = {};
    // NO usamos required - permite que el modelo omita campos

    schema.forEach(field => {
        if (field.name) {
            let fieldSchema: any = { nullable: true };

            // Campos de valoración: usar ENUM para forzar solo valores válidos
            if (VALORACION_FIELDS.includes(field.name)) {
                fieldSchema.type = 'STRING';
                // ENUM fuerza al modelo a elegir SOLO entre estos valores
                fieldSchema.enum = ['1', '2', '3', '4', 'NC', 'NA'];
            } else {
                switch (field.type) {
                    case 'STRING':
                        fieldSchema.type = 'STRING';
                        break;
                case 'NUMBER':
                    fieldSchema.type = 'NUMBER';
                    break;
                case 'BOOLEAN':
                    fieldSchema.type = 'BOOLEAN';
                    break;
                case 'ARRAY_OF_STRINGS':
                    fieldSchema.type = 'ARRAY';
                    fieldSchema.items = { type: 'STRING' };
                    break;
                case 'OBJECT':
                    if (field.children && field.children.length > 0) {
                        const nestedSchema = convertSchemaToVertexAI(field.children);
                        fieldSchema.type = 'OBJECT';
                        fieldSchema.properties = nestedSchema.properties;
                    } else {
                        fieldSchema.type = 'OBJECT';
                        fieldSchema.properties = { placeholder: { type: 'STRING' } };
                    }
                    break;
                case 'ARRAY_OF_OBJECTS':
                    fieldSchema.type = 'ARRAY';
                    if (field.children && field.children.length > 0) {
                        const nestedSchema = convertSchemaToVertexAI(field.children);
                        fieldSchema.items = {
                            type: 'OBJECT',
                            properties: nestedSchema.properties,
                        };
                    } else {
                        fieldSchema.items = {
                            type: 'OBJECT',
                            properties: { placeholder: { type: 'STRING' } }
                        };
                    }
                    break;
                }
            }
            properties[field.name] = fieldSchema;
        }
    });

    return {
        type: 'OBJECT',
        properties,
        // NO incluimos required - permite valores null/omitidos
    };
};

// Post-procesamiento: convierte null/undefined a "NC"
// Excepción: valoracion_7_x depende de modalidad
const postProcessExtraction = (data: any): any => {
    const result = { ...data };

    // Determinar valor para valoracion_7_x basado en modalidad
    const modalidad = result.modalidad?.toLowerCase() || '';
    const esPresencial = modalidad.includes('presencial') && !modalidad.includes('mixta');

    for (const key of Object.keys(result)) {
        // Si el valor es null, undefined, o string vacío
        if (result[key] === null || result[key] === undefined || result[key] === '') {
            // Caso especial: valoracion_7_x
            if (key === 'valoracion_7_1' || key === 'valoracion_7_2') {
                result[key] = esPresencial ? 'NA' : 'NC';
            } else {
                result[key] = 'NC';
            }
        }
    }

    // Asegurar que valoracion_7_x sea NA si es presencial (incluso si tiene valor)
    if (esPresencial) {
        if (result.valoracion_7_1 !== undefined) result.valoracion_7_1 = 'NA';
        if (result.valoracion_7_2 !== undefined) result.valoracion_7_2 = 'NA';
    }

    return result;
};

export type GeminiModel =
    | 'gemini-2.5-flash'
    | 'gemini-2.5-pro';

export interface ModelInfo {
    id: GeminiModel;
    name: string;
    description: string;
    bestFor: string;
    costPerDoc?: string;
    experimental?: boolean;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        description: 'Modelo más preciso para formularios FUNDAE (5/5 en tests)',
        bestFor: 'FUNDAE, checkboxes, formularios manuscritos',
        costPerDoc: '~$0.01/doc (recomendado)'
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Estándar',
        description: 'Modelo estable y probado',
        bestFor: 'Uso general, facturas, contratos, informes',
        costPerDoc: '~$0.0016/doc'
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Avanzado',
        description: 'Modelo avanzado',
        bestFor: 'Documentos complejos, múltiples tablas',
        costPerDoc: '~$0.008/doc'
    }
];

// Función auxiliar para llamar a la API de Vercel
const callVertexAIAPI = async (endpoint: string, body: any): Promise<any> => {
    // Determinar la URL base según el entorno
    const baseURL = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:5173';

    const url = `${baseURL}/api/${endpoint}`;

    console.log(`🇪🇺 Llamando a Vertex AI Europa: ${url}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

// Generar schema desde prompt
export const generateSchemaFromPrompt = async (
    prompt: string,
    modelId: GeminiModel = 'gemini-2.5-flash'
): Promise<SchemaField[]> => {
    const analysisPrompt = `Analiza el siguiente prompt de extracción de datos y genera una lista de campos JSON que se necesitan extraer.

Prompt del usuario:
"${prompt}"

INSTRUCCIONES:
1. Identifica TODOS los datos que el usuario quiere extraer
2. Para cada dato, crea un campo con:
   - name: nombre del campo en snake_case (sin espacios, sin tildes, ej: "nombre_paciente")
   - type: uno de estos tipos: STRING, NUMBER, BOOLEAN, ARRAY_OF_STRINGS, ARRAY_OF_OBJECTS
   - children: SOLO si type es ARRAY_OF_OBJECTS, define los sub-campos del objeto
3. Si menciona una lista o varios elementos del mismo tipo, usa ARRAY_OF_STRINGS
4. Si menciona objetos complejos con sub-campos, usa ARRAY_OF_OBJECTS y define los children

Responde SOLO con un JSON con este formato:
{
  "fields": [
    {
      "name": "nombre_campo",
      "type": "STRING"
    },
    {
      "name": "campo_complejo",
      "type": "ARRAY_OF_OBJECTS",
      "children": [
        {"name": "subcampo1", "type": "STRING"},
        {"name": "subcampo2", "type": "NUMBER"}
      ]
    }
  ]
}`;

    try {
        const result = await callVertexAIAPI('extract', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [{ text: analysisPrompt }]
            },
            config: {
                responseMimeType: 'application/json',
            },
        });

        const jsonStr = result.text.trim();
        const parsed = JSON.parse(jsonStr);

        // Agregar IDs a los campos
        const addIdsToFields = (fields: any[], prefix: string = ''): SchemaField[] => {
            return fields.map((field: any, index: number) => {
                const id = prefix ? `${prefix}-${index}` : `field-${Date.now()}-${index}`;
                return {
                    id,
                    name: field.name,
                    type: field.type as SchemaFieldType,
                    children: field.children && field.children.length > 0
                        ? addIdsToFields(field.children, `${id}-child`)
                        : undefined
                };
            });
        };

        return addIdsToFields(parsed.fields);
    } catch (error) {
        console.error('Error al generar schema desde prompt:', error);
        throw new Error('No se pudo generar el schema automáticamente. Intenta definir los campos manualmente.');
    }
};

// Extraer datos de documento
export const extractDataFromDocument = async (
    file: File,
    schema: SchemaField[],
    prompt: string,
    modelId: GeminiModel = 'gemini-2.5-flash'
): Promise<object> => {
    const generativePart = await fileToGenerativePart(file);

    // Filtrar campos válidos
    const filterValidFields = (fields: SchemaField[]): SchemaField[] => {
        return fields
            .filter(f => f.name.trim() !== '')
            .map(f => ({
                ...f,
                children: f.children ? filterValidFields(f.children) : undefined
            }));
    };

    const validSchemaFields = filterValidFields(schema);
    if (validSchemaFields.length === 0) {
        throw new Error('El esquema está vacío o no contiene campos con nombre válidos.');
    }

    const vertexAISchema = convertSchemaToVertexAI(validSchemaFields);

    console.log(`📄 Procesando: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    console.log(`🤖 Modelo: ${modelId}`);
    console.log(`🇪🇺 Región: europe-west1 (Bélgica)`);

    try {
        // 🔥 CAMBIO: Usar /api/extract-ai para extracción DIRECTA con el prompt del frontend
        // Esto bypasea el sistema de plantillas y envía el prompt directamente a Gemini
        const result = await callVertexAIAPI('extract-ai', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: prompt },
                    generativePart
                ]
            },
            schema: validSchemaFields, // Enviar schema para que el backend lo use
            config: {
                responseMimeType: 'application/json',
                responseSchema: vertexAISchema,
            },
        });

        console.log(`✅ Extracción IA DIRECTA completada`);
        console.log(`📍 Procesado en: ${result.location || 'europe-west1'}`);
        console.log(`📊 Método: ${result.method || 'ai_direct'}`);

        // El resultado puede venir en extractedData o text
        let rawData: any;
        if (result.extractedData) {
            rawData = result.extractedData;
        } else if (result.text) {
            rawData = JSON.parse(result.text.trim());
        } else {
            throw new Error('Respuesta vacía del servidor');
        }

        // Post-procesamiento: convertir null a "NC" y manejar valoracion_7_x
        const processedData = postProcessExtraction(rawData);
        console.log(`🔄 Post-procesamiento aplicado (null → NC, valoracion_7 según modalidad)`);

        return processedData;
    } catch (error) {
        console.error('Error al llamar a Vertex AI:', error);
        if (error instanceof Error) {
            throw new Error(`Error de Vertex AI: ${error.message}`);
        }
        throw new Error('Ocurrió un error desconocido al comunicarse con Vertex AI.');
    }
};

// Transcribir documento completo
export const transcribeDocument = async (
    file: File,
    modelId: GeminiModel = 'gemini-2.5-flash'
): Promise<string> => {
    const generativePart = await fileToGenerativePart(file);
    const prompt = `Extrae el texto completo de este documento. Mantén la estructura original, incluyendo párrafos y saltos de línea. No resumas ni alteres el contenido. Devuelve únicamente el texto extraído.`;

    console.log(`📄 Transcribiendo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    console.log(`🤖 Modelo: ${modelId}`);
    console.log(`🇪🇺 Región: europe-west1 (Bélgica)`);

    try {
        const result = await callVertexAIAPI('extract', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: prompt },
                    generativePart
                ]
            },
            // No se especifica responseMimeType para obtener texto plano
        });

        console.log(`✅ Transcripción completada`);
        console.log(`📍 Procesado en: ${result.location || 'europe-west1'}`);

        return result.text.trim();
    } catch (error) {
        console.error('Error al llamar a Vertex AI para transcribir:', error);
        if (error instanceof Error) {
            throw new Error(`Error de Vertex AI: ${error.message}`);
        }
        throw new Error('Ocurrió un error desconocido al comunicarse con Vertex AI.');
    }
};

// Transcribir documento manuscrito (HTR)
export const transcribeHandwrittenDocument = async (
    file: File,
    modelId: GeminiModel = 'gemini-2.5-pro'
): Promise<string> => {
    const generativePart = await fileToGenerativePart(file);
    const prompt = `Este documento contiene texto manuscrito. Transcríbelo con la mayor precisión posible, prestando especial atención a la caligrafía, la estructura y los saltos de línea. No resumas ni alteres el contenido. Devuelve únicamente el texto transcrito.`;

    console.log(`✍️  Transcribiendo (HTR): ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    console.log(`🤖 Modelo: ${modelId}`);
    console.log(`🇪🇺 Región: europe-west1 (Bélgica)`);

    try {
        const result = await callVertexAIAPI('extract', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: prompt },
                    generativePart
                ]
            },
        });

        console.log(`✅ Transcripción (HTR) completada`);
        console.log(`📍 Procesado en: ${result.location || 'europe-west1'}`);

        return result.text.trim();
    } catch (error) {
        console.error('Error al llamar a Vertex AI para HTR:', error);
        if (error instanceof Error) {
            throw new Error(`Error de Vertex AI (HTR): ${error.message}`);
        }
        throw new Error('Ocurrió un error desconocido al comunicarse con Vertex AI para HTR.');
    }
};

// Generar metadatos a partir de texto
export const generateMetadata = async (
    text: string,
    modelId: GeminiModel = 'gemini-2.5-flash'
): Promise<{ title: string; summary: string; keywords: string[] }> => {
    const prompt = `A partir del siguiente texto, genera metadatos útiles.

Texto:
---
${text.substring(0, 8000)}...
---

INSTRUCCIONES:
1.  **Título:** Crea un título breve y descriptivo que resuma el documento.
2.  **Resumen:** Escribe un resumen conciso de 2-3 frases sobre el contenido principal.
3.  **Palabras Clave:** Extrae entre 5 y 10 palabras o frases clave que representen los temas principales.

Devuelve la respuesta únicamente en formato JSON con la siguiente estructura:
{
  "title": "string",
  "summary": "string",
  "keywords": ["string"]
}`;

    console.log(`🧠 Generando metadatos con el modelo: ${modelId}`);

    try {
        const result = await callVertexAIAPI('extract', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [{ text: prompt }]
            },
            config: {
                responseMimeType: 'application/json',
            },
        });

        console.log(`✅ Metadatos generados`);
        const jsonStr = result.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('Error al generar metadatos:', error);
        if (error instanceof Error) {
            throw new Error(`Error de Vertex AI (Metadata): ${error.message}`);
        }
        throw new Error('Ocurrió un error desconocido al generar los metadatos.');
    }
};

// Analizar tipo de PDF antes de procesamiento
export const analyzePDFType = async (file: File): Promise<{
    type: 'ocr' | 'image' | 'mixed' | 'unknown';
    hasText: boolean;
    pageCount: number;
    textPagesCount: number;
    requiresOCR: boolean;
    confidence: 'high' | 'medium' | 'low';
}> => {
    try {
        console.log('🔍 Iniciando análisis de tipo de PDF...');

        // Convertir PDF a base64
        const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result.split(',')[1]);
                } else {
                    reject(new Error('No se pudo leer el archivo'));
                }
            };
            reader.onerror = () => reject(new Error('Error al leer archivo'));
            reader.readAsDataURL(file);
        });

        const base64Data = await base64EncodedDataPromise;
        console.log('📤 Enviando PDF al servidor para análisis...');

        // Llamar al servicio de análisis de PDF
        const response = await fetch('/api/analyze-pdf-type', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                file: base64Data,
                filename: file.name
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error del servidor:', response.status, errorText);
            throw new Error(`Error al analizar PDF: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Análisis recibido:', result.analysis);
        return result.analysis;

    } catch (error) {
        console.error('❌ Error al analizar tipo de PDF:', error);
        console.warn('⚠️  Continuando sin análisis de tipo...');
        // Si falla, asumir que es desconocido y usar método normal
        return {
            type: 'unknown',
            hasText: false,
            pageCount: 0,
            textPagesCount: 0,
            requiresOCR: false, // Cambiado a false para usar método normal si falla
            confidence: 'low'
        };
    }
};

// Extraer datos de PDF escaneado (optimizado para imágenes)
export const extractDataFromScannedDocument = async (
    file: File,
    schema: SchemaField[],
    prompt: string,
    modelId: GeminiModel = 'gemini-2.5-pro' // Usar modelo avanzado por defecto
): Promise<object> => {
    const generativePart = await fileToGenerativePart(file);

    // Filtrar campos válidos
    const filterValidFields = (fields: SchemaField[]): SchemaField[] => {
        return fields
            .filter(f => f.name.trim() !== '')
            .map(f => ({
                ...f,
                children: f.children ? filterValidFields(f.children) : undefined
            }));
    };

    const validSchemaFields = filterValidFields(schema);
    if (validSchemaFields.length === 0) {
        throw new Error('El esquema está vacío o no contiene campos con nombre válidos.');
    }

    const vertexAISchema = convertSchemaToVertexAI(validSchemaFields);

    // Prompt optimizado para PDFs escaneados
    const enhancedPrompt = `${prompt}

IMPORTANTE: Este es un documento escaneado (imagen). Por favor:
1. Analiza la imagen cuidadosamente
2. Lee todo el texto visible, incluso si la calidad no es perfecta
3. Presta atención a números, fechas y datos específicos
4. Si algún dato no es legible, devuelve null en lugar de inventar
5. Sé especialmente cuidadoso con la precisión de los datos extraídos`;

    console.log(`📷 Procesando PDF ESCANEADO: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    console.log(`🤖 Modelo AVANZADO: ${modelId}`);
    console.log(`🇪🇺 Región: europe-west1 (Bélgica)`);

    try {
        const result = await callVertexAIAPI('extract', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: enhancedPrompt },
                    generativePart
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: vertexAISchema,
            },
        });

        console.log(`✅ Extracción de PDF escaneado completada`);
        console.log(`📍 Procesado en: ${result.location || 'europe-west1'}`);

        const jsonStr = result.text.trim();
        const rawData = JSON.parse(jsonStr);

        // Post-procesamiento: convertir null a "NC" y manejar valoracion_7_x
        const processedData = postProcessExtraction(rawData);
        console.log(`🔄 Post-procesamiento aplicado (null → NC, valoracion_7 según modalidad)`);

        return processedData;
    } catch (error) {
        console.error('Error al llamar a Vertex AI para PDF escaneado:', error);
        if (error instanceof Error) {
            throw new Error(`Error de Vertex AI (Scanned PDF): ${error.message}`);
        }
        throw new Error('Ocurrió un error desconocido al procesar el PDF escaneado.');
    }
};

// ============================================
// SISTEMA HÍBRIDO: Coordenadas + IA
// ============================================

// 🔧 CONFIGURACIÓN TEMPORAL: Desactivar coordenadas para procesamiento masivo
const SKIP_COORDINATES_SYSTEM = true; // Cambiar a false para reactivar coordenadas

export type ExtractionMethod = 'coordinates' | 'ai' | 'hybrid' | 'ai_escalated';

export interface HybridExtractionResult {
  data: any;
  method: ExtractionMethod;
  confidence: number;
  confidencePercentage: number;
  processingTimeMs: number;
  usedFallback: boolean;
  fallbackReason?: string;
  modelUsed: GeminiModel;        // 🆕 Qué modelo procesó el documento
  modelEscalated: boolean;       // 🆕 Si se escaló a modelo superior
  attempts: number;              // 🆕 Número de intentos
}

/**
 * Extracción con IA y escalado automático de modelos
 *
 * FLUJO ACTUAL (SKIP_COORDINATES_SYSTEM = true):
 * 1. Intenta con gemini-2.5-flash
 * 2. Si confianza < 80%, escala a gemini-2.5-pro
 * 3. Si aún hay dudas, marca para revisión
 *
 * Este es el método RECOMENDADO para procesamiento masivo FUNDAE
 */
export const extractWithHybridSystem = async (
  file: File,
  schema: SchemaField[],
  prompt: string,
  modelId: GeminiModel = 'gemini-2.5-flash',
  options?: {
    forceAI?: boolean;           // Forzar uso de IA (saltar coordenadas)
    forceCoordinates?: boolean;  // Forzar uso de coordenadas (no usar fallback)
    confidenceThreshold?: number; // Umbral de confianza (default: 0.8)
    enableModelEscalation?: boolean; // Habilitar escalado automático (default: true)
  }
): Promise<HybridExtractionResult> => {
  const startTime = Date.now();
  const threshold = options?.confidenceThreshold ?? 0.8;
  const enableEscalation = options?.enableModelEscalation ?? true;

  // 🧠 PASO 0: Intentar extracción híbrida CV Judge si no se fuerza IA pura
  if (!options?.forceAI && !options?.forceCoordinates) {
    try {
      console.log('🧠 Intentando extracción híbrida CV Judge + Gemini...');
      const hybridResult = await extractWithHybridCVJudge(file, schema, prompt, modelId);
      if (!hybridResult.usedFallback) {
        console.log(`✅ Híbrido exitoso: ${hybridResult.confidencePercentage}% confianza`);
        return hybridResult;
      }
      console.log(`⚠️ Híbrido usó fallback: ${hybridResult.fallbackReason}`);
      // Si el fallback fue por error del endpoint (flag desactivado), continuar con IA directa
    } catch (hybridError: any) {
      console.log(`⚠️ Híbrido no disponible: ${hybridError.message}. Usando IA directa.`);
    }
  }

  // 🔧 MODO PROCESAMIENTO MASIVO: Saltar coordenadas, ir directo a IA
  if (SKIP_COORDINATES_SYSTEM || options?.forceAI) {
    console.log('🚀 MODO IA DIRECTA (coordenadas desactivadas para procesamiento masivo)');

    let currentModel: GeminiModel = 'gemini-2.5-flash';
    let attempts = 0;
    let modelEscalated = false;
    let lastData: any = null;
    let lastConfidence = 0;

    // INTENTO 1: gemini-2.5-flash (modelo rápido y económico)
    try {
      attempts++;
      console.log(`🤖 Intento ${attempts}: Usando ${currentModel}...`);

      const aiData = await extractDataFromDocument(file, schema, prompt, currentModel);
      lastData = aiData;

      // Calcular confianza basada en campos extraídos
      const totalFields = schema.length;
      const extractedFields = Object.entries(aiData).filter(([_, v]) =>
        v !== null && v !== undefined && v !== '' && v !== 'NC'
      ).length;
      lastConfidence = extractedFields / totalFields;

      console.log(`📊 Resultado Flash: ${Math.round(lastConfidence * 100)}% confianza (${extractedFields}/${totalFields} campos)`);

      // Si la confianza es suficiente, devolver resultado
      if (lastConfidence >= threshold) {
        console.log(`✅ Confianza suficiente con ${currentModel}`);
        return {
          data: aiData,
          method: 'ai',
          confidence: lastConfidence,
          confidencePercentage: Math.round(lastConfidence * 100),
          processingTimeMs: Date.now() - startTime,
          usedFallback: false,
          modelUsed: currentModel,
          modelEscalated: false,
          attempts: attempts,
        };
      }

      // INTENTO 2: Escalar a gemini-2.5-pro si está habilitado
      if (enableEscalation && lastConfidence < threshold) {
        console.log(`⚠️ Confianza baja (${Math.round(lastConfidence * 100)}%), escalando a modelo superior...`);

        currentModel = 'gemini-2.5-pro';
        modelEscalated = true;
        attempts++;

        console.log(`🤖 Intento ${attempts}: Usando ${currentModel} (modelo avanzado)...`);

        const proData = await extractDataFromDocument(file, schema, prompt, currentModel);
        lastData = proData;

        // Recalcular confianza
        const proExtractedFields = Object.entries(proData).filter(([_, v]) =>
          v !== null && v !== undefined && v !== '' && v !== 'NC'
        ).length;
        lastConfidence = proExtractedFields / totalFields;

        console.log(`📊 Resultado Pro: ${Math.round(lastConfidence * 100)}% confianza (${proExtractedFields}/${totalFields} campos)`);
      }

      // Devolver el mejor resultado obtenido
      const finalMethod: ExtractionMethod = modelEscalated ? 'ai_escalated' : 'ai';

      return {
        data: lastData,
        method: finalMethod,
        confidence: lastConfidence,
        confidencePercentage: Math.round(lastConfidence * 100),
        processingTimeMs: Date.now() - startTime,
        usedFallback: modelEscalated,
        fallbackReason: modelEscalated ? 'low_confidence_escalated_to_pro' : undefined,
        modelUsed: currentModel,
        modelEscalated: modelEscalated,
        attempts: attempts,
      };

    } catch (error: any) {
      console.error(`❌ Error en extracción IA:`, error.message);
      throw new Error(`Error de extracción: ${error.message}`);
    }
  }

  // ============================================
  // MODO COORDENADAS (cuando SKIP_COORDINATES_SYSTEM = false)
  // ============================================
  console.log('📐 PASO 1: Intentando extracción con Sistema de Coordenadas...');

  try {
    // Convertir archivo a base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('No se pudo leer el archivo'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });

    // Determinar URL base
    const baseURL = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:5173';

    console.log('📄 Enviando PDF directamente al backend...');

    // Llamar al endpoint de coordenadas - solo PDFs
    const coordResponse = await fetch(`${baseURL}/api/extract-coordinates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfBase64: base64Data,
        filename: file.name
      })
    });

    if (coordResponse.ok) {
      const coordResult = await coordResponse.json();

      console.log(`📊 Resultado coordenadas: confianza=${coordResult.confidencePercentage}%, campos=${coordResult.fieldsExtracted}`);

      // Si la confianza es suficiente o se fuerza coordenadas, usar este resultado
      if (coordResult.confidence >= threshold || options?.forceCoordinates) {
        console.log('✅ Usando resultado del Sistema de Coordenadas');
        return {
          data: coordResult.extractedData,
          method: 'coordinates',
          confidence: coordResult.confidence,
          confidencePercentage: coordResult.confidencePercentage,
          processingTimeMs: Date.now() - startTime,
          usedFallback: false,
          modelUsed: 'gemini-2.5-flash', // Coordenadas usan flash internamente
          modelEscalated: false,
          attempts: 1,
        };
      }

      // Si la confianza es baja, hacer fallback a IA con escalado
      if (!options?.forceCoordinates) {
        console.log(`⚠️ Confianza baja (${coordResult.confidencePercentage}%), escalando a IA...`);

        // Usar el sistema de IA con escalado
        const aiResult = await extractWithHybridSystem(file, schema, prompt, modelId, {
          ...options,
          forceAI: true,
        });

        return {
          ...aiResult,
          method: 'hybrid',
          usedFallback: true,
          fallbackReason: 'coordinates_low_confidence',
        };
      }
    }

    throw new Error('Coordinates endpoint failed');

  } catch (coordError: any) {
    console.warn('⚠️ Error en sistema de coordenadas:', coordError.message);

    if (options?.forceCoordinates) {
      throw new Error(`Sistema de coordenadas falló: ${coordError.message}`);
    }

    // Fallback a IA con escalado
    console.log('🤖 Fallback a IA por error en coordenadas...');
    const aiResult = await extractWithHybridSystem(file, schema, prompt, modelId, {
      ...options,
      forceAI: true,
    });

    return {
      ...aiResult,
      usedFallback: true,
      fallbackReason: 'coordinates_error',
    };
  }
};

// Buscar imagen en documento
// ============================================
// EXTRACCIÓN HÍBRIDA: CV Judge + Gemini Texto
// ============================================

/**
 * Extracción híbrida usando CV Judge para checkboxes y Gemini para texto.
 * Activar con USE_HYBRID_EXTRACTION=true
 *
 * @param file - Archivo PDF/imagen
 * @param schema - Schema de campos FUNDAE
 * @param prompt - Prompt de extracción (se ignora, se usa text-only prompt)
 * @param modelId - Modelo Gemini para campos de texto
 */
export const extractWithHybridCVJudge = async (
  file: File,
  schema: SchemaField[],
  prompt: string,
  modelId: GeminiModel = 'gemini-2.5-flash'
): Promise<HybridExtractionResult> => {
  const startTime = Date.now();

  console.log('🧠 MODO HÍBRIDO: CV Judge (checkboxes) + Gemini (texto)');

  try {
    // Enviar PDF base64 al backend — renderizado 100% server-side
    // (pdfjs-dist + @napi-rs/canvas en Vercel serverless)
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('No se pudo leer el archivo'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });

    const baseURL = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:5173';

    const response = await fetch(`${baseURL}/api/extract-hybrid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfBase64: base64Data,
        filename: file.name,
        model: modelId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();

    console.log(`✅ Híbrido completado: ${result.overallConfidence}% confianza`);
    console.log(`📊 Campos revisión humana: ${result.fieldsNeedingReview?.length || 0}`);

    return {
      data: result.extractedData,
      method: 'hybrid' as ExtractionMethod,
      confidence: result.overallConfidence / 100,
      confidencePercentage: result.overallConfidence,
      processingTimeMs: Date.now() - startTime,
      usedFallback: false,
      modelUsed: modelId,
      modelEscalated: false,
      attempts: 1,
    };
  } catch (error: any) {
    console.error('❌ Error en extracción híbrida:', error.message);
    // Fallback al sistema IA puro
    console.log('🔄 Fallback a extracción IA pura...');
    const aiResult = await extractWithHybridSystem(file, schema, prompt, modelId, { forceAI: true });
    return {
      ...aiResult,
      usedFallback: true,
      fallbackReason: `hybrid_error: ${error.message}`,
    };
  }
};

export const searchImageInDocument = async (
    documentFile: File,
    referenceImageFile: File,
    modelId: GeminiModel = 'gemini-2.5-flash'
): Promise<{ found: boolean; description: string; location?: string; confidence?: string }> => {
    const documentPart = await fileToGenerativePart(documentFile);
    const referencePart = await fileToGenerativePart(referenceImageFile);

    const promptText = `Analiza el documento y busca si contiene una imagen o logo similar a la imagen de referencia proporcionada.

Proporciona la respuesta en formato JSON con los siguientes campos:
- found: boolean (true si se encontró una imagen similar, false si no)
- description: string (descripción de lo que encontraste o no encontraste)
- location: string (opcional, ubicación aproximada en el documento)
- confidence: string (opcional, nivel de confianza: "alta", "media", "baja")`;

    try {
        const result = await callVertexAIAPI('extract', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: promptText },
                    { text: 'Imagen de referencia a buscar:' },
                    referencePart,
                    { text: 'Documento donde buscar:' },
                    documentPart
                ]
            },
            config: {
                responseMimeType: 'application/json',
            },
        });

        const jsonStr = result.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('Error al buscar imagen en documento:', error);
        if (error instanceof Error) {
            throw new Error(`Error de búsqueda: ${error.message}`);
        }
        throw new Error('Ocurrió un error desconocido al buscar la imagen.');
    }
};
