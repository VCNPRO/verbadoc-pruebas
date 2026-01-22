// Vertex AI Service - 🇪🇺 Procesamiento en Europa (Bélgica)
// Fix: Use explicit file extension in import.
import type { SchemaField, SchemaFieldType } from '../types.ts';

// Helper para convertir File a base64
const fileToGenerativePart = async (file: File) => {
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
        id: 'gemini-2.5-flash',
        name: 'Estándar 🇪🇺',
        description: 'Modelo estable y probado procesado en Europa (Bélgica)',
        bestFor: 'Uso general, facturas, contratos, informes',
        costPerDoc: '~$0.0016/doc (recomendado)'
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Avanzado 🇪🇺',
        description: 'Modelo avanzado procesado en Europa (Bélgica)',
        bestFor: 'Documentos complejos, múltiples tablas, análisis profundo',
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
        const result = await callVertexAIAPI('extract', {
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: prompt },
                    generativePart
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: vertexAISchema,
            },
        });

        console.log(`✅ Extracción completada`);
        console.log(`📍 Procesado en: ${result.location || 'europe-west1'}`);

        const jsonStr = result.text.trim();
        const rawData = JSON.parse(jsonStr);

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

export type ExtractionMethod = 'coordinates' | 'ai' | 'hybrid';

export interface HybridExtractionResult {
  data: any;
  method: ExtractionMethod;
  confidence: number;
  confidencePercentage: number;
  processingTimeMs: number;
  usedFallback: boolean;
  fallbackReason?: string;
}

/**
 * Convierte un PDF a imágenes PNG usando pdf.js
 * Retorna un array de base64 strings (una por página)
 */
const convertPDFToImages = async (pdfBase64: string): Promise<string[]> => {
  // Cargar pdf.js dinámicamente
  const pdfjsLib = await import('pdfjs-dist');

  // Configurar worker solo si no está configurado (usa unpkg que funciona)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
  }

  // Decodificar base64 a ArrayBuffer
  const binaryString = atob(pdfBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Cargar el PDF
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const images: string[] = [];
  const scale = 2.0; // Mayor resolución para mejor OCR

  console.log(`📄 Convirtiendo ${pdf.numPages} páginas de PDF a imágenes...`);

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Crear canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo crear contexto de canvas');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Renderizar página
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Convertir a base64 PNG (sin el prefijo data:image/png;base64,)
    const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
    images.push(imageBase64);

    console.log(`  📷 Página ${pageNum}/${pdf.numPages} convertida`);
  }

  return images;
};

/**
 * Extracción híbrida: Primero intenta con coordenadas, luego con IA si es necesario
 * Este es el método RECOMENDADO para formularios FUNDAE
 */
export const extractWithHybridSystem = async (
  file: File,
  schema: SchemaField[],
  prompt: string,
  modelId: GeminiModel = 'gemini-2.5-flash',
  options?: {
    forceAI?: boolean;           // Forzar uso de IA (saltar coordenadas)
    forceCoordinates?: boolean;  // Forzar uso de coordenadas (no usar fallback)
    confidenceThreshold?: number; // Umbral de confianza (default: 0.5)
  }
): Promise<HybridExtractionResult> => {
  const startTime = Date.now();
  const threshold = options?.confidenceThreshold ?? 0.5;

  // Si se fuerza IA, ir directamente a Vertex AI
  if (options?.forceAI) {
    console.log('🤖 Forzando uso de IA (forceAI=true)');
    const aiData = await extractDataFromDocument(file, schema, prompt, modelId);
    return {
      data: aiData,
      method: 'ai',
      confidence: 0.9, // Asumimos alta confianza para IA
      confidencePercentage: 90,
      processingTimeMs: Date.now() - startTime,
      usedFallback: false,
    };
  }

  // PASO 1: Intentar con sistema de coordenadas
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

    // Detectar si es PDF y convertir a imágenes
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    let imageBase64ForCoordinates: string | null = null;

    if (isPDF) {
      console.log('📄 Detectado PDF - Convirtiendo a imágenes para Sistema de Coordenadas...');
      try {
        const pageImages = await convertPDFToImages(base64Data);
        if (pageImages.length > 0) {
          // Usar la primera página para extracción (formularios FUNDAE típicamente tienen datos en página 1)
          imageBase64ForCoordinates = pageImages[0];
          console.log(`✅ PDF convertido: ${pageImages.length} página(s), usando página 1 para coordenadas`);
        }
      } catch (pdfConvertError) {
        console.warn('⚠️ Error convirtiendo PDF a imagen:', pdfConvertError);
        // Continuar sin imagen, el backend detectará que es PDF y sugerirá fallback
      }
    }

    // Llamar al endpoint de coordenadas
    const coordResponse = await fetch(`${baseURL}/api/extract-coordinates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Si tenemos imagen convertida, enviarla como imageBase64
        // Si no, enviar el PDF original (el backend detectará y sugerirá fallback)
        imageBase64: imageBase64ForCoordinates,
        pdfBase64: imageBase64ForCoordinates ? undefined : base64Data,
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
        };
      }

      // Si la confianza es baja y NO se fuerza coordenadas, hacer fallback a IA
      if (coordResult.fallbackToAI && !options?.forceCoordinates) {
        console.log(`⚠️ Confianza baja (${coordResult.confidencePercentage}%), haciendo fallback a IA...`);

        // PASO 2: Fallback a IA
        console.log('🤖 PASO 2: Usando Vertex AI como fallback...');
        const aiData = await extractDataFromDocument(file, schema, prompt, modelId);

        return {
          data: aiData,
          method: 'hybrid',
          confidence: 0.85, // Confianza estimada para IA
          confidencePercentage: 85,
          processingTimeMs: Date.now() - startTime,
          usedFallback: true,
          fallbackReason: coordResult.reason || 'low_confidence',
        };
      }

      // Usar coordenadas aunque la confianza sea baja (forceCoordinates)
      return {
        data: coordResult.extractedData,
        method: 'coordinates',
        confidence: coordResult.confidence,
        confidencePercentage: coordResult.confidencePercentage,
        processingTimeMs: Date.now() - startTime,
        usedFallback: false,
      };
    }

    // Si el endpoint de coordenadas falló, ir a IA
    console.log('⚠️ Endpoint de coordenadas no disponible, usando IA directamente');
    throw new Error('Coordinates endpoint failed');

  } catch (coordError: any) {
    console.warn('⚠️ Error en sistema de coordenadas:', coordError.message);

    // Si se fuerza coordenadas, no hacer fallback
    if (options?.forceCoordinates) {
      throw new Error(`Sistema de coordenadas falló y forceCoordinates=true: ${coordError.message}`);
    }

    // FALLBACK: Usar IA
    console.log('🤖 Fallback a Vertex AI por error en coordenadas...');
    const aiData = await extractDataFromDocument(file, schema, prompt, modelId);

    return {
      data: aiData,
      method: 'ai',
      confidence: 0.85,
      confidencePercentage: 85,
      processingTimeMs: Date.now() - startTime,
      usedFallback: true,
      fallbackReason: 'coordinates_error',
    };
  }
};

// Buscar imagen en documento
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
