/**
 * Servicio de Análisis de PDFs
 *
 * Detecta si un PDF contiene texto extraíble (OCR) o solo imágenes
 */

import * as pdfjsLib from 'pdfjs-dist';

// ============================================================================
// TIPOS
// ============================================================================

export type PDFType = 'ocr' | 'image' | 'mixed' | 'unknown';

export interface PDFAnalysisResult {
  type: PDFType;
  hasText: boolean;
  hasImages: boolean;
  pageCount: number;
  textPagesCount: number;
  imagePagesCount: number;
  textContentSample?: string; // Primeras 200 caracteres de texto
  confidence: 'high' | 'medium' | 'low';
  details?: string;
  // 🆕 Métricas de calidad
  textQuality?: {
    score: number;          // 0-100
    isGarbled: boolean;     // Texto ilegible/OCR malo
    hasSpecialChars: boolean; // Muchos caracteres especiales
    avgWordLength: number;  // Promedio de longitud de palabra
    readableRatio: number;  // % de texto legible
  };
  recommendedModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  processingRecommendation?: string;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

// Configurar worker de pdfjs (necesario para Node.js)
// En Node.js no usamos worker, procesamos directamente

// Umbral de texto mínimo para considerar que una página tiene texto
const MIN_TEXT_LENGTH = 10; // caracteres

// Caracteres españoles válidos (incluye tildes y ñ)
const VALID_SPANISH_CHARS = /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s.,;:!?¡¿()\-\/'"@€%&*+=#\[\]{}°ºª]+$/;

// Palabras comunes en español para detectar texto legible
const COMMON_SPANISH_WORDS = [
  'de', 'la', 'el', 'en', 'que', 'y', 'a', 'los', 'del', 'se',
  'con', 'por', 'un', 'para', 'es', 'al', 'lo', 'como', 'su', 'una',
  'no', 'las', 'más', 'le', 'ha', 'me', 'si', 'ya', 'pero', 'fue',
  'formación', 'curso', 'acción', 'grupo', 'expediente', 'empresa',
  'participante', 'evaluación', 'calidad', 'valoración', 'fecha'
];

// ============================================================================
// ANÁLISIS DE CALIDAD DE TEXTO
// ============================================================================

interface TextQualityResult {
  score: number;
  isGarbled: boolean;
  hasSpecialChars: boolean;
  avgWordLength: number;
  readableRatio: number;
}

/**
 * Analiza la calidad del texto extraído
 */
function analyzeTextQuality(text: string): TextQualityResult {
  if (!text || text.length < 10) {
    return {
      score: 0,
      isGarbled: true,
      hasSpecialChars: false,
      avgWordLength: 0,
      readableRatio: 0
    };
  }

  // 1. Separar en palabras
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  if (totalWords === 0) {
    return {
      score: 0,
      isGarbled: true,
      hasSpecialChars: false,
      avgWordLength: 0,
      readableRatio: 0
    };
  }

  // 2. Calcular longitud promedio de palabra
  const totalLength = words.reduce((sum, w) => sum + w.length, 0);
  const avgWordLength = totalLength / totalWords;

  // 3. Contar palabras con caracteres "raros"
  let wordsWithSpecialChars = 0;
  let validSpanishWords = 0;

  for (const word of words) {
    // Verificar si la palabra tiene caracteres válidos
    if (VALID_SPANISH_CHARS.test(word)) {
      validSpanishWords++;
    } else {
      wordsWithSpecialChars++;
    }
  }

  // 4. Contar palabras comunes en español encontradas
  const lowerText = text.toLowerCase();
  let commonWordsFound = 0;
  for (const commonWord of COMMON_SPANISH_WORDS) {
    if (lowerText.includes(commonWord)) {
      commonWordsFound++;
    }
  }

  // 5. Calcular ratios
  const readableRatio = validSpanishWords / totalWords;
  const hasSpecialChars = wordsWithSpecialChars / totalWords > 0.3;

  // 6. Detectar texto "garbled" (OCR malo)
  // Señales de texto ilegible:
  // - Promedio de palabra muy corto (<2) o muy largo (>15)
  // - Muy pocas palabras comunes encontradas
  // - Muchos caracteres especiales
  const isGarbled =
    avgWordLength < 2 ||
    avgWordLength > 15 ||
    (totalWords > 20 && commonWordsFound < 3) ||
    readableRatio < 0.5;

  // 7. Calcular score final (0-100)
  let score = 0;

  // Puntos por ratio de palabras legibles (hasta 40 puntos)
  score += Math.min(40, readableRatio * 40);

  // Puntos por palabras comunes encontradas (hasta 30 puntos)
  score += Math.min(30, commonWordsFound * 3);

  // Puntos por longitud de palabra razonable (hasta 20 puntos)
  if (avgWordLength >= 3 && avgWordLength <= 10) {
    score += 20;
  } else if (avgWordLength >= 2 && avgWordLength <= 12) {
    score += 10;
  }

  // Puntos por no tener caracteres especiales (hasta 10 puntos)
  if (!hasSpecialChars) {
    score += 10;
  }

  // Penalización por texto garbled
  if (isGarbled) {
    score = Math.max(0, score - 30);
  }

  return {
    score: Math.round(score),
    isGarbled,
    hasSpecialChars,
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    readableRatio: Math.round(readableRatio * 100) / 100
  };
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Analizar un PDF desde buffer para determinar su tipo
 */
export async function analyzePDFFromBuffer(buffer: Buffer): Promise<PDFAnalysisResult> {
  try {
    // Convertir buffer a Uint8Array para pdfjs
    const data = new Uint8Array(buffer);

    // Cargar documento PDF
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDocument = await loadingTask.promise;
    const pageCount = pdfDocument.numPages;

    console.log(`📄 Analizando PDF: ${pageCount} páginas`);

    let textPagesCount = 0;
    let imagePagesCount = 0;
    let totalTextLength = 0;
    let textSample = '';

    // Analizar cada página
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);

      // Extraer contenido de texto
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .trim();

      const pageTextLength = pageText.length;
      totalTextLength += pageTextLength;

      // Guardar muestra del primer texto encontrado
      if (!textSample && pageTextLength > 0) {
        textSample = pageText.substring(0, 200);
      }

      // Determinar si la página tiene texto significativo
      if (pageTextLength >= MIN_TEXT_LENGTH) {
        textPagesCount++;
        console.log(`  ✅ Página ${pageNum}: ${pageTextLength} caracteres de texto`);
      } else {
        imagePagesCount++;
        console.log(`  📷 Página ${pageNum}: Sin texto (${pageTextLength} caracteres)`);
      }
    }

    // Limpiar recursos
    await pdfDocument.cleanup();
    await pdfDocument.destroy();

    // Determinar tipo de PDF
    const hasText = textPagesCount > 0;
    const hasImages = imagePagesCount > 0;

    let type: PDFType;
    let confidence: 'high' | 'medium' | 'low';
    let details: string;

    if (textPagesCount === pageCount) {
      // Todas las páginas tienen texto
      type = 'ocr';
      confidence = 'high';
      details = `PDF con texto en todas las páginas (${totalTextLength} caracteres totales)`;
    } else if (imagePagesCount === pageCount) {
      // Todas las páginas son solo imágenes
      type = 'image';
      confidence = 'high';
      details = 'PDF escaneado sin texto extraíble';
    } else if (textPagesCount > 0 && imagePagesCount > 0) {
      // Mezcla de páginas con texto e imágenes
      type = 'mixed';
      confidence = 'medium';
      details = `PDF mixto: ${textPagesCount} páginas con texto, ${imagePagesCount} páginas sin texto`;
    } else {
      type = 'unknown';
      confidence = 'low';
      details = 'No se pudo determinar el tipo de PDF';
    }

    // 🆕 Analizar calidad del texto extraído
    const textQuality = analyzeTextQuality(textSample);

    console.log(`🔍 Resultado: ${type.toUpperCase()} (${confidence} confidence)`);
    console.log(`   - Páginas con texto: ${textPagesCount}/${pageCount}`);
    console.log(`   - Total caracteres: ${totalTextLength}`);
    console.log(`   - Calidad de texto: ${textQuality.score}/100 ${textQuality.isGarbled ? '⚠️ GARBLED' : '✅'}`);

    // 🆕 Determinar modelo recomendado
    let recommendedModel: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    let processingRecommendation: string;

    if (type === 'image') {
      // PDF escaneado sin texto → usar modelo avanzado
      recommendedModel = 'gemini-2.5-pro';
      processingRecommendation = 'PDF escaneado. Se recomienda gemini-2.5-pro para mejor precisión con imágenes.';
    } else if (type === 'ocr' && textQuality.score >= 70) {
      // PDF con buen texto → modelo estándar
      recommendedModel = 'gemini-2.5-flash';
      processingRecommendation = 'PDF con texto de buena calidad. Modelo estándar suficiente.';
    } else if (type === 'ocr' && textQuality.isGarbled) {
      // PDF con texto malo → modelo avanzado
      recommendedModel = 'gemini-2.5-pro';
      processingRecommendation = 'PDF con texto de mala calidad (posible OCR deficiente). Se recomienda modelo avanzado.';
    } else if (type === 'mixed') {
      // PDF mixto → modelo avanzado por seguridad
      recommendedModel = 'gemini-2.5-pro';
      processingRecommendation = 'PDF mixto. Se recomienda modelo avanzado para procesar páginas escaneadas.';
    } else {
      // Default → modelo estándar
      recommendedModel = 'gemini-2.5-flash';
      processingRecommendation = 'Usar modelo estándar.';
    }

    console.log(`   - Modelo recomendado: ${recommendedModel}`);

    return {
      type,
      hasText,
      hasImages,
      pageCount,
      textPagesCount,
      imagePagesCount,
      textContentSample: textSample || undefined,
      confidence,
      details,
      textQuality,
      recommendedModel,
      processingRecommendation
    };

  } catch (error: any) {
    console.error('❌ Error al analizar PDF:', error);

    return {
      type: 'unknown',
      hasText: false,
      hasImages: false,
      pageCount: 0,
      textPagesCount: 0,
      imagePagesCount: 0,
      confidence: 'low',
      details: `Error al analizar: ${error.message}`
    };
  }
}

