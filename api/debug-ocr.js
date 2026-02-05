/**
 * API ENDPOINT: /api/debug-ocr
 * Endpoint de diagnóstico para ver las coordenadas de cada palabra detectada por OCR
 *
 * Uso: Enviar POST con { imageBase64: "..." }
 * Retorna: Lista de todas las palabras con sus bounding boxes normalizados
 */

const vision = require('@google-cloud/vision');

// Configuración de credenciales
let credentials = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{')) {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
  } catch (error) {
    console.error('Error parseando credenciales:', error);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, filename } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    console.log(`🔍 DEBUG OCR: Analizando ${filename || 'imagen'}`);

    // Inicializar Vision client
    const visionClient = new vision.ImageAnnotatorClient({
      credentials: credentials || undefined,
    });

    // Convertir base64 a buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Llamar a Vision API
    const [result] = await visionClient.documentTextDetection({
      image: { content: imageBuffer },
      imageContext: { languageHints: ['es', 'en'] },
    });

    if (!result.fullTextAnnotation) {
      return res.status(200).json({
        success: false,
        error: 'No se detectó texto en la imagen',
        words: []
      });
    }

    // Extraer todas las palabras con sus coordenadas
    const words = [];
    const pages = result.fullTextAnnotation.pages || [];

    pages.forEach((page, pageIndex) => {
      const pageWidth = page.width || 1;
      const pageHeight = page.height || 1;

      page.blocks?.forEach(block => {
        block.paragraphs?.forEach(paragraph => {
          paragraph.words?.forEach(word => {
            const text = word.symbols?.map(s => s.text).join('') || '';
            const vertices = word.boundingBox?.normalizedVertices || word.boundingBox?.vertices || [];

            if (vertices.length >= 4) {
              // Calcular bounding box normalizado (0-1)
              let minX, maxX, minY, maxY;

              if (word.boundingBox?.normalizedVertices) {
                // Ya están normalizados
                minX = Math.min(vertices[0]?.x || 0, vertices[3]?.x || 0);
                maxX = Math.max(vertices[1]?.x || 0, vertices[2]?.x || 0);
                minY = Math.min(vertices[0]?.y || 0, vertices[1]?.y || 0);
                maxY = Math.max(vertices[2]?.y || 0, vertices[3]?.y || 0);
              } else {
                // Normalizar usando dimensiones de página
                minX = Math.min(vertices[0]?.x || 0, vertices[3]?.x || 0) / pageWidth;
                maxX = Math.max(vertices[1]?.x || 0, vertices[2]?.x || 0) / pageWidth;
                minY = Math.min(vertices[0]?.y || 0, vertices[1]?.y || 0) / pageHeight;
                maxY = Math.max(vertices[2]?.y || 0, vertices[3]?.y || 0) / pageHeight;
              }

              words.push({
                text,
                page: pageIndex + 1,
                box: {
                  minX: Math.round(minX * 1000) / 1000,
                  maxX: Math.round(maxX * 1000) / 1000,
                  minY: Math.round(minY * 1000) / 1000,
                  maxY: Math.round(maxY * 1000) / 1000,
                },
                // Centro de la palabra (útil para checkboxes)
                center: {
                  x: Math.round(((minX + maxX) / 2) * 1000) / 1000,
                  y: Math.round(((minY + maxY) / 2) * 1000) / 1000,
                }
              });
            }
          });
        });
      });
    });

    // Ordenar por posición Y luego X (orden de lectura)
    words.sort((a, b) => {
      if (Math.abs(a.box.minY - b.box.minY) < 0.01) {
        return a.box.minX - b.box.minX;
      }
      return a.box.minY - b.box.minY;
    });

    // Texto completo
    const fullText = result.fullTextAnnotation.text || '';

    console.log(`✅ Detectadas ${words.length} palabras`);

    return res.status(200).json({
      success: true,
      filename,
      totalWords: words.length,
      pageCount: pages.length,
      pageDimensions: pages.map((p, i) => ({ page: i + 1, width: p.width, height: p.height })),
      words,
      fullText,
      // Campos de interés para formularios FUNDAE (buscar estas palabras)
      fieldsOfInterest: [
        'Expediente', 'CIF', 'Acción', 'Grupo', 'Denominación',
        'Presencial', 'Teleformación', 'Mixta',
        'Mujer', 'Hombre', 'Edad',
        'Directivo', 'Técnico', 'Mando',
        'Dentro', 'Fuera', 'jornada'
      ],
      tip: 'Busca las palabras clave y usa sus coordenadas box.minX/maxX/minY/maxY para configurar FIELD_COORDINATES'
    });

  } catch (error) {
    console.error('❌ Error en debug-ocr:', error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
