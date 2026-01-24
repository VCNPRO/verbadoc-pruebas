/**
 * API ENDPOINT: /api/extract-coordinates
 * Extracción de formularios FUNDAE usando OCR + Sistema de Coordenadas
 *
 * ACTUALIZADO: Ahora procesa PDFs directamente sin conversión en frontend
 * - Más rápido y económico que IA
 * - Alta precisión para formularios estandarizados
 * - Fallback a IA si la confianza es baja
 */

const vision = require('@google-cloud/vision');

// ============================================
// COORDENADAS DE CAMPOS (del formulario FUNDAE)
// ============================================
const FIELD_COORDINATES = {
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
    },
    text_fields: {
      numero_expediente: { page: 1, box: { minX: 0.177, maxX: 0.302, minY: 0.300, maxY: 0.314 } },
      cif_empresa: { page: 1, box: { minX: 0.143, maxX: 0.287, minY: 0.318, maxY: 0.332 } },
      numero_accion: { page: 1, box: { minX: 0.407, maxX: 0.551, minY: 0.318, maxY: 0.332 } },
      numero_grupo: { page: 1, box: { minX: 0.655, maxX: 0.799, minY: 0.318, maxY: 0.332 } },
      denominacion_aaff: { page: 1, box: { minX: 0.233, maxX: 0.925, minY: 0.334, maxY: 0.348 } },
      edad: { page: 1, box: { minX: 0.143, maxX: 0.238, minY: 0.410, maxY: 0.424 } },
      lugar_trabajo: { page: 1, box: { minX: 0.690, maxX: 0.925, minY: 0.408, maxY: 0.442 } },
    },
  },
};