/**
 * Analizar PDF desde base64
 */
export async function analyzePDFFromBase64(base64Data: string): Promise<PDFAnalysisResult> {
  try {
    // Remover data URI prefix si existe
    const base64Clean = base64Data.replace(/^data:application\/pdf;base64,/, '');

    // Convertir a buffer
    const buffer = Buffer.from(base64Clean, 'base64');

    return await analyzePDFFromBuffer(buffer);

  } catch (error: any) {
    return {
      type: 'unknown',
      hasText: false,
      hasImages: false,
      pageCount: 0,
      textPagesCount: 0,
      imagePagesCount: 0,
      confidence: 'low',
      details: `Error al procesar base64: ${error.message}`
    };
  }
}

/**
 * Verificar si un PDF requiere OCR
 * (retorna true si es tipo 'image' o 'mixed' con pocas páginas de texto)
 */
export function requiresOCR(analysisResult: PDFAnalysisResult): boolean {
  if (analysisResult.type === 'image') {
    return true;
  }

  if (analysisResult.type === 'mixed') {
    // Si menos del 50% de las páginas tienen texto, probablemente necesita OCR
    const textPercentage = analysisResult.textPagesCount / analysisResult.pageCount;
    return textPercentage < 0.5;
  }

  return false;
}

/**
 * Obtener descripción legible del tipo de PDF
 */
export function getPDFTypeDescription(type: PDFType, lang: 'es' | 'en' = 'es'): string {
  const descriptions = {
    es: {
      ocr: 'PDF con texto extraíble (OCR o nativo)',
      image: 'PDF escaneado (solo imágenes)',
      mixed: 'PDF mixto (texto e imágenes)',
      unknown: 'Tipo de PDF desconocido'
    },
    en: {
      ocr: 'PDF with extractable text (OCR or native)',
      image: 'Scanned PDF (images only)',
      mixed: 'Mixed PDF (text and images)',
      unknown: 'Unknown PDF type'
    }
  };

  return descriptions[lang][type];
}

export default {
  analyzePDFFromBuffer,
  analyzePDFFromBase64,
  requiresOCR,
  getPDFTypeDescription
};
