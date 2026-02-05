// Segmentation Service - Detección de múltiples documentos en PDFs
import { extractDataFromDocument, type GeminiModel } from './geminiService.ts';

// ============================================
// TIPOS Y INTERFACES
// ============================================

export interface DocumentSegment {
  id: string;
  pageNumbers: number[];  // Páginas que ocupa este documento
  documentType?: string;
  confidence: number;
  reasoning?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SegmentationResult {
  originalFileName: string;
  totalPages: number;
  segmentsFound: number;
  segments: DocumentSegment[];
  processingTime: number;
  method: 'gemini-vision' | 'manual';
}

// ============================================
// SEGMENTACIÓN CON GEMINI VISION
// ============================================

/**
 * Segmenta un PDF que puede contener múltiples documentos usando Gemini Vision
 * VENTAJA: No requiere YOLOv8, usa la IA multimodal que ya tienes integrada
 * COSTE: ~$0.0016 por análisis de PDF completo
 *
 * @param pdfFile - Archivo PDF a segmentar
 * @param model - Modelo Gemini a usar
 * @returns Resultado de segmentación con documentos detectados
 */
export async function segmentPDFWithGemini(
  pdfFile: File,
  model: GeminiModel = 'gemini-3-flash-preview'
): Promise<SegmentationResult> {

  const startTime = Date.now();

  console.log(`🔍 Analizando PDF multi-documento: ${pdfFile.name}`);

  const segmentationPrompt = `Analiza este PDF y detecta si contiene MÚLTIPLES DOCUMENTOS separados o independientes.

INSTRUCCIONES IMPORTANTES:
1. Examina TODAS las páginas del PDF
2. Identifica cuántos DOCUMENTOS DIFERENTES e INDEPENDIENTES contiene
3. Para cada documento encontrado, indica:
   - Página(s) donde aparece (puede ocupar varias páginas)
   - Tipo de documento (factura, DNI, contrato, receta, albarán, etc.)
   - Tu confianza (0-1) de que sea un documento separado
   - Breve razón de por qué lo consideras documento separado

CRITERIOS PARA DOCUMENTOS SEPARADOS:
✅ Diferentes membretados o logos de empresas
✅ Cambio drástico de formato/diseño/estructura
✅ Documentos claramente independientes (ej: factura + DNI + contrato)
✅ Diferentes tipos de documento (no páginas del mismo documento)

❌ NO CONSIDERAR SEPARADOS:
- Páginas consecutivas del mismo documento largo
- Páginas 2, 3, 4... de un contrato multi-página
- Anverso y reverso del mismo documento (salvo que se pida explícitamente)

EJEMPLOS:
- PDF con 3 facturas de diferentes proveedores → 3 documentos
- PDF con un contrato de 5 páginas → 1 documento
- PDF con factura (p.1-2) + DNI frontal (p.3) + DNI trasera (p.4) → 2 documentos (factura + DNI completo)

Responde SOLO en JSON sin markdown:
{
  "totalDocuments": 2,
  "totalPages": 5,
  "segments": [
    {
      "id": "seg_001",
      "pageNumbers": [1, 2],
      "documentType": "factura_comercial",
      "confidence": 0.95,
      "reasoning": "Factura de 2 páginas con logo Empresa ABC y desglose de productos"
    },
    {
      "id": "seg_002",
      "pageNumbers": [3, 4, 5],
      "documentType": "contrato_arrendamiento",
      "confidence": 0.98,
      "reasoning": "Contrato de alquiler de 3 páginas con cláusulas y firmas"
    }
  ]
}`;

  try {
    const result = await extractDataFromDocument(
      pdfFile,
      [],
      segmentationPrompt,
      model
    );

    const processingTime = Date.now() - startTime;

    console.log(`✅ Segmentación completada: ${result.totalDocuments || 0} documentos en ${(processingTime / 1000).toFixed(1)}s`);

    // Validar y normalizar resultado
    const segments: DocumentSegment[] = (result.segments || []).map((seg: any, idx: number) => ({
      id: seg.id || `seg_${String(idx + 1).padStart(3, '0')}`,
      pageNumbers: Array.isArray(seg.pageNumbers) ? seg.pageNumbers : [seg.pageNumber || idx + 1],
      documentType: seg.documentType,
      confidence: seg.confidence || 0.8,
      reasoning: seg.reasoning
    }));

    return {
      originalFileName: pdfFile.name,
      totalPages: result.totalPages || segments.reduce((max, seg) =>
        Math.max(max, ...seg.pageNumbers), 0
      ),
      segmentsFound: result.totalDocuments || segments.length,
      segments,
      processingTime,
      method: 'gemini-vision'
    };

  } catch (error) {
    console.error('❌ Error en segmentación:', error);
    throw new Error('No se pudo segmentar el PDF. Intenta procesarlo manualmente.');
  }
}

/**
 * Extrae un segmento específico como archivo de imagen
 * Convierte las páginas del PDF a imagen PNG
 *
 * @param originalPdf - PDF original
 * @param segment - Segmento a extraer
 * @returns File con la imagen del segmento
 */
export async function extractSegmentAsImage(
  originalPdf: File,
  segment: DocumentSegment
): Promise<File> {

  console.log(`📄 Extrayendo segmento ${segment.id} (páginas ${segment.pageNumbers.join(', ')})`);

  try {
    // Importar pdfjs dinámicamente
    const pdfjs = await import('pdfjs-dist');

    // Configurar worker
    const pdfjsVersion = pdfjs.version || '3.11.174';
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

    // Cargar PDF
    const arrayBuffer = await originalPdf.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    // Si el segmento tiene múltiples páginas, renderizar cada una y combinarlas
    const canvases: HTMLCanvasElement[] = [];

    for (const pageNum of segment.pageNumbers) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x para mejor calidad

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      canvases.push(canvas);
    }

    // Si hay múltiples páginas, crear un canvas combinado (vertical)
    let finalCanvas: HTMLCanvasElement;

    if (canvases.length === 1) {
      finalCanvas = canvases[0];
    } else {
      // Combinar verticalmente
      const totalHeight = canvases.reduce((sum, c) => sum + c.height, 0);
      const maxWidth = Math.max(...canvases.map(c => c.width));

      finalCanvas = document.createElement('canvas');
      finalCanvas.width = maxWidth;
      finalCanvas.height = totalHeight;

      const ctx = finalCanvas.getContext('2d')!;
      let currentY = 0;

      canvases.forEach(canvas => {
        ctx.drawImage(canvas, 0, currentY);
        currentY += canvas.height;
      });
    }

    // Convertir canvas a Blob y luego a File
    return new Promise((resolve, reject) => {
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo convertir el canvas a imagen'));
          return;
        }

        const fileName = `${segment.id}_${segment.documentType || 'documento'}_p${segment.pageNumbers.join('-')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        console.log(`✅ Segmento extraído: ${fileName} (${(file.size / 1024).toFixed(1)} KB)`);
        resolve(file);
      }, 'image/png', 0.95); // 95% calidad
    });

  } catch (error) {
    console.error(`❌ Error extrayendo segmento ${segment.id}:`, error);
    throw new Error(`No se pudo extraer el segmento del PDF: ${error}`);
  }
}

/**
 * Obtiene información básica de un PDF sin procesarlo completamente
 * Útil para mostrar preview rápido
 */
export async function getPDFInfo(pdfFile: File): Promise<{
  numPages: number;
  fileSize: number;
  fileName: string;
}> {

  try {
    const pdfjs = await import('pdfjs-dist');
    const pdfjsVersion = pdfjs.version || '3.11.174';
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    return {
      numPages: pdf.numPages,
      fileSize: pdfFile.size,
      fileName: pdfFile.name
    };
  } catch (error) {
    console.error('Error obteniendo info del PDF:', error);
    return {
      numPages: 0,
      fileSize: pdfFile.size,
      fileName: pdfFile.name
    };
  }
}

/**
 * Valida si un archivo es un PDF válido
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Estima el coste de segmentar un PDF
 */
export function estimateSegmentationCost(numPages: number, model: GeminiModel = 'gemini-3-flash-preview'): {
  estimatedCost: number;
  estimatedTime: number;
  currency: string;
} {

  const COSTS_PER_PAGE = {
    'gemini-3-flash-preview': 0.0016,
    'gemini-2.5-pro': 0.008
  };

  const costPerPage = COSTS_PER_PAGE[model];
  const estimatedCost = costPerPage;  // Solo se analiza una vez todo el PDF
  const estimatedTime = 5 + (numPages * 0.5); // ~5s base + 0.5s por página

  return {
    estimatedCost: Number(estimatedCost.toFixed(4)),
    estimatedTime: Math.round(estimatedTime),
    currency: 'USD'
  };
}