const VALUATION_COORDINATES = {
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
  valoracion_general_curso: {
    item_9_1: { page: 2, options: [
      { code: 'NC', box: { minX: 0.811, maxX: 0.828, minY: 0.686, maxY: 0.700 } },
      { code: '1', box: { minX: 0.836, maxX: 0.853, minY: 0.686, maxY: 0.700 } },
      { code: '2', box: { minX: 0.861, maxX: 0.878, minY: 0.686, maxY: 0.700 } },
      { code: '3', box: { minX: 0.886, maxX: 0.903, minY: 0.686, maxY: 0.700 } },
      { code: '4', box: { minX: 0.911, maxX: 0.928, minY: 0.686, maxY: 0.700 } },
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

// ============================================
// FUNCIONES DE EXTRACCIÓN
// ============================================

/**
 * Normaliza las coordenadas si están en pixels
 */
function normalizeVertices(vertices, pageWidth, pageHeight) {
  if (!vertices || vertices.length === 0) return null;

  // Si ya están normalizadas (valores entre 0 y 1)
  const firstX = vertices[0]?.x || 0;
  const firstY = vertices[0]?.y || 0;

  if (firstX <= 1 && firstY <= 1) {
    return vertices; // Ya normalizadas
  }

  // Normalizar dividiendo por dimensiones de página
  return vertices.map(v => ({
    x: pageWidth > 0 ? (v.x || 0) / pageWidth : 0,
    y: pageHeight > 0 ? (v.y || 0) / pageHeight : 0
  }));
}

function getTextInBoundingBox(box, allWords, pageWidth = 0, pageHeight = 0) {
  const wordsInBox = allWords.filter(word => {
    let wordVertices = word.boundingBox?.normalizedVertices;

    // Si no hay normalizedVertices, usar vertices y normalizar
    if (!wordVertices || wordVertices.length === 0) {
      wordVertices = normalizeVertices(word.boundingBox?.vertices, pageWidth, pageHeight);
    }

    if (!wordVertices || wordVertices.length < 4) return false;

    const wordCenterX = (wordVertices[0].x + wordVertices[1].x) / 2;
    const wordCenterY = (wordVertices[0].y + wordVertices[3].y) / 2;

    return wordCenterX >= box.minX && wordCenterX <= box.maxX &&
           wordCenterY >= box.minY && wordCenterY <= box.maxY;
  });

  if (wordsInBox.length > 0) {
    wordsInBox.sort((a, b) => {
      const aVert = a.boundingBox?.normalizedVertices || a.boundingBox?.vertices || [];
      const bVert = b.boundingBox?.normalizedVertices || b.boundingBox?.vertices || [];
      return (aVert[0]?.x || 0) - (bVert[0]?.x || 0);
    });
    return wordsInBox.map(word => word.symbols.map(s => s.text).join('')).join(' ');
  }
  return null;
}

function getCheckedValue(options, allWordsByPage, pageDimensions) {
  const foundValues = [];
  for (const option of options) {
    const pageData = allWordsByPage[option.page];
    if (!pageData) continue;

    const { words, width, height } = pageData;
    const textInBox = getTextInBoundingBox(option.box, words, width, height);
    const cleanedText = textInBox ? textInBox.toLowerCase().trim() : '';

    if (cleanedText.match(/[x✓v✔]/i)) {
      foundValues.push(option.code);
    } else if (cleanedText === option.code.toLowerCase()) {
      foundValues.push(option.code);
    }
  }

  return foundValues.length > 0 ? foundValues : null;
}

function extractValuationItem(item, allWordsByPage) {
  const pageData = allWordsByPage[item.page];
  if (!pageData) return 'NC';

  const { words, width, height } = pageData;

  for (const option of item.options) {
    const textInBox = getTextInBoundingBox(option.box, words, width, height);
    const cleanedText = textInBox ? textInBox.toLowerCase().trim() : '';

    if (cleanedText.match(/[x✓v✔]/i)) {
      return option.code;
    } else if (cleanedText === option.code.toLowerCase()) {
      return option.code;
    }
  }
  return 'NC';
}

function parseWithCoordinates(pagesData) {
  const layout = FIELD_COORDINATES.mainLayout;
  const extractedData = {};
  const allWordsByPage = {};

  // Organizar palabras por página
  pagesData.forEach((pageData, index) => {
    const pageNum = index + 1;
    allWordsByPage[pageNum] = {
      words: pageData.words,
      width: pageData.width,
      height: pageData.height
    };

    console.log(`📄 Página ${pageNum}: ${pageData.words.length} palabras, dimensiones: ${pageData.width}x${pageData.height}`);

    // Debug: mostrar primeras 3 palabras con sus coordenadas
    if (pageData.words.length > 0) {
      console.log('🔍 Muestra de palabras encontradas:');
      pageData.words.slice(0, 3).forEach((w, i) => {
        const text = w.symbols?.map(s => s.text).join('') || '';
        const nv = w.boundingBox?.normalizedVertices;
        const v = w.boundingBox?.vertices;
        if (nv && nv.length > 0) {
          console.log(`   ${i+1}. "${text}" → normalizado: (${nv[0]?.x?.toFixed(3)}, ${nv[0]?.y?.toFixed(3)})`);
        } else if (v && v.length > 0) {
          const normX = pageData.width > 0 ? (v[0]?.x / pageData.width).toFixed(3) : 'N/A';
          const normY = pageData.height > 0 ? (v[0]?.y / pageData.height).toFixed(3) : 'N/A';
          console.log(`   ${i+1}. "${text}" → pixels: (${v[0]?.x}, ${v[0]?.y}) → normalizado: (${normX}, ${normY})`);
        }
      });
    }
  });

  const totalPages = Object.keys(allWordsByPage).length;
  console.log(`📄 OCR procesado: ${totalPages} páginas total`);

  if (totalPages === 0) {
    return { data: {}, confidence: 0, fieldsExtracted: 0 };
  }

  let fieldsExtracted = 0;
  let fieldsAttempted = 0;

  // 1. Extraer campos de texto
  for (const field in layout.text_fields) {
    fieldsAttempted++;
    const textField = layout.text_fields[field];
    const pageData = allWordsByPage[textField.page];

    if (pageData) {
      const value = getTextInBoundingBox(textField.box, pageData.words, pageData.width, pageData.height);
      extractedData[field] = value;
      if (value) {
        fieldsExtracted++;
        console.log(`   ✅ ${field}: "${value}"`);
      }
    }
  }

  // 2. Extraer campos de checkbox
  for (const field in layout.checkbox_fields) {
    fieldsAttempted++;
    const options = layout.checkbox_fields[field];
    const values = getCheckedValue(options, allWordsByPage);
    extractedData[field] = values ? values[0] : null;
    if (values && values.length > 0) {
      fieldsExtracted++;
      console.log(`   ✅ ${field}: "${values[0]}"`);
    }
  }

  // 3. Extraer valoraciones (página 2)
  if (totalPages >= 2) {
    if (VALUATION_COORDINATES.organizacion_curso) {
      extractedData.organizacion_1_1 = extractValuationItem(VALUATION_COORDINATES.organizacion_curso.item_1_1, allWordsByPage);
      extractedData.organizacion_1_2 = extractValuationItem(VALUATION_COORDINATES.organizacion_curso.item_1_2, allWordsByPage);
    }
    if (VALUATION_COORDINATES.valoracion_general_curso) {
      extractedData.valoracion_general = extractValuationItem(VALUATION_COORDINATES.valoracion_general_curso.item_9_1, allWordsByPage);
    }
    if (VALUATION_COORDINATES.grado_satisfaccion_general) {
      extractedData.grado_satisfaccion = extractValuationItem(VALUATION_COORDINATES.grado_satisfaccion_general.item_10, allWordsByPage);
    }
  }

  // Calcular confianza basada en campos extraídos
  const confidence = fieldsAttempted > 0 ? fieldsExtracted / fieldsAttempted : 0;
  console.log(`📊 Campos extraídos: ${fieldsExtracted}/${fieldsAttempted}, Confianza: ${Math.round(confidence * 100)}%`);

  return { data: extractedData, confidence, fieldsExtracted };
}

// ============================================
// CONFIGURACIÓN
// ============================================

let credentials = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{')) {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
  } catch (error) {
    console.error('⚠️ Error al parsear credenciales:', error);
  }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfBase64, imageBase64, filename } = req.body;

    // Aceptar tanto pdfBase64 como imageBase64
    const contentBase64 = pdfBase64 || imageBase64;

    if (!contentBase64) {
      return res.status(400).json({ error: 'Missing pdfBase64 or imageBase64' });
    }

    console.log(`🔍 Procesando documento con Sistema de Coordenadas: ${filename || 'sin nombre'}`);
    const startTime = Date.now();

    // Verificar si tenemos credenciales
    if (!credentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('❌ No hay credenciales de Google Cloud configuradas');
      return res.status(200).json({
        success: false,
        error: 'Credenciales de Google Cloud no configuradas',
        fallbackToAI: true,
        reason: 'no_credentials'
      });
    }

    // Inicializar cliente de Vision
    let visionClient;
    try {
      visionClient = new vision.ImageAnnotatorClient({
        credentials: credentials || undefined,
      });
    } catch (clientError) {
      console.error('❌ Error inicializando Vision client:', clientError.message);
      return res.status(200).json({
        success: false,
        error: 'Error inicializando Google Vision: ' + clientError.message,
        fallbackToAI: true,
        reason: 'client_init_error'
      });
    }

    // Convertir base64 a buffer
    const contentBuffer = Buffer.from(contentBase64, 'base64');
    console.log(`📄 Tamaño del PDF: ${contentBuffer.length} bytes`);

    // Procesar PDF directamente con batchAnnotateFiles
    const request = {
      requests: [{
        inputConfig: {
          content: contentBuffer,
          mimeType: 'application/pdf',
        },
        features: [{
          type: 'DOCUMENT_TEXT_DETECTION',
        }],
        imageContext: {
          languageHints: ['es', 'en'],
        },
        // Procesar hasta 5 páginas (formularios FUNDAE tienen 2)
        pages: [1, 2, 3, 4, 5],
      }],
    };

    console.log('📡 Llamando a Google Cloud Vision para PDF...');
    const [result] = await visionClient.batchAnnotateFiles(request);

    if (!result.responses || result.responses.length === 0) {
      console.log('⚠️ Vision API no devolvió respuestas para el PDF');
      return res.status(200).json({
        success: false,
        error: 'No se pudo procesar el PDF',
        fallbackToAI: true,
        reason: 'empty_pdf_response'
      });
    }

    let pagesData = [];

    // Extraer datos de cada página
    const fileResponse = result.responses[0];
    if (fileResponse.responses) {
      fileResponse.responses.forEach((pageResponse, pageIndex) => {
        if (pageResponse.fullTextAnnotation?.pages) {
          pageResponse.fullTextAnnotation.pages.forEach(page => {
            const words = page.blocks?.flatMap(b =>
              b.paragraphs?.flatMap(par => par.words || []) || []
            ) || [];

            pagesData.push({
              pageNumber: pageIndex + 1,
              width: page.width || 0,
              height: page.height || 0,
              words: words.map(w => ({
                boundingBox: {
                  vertices: w.boundingBox?.vertices || [],
                  normalizedVertices: w.boundingBox?.normalizedVertices || [],
                },
                symbols: w.symbols?.map(s => ({ text: s.text || '' })) || [],
              })),
            });
          });
        }
      });
    }

    console.log(`📄 PDF procesado: ${pagesData.length} páginas extraídas`);

    if (pagesData.length === 0) {
      console.log('⚠️ No se encontraron páginas con texto');
      return res.status(200).json({
        success: false,
        error: 'No se encontró texto en el documento',
        fallbackToAI: true,
        reason: 'no_pages'
      });
    }

    // Parsear con coordenadas
    console.log('📐 Aplicando sistema de coordenadas...');
    const { data, confidence, fieldsExtracted } = parseWithCoordinates(pagesData);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Extracción completada en ${processingTime}ms`);

    // Si la confianza es muy baja, sugerir fallback a IA
    const CONFIDENCE_THRESHOLD = 0.5;
    if (confidence < CONFIDENCE_THRESHOLD) {
      console.log(`⚠️ Confianza baja (${Math.round(confidence * 100)}%), sugiriendo fallback a IA`);
      return res.status(200).json({
        success: true,
        extractedData: data,
        confidence,
        confidencePercentage: Math.round(confidence * 100),
        fieldsExtracted,
        processingTimeMs: processingTime,
        method: 'coordinates',
        fallbackToAI: true,
        reason: 'low_confidence',
        message: `Confianza ${Math.round(confidence * 100)}% - Se recomienda usar IA para mejor precisión`
      });
    }

    return res.status(200).json({
      success: true,
      extractedData: data,
      confidence,
      confidencePercentage: Math.round(confidence * 100),
      fieldsExtracted,
      processingTimeMs: processingTime,
      method: 'coordinates',
      fallbackToAI: false
    });

  } catch (error) {
    console.error('❌ Error en extracción por coordenadas:', error);
    return res.status(500).json({
      error: 'Error en extracción',
      message: error.message,
      fallbackToAI: true,
      reason: 'extraction_error'
    });
  }
};
