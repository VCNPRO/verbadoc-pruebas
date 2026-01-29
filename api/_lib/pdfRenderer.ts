/**
 * FASE 2: Renderizado de PDF a PNG de alta resolución (Server-side)
 * api/_lib/pdfRenderer.ts
 *
 * Stack de renderizado:
 * - pdfjs-dist v3.11.174 (última versión con CJS nativo — build/pdf.js)
 * - @napi-rs/canvas (Canvas API en Rust, binarios nativos por plataforma)
 *
 * Procesamiento 100% server-side en Vercel serverless.
 * PNG sin pérdida, 300 DPI, para análisis determinista de píxeles.
 */

import { createCanvas, DOMMatrix, Path2D } from '@napi-rs/canvas';

// Registrar polyfills que pdfjs-dist v3 legacy espera de 'canvas' npm
// @napi-rs/canvas los provee nativamente
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = DOMMatrix;
}
if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = Path2D;
}

// pdfjs-dist v3.11.174 — CJS nativo, compatible con Vercel serverless
import * as pdfjs from 'pdfjs-dist-legacy/legacy/build/pdf.js';

export interface RenderedPage {
  buffer: Buffer;
  width: number;
  height: number;
  pageNumber: number;
}

// Custom CanvasFactory para pdfjs usando @napi-rs/canvas
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/**
 * Renderiza un PDF a imágenes PNG individuales por página.
 *
 * @param pdfBuffer - Buffer del archivo PDF
 * @param targetDPI - Resolución de renderizado (default: 300)
 * @returns Array de páginas renderizadas como PNG buffers
 */
export async function renderPdfToImages(
  pdfBuffer: Buffer,
  targetDPI: number = 300
): Promise<RenderedPage[]> {
  const pages: RenderedPage[] = [];
  const scale = targetDPI / 72; // PDF estándar es 72 DPI

  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    const pdf = await pdfjs.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      // @ts-ignore — pdfjs v3 acepta canvasFactory
      canvasFactory: new NodeCanvasFactory(),
      disableFontFace: true,
    }).promise;

    const numPages = pdf.numPages;
    console.log(`[pdfRenderer] PDF: ${numPages} página(s), renderizando a ${targetDPI} DPI (scale ${scale.toFixed(2)})...`);

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvasFactory = new NodeCanvasFactory();
      const { canvas, context } = canvasFactory.create(
        Math.floor(viewport.width),
        Math.floor(viewport.height)
      );

      // Fondo blanco (crítico para análisis de píxeles del CV Judge)
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context as any,
        viewport,
      }).promise;

      // PNG sin pérdida — obligatorio para análisis determinista
      const pngBuffer = canvas.toBuffer('image/png');

      pages.push({
        buffer: Buffer.from(pngBuffer),
        width: canvas.width,
        height: canvas.height,
        pageNumber: i,
      });

      console.log(`[pdfRenderer] Página ${i}/${numPages}: ${canvas.width}x${canvas.height}px (${(pngBuffer.byteLength / 1024).toFixed(0)} KB)`);

      canvasFactory.destroy({ canvas, context });
      page.cleanup();
    }

    pdf.destroy();
    return pages;

  } catch (error: any) {
    throw new Error(`Error renderizando PDF server-side: ${error.message}`);
  }
}

/**
 * Renderiza una única página de un PDF.
 */
export async function renderSinglePage(
  pdfBuffer: Buffer,
  pageNumber: number,
  targetDPI: number = 300
): Promise<RenderedPage> {
  const scale = targetDPI / 72;

  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    const pdf = await pdfjs.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      // @ts-ignore
      canvasFactory: new NodeCanvasFactory(),
      disableFontFace: true,
    }).promise;

    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`Página ${pageNumber} fuera de rango (1-${pdf.numPages})`);
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvasFactory = new NodeCanvasFactory();
    const { canvas, context } = canvasFactory.create(
      Math.floor(viewport.width),
      Math.floor(viewport.height)
    );

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context as any,
      viewport,
    }).promise;

    const pngBuffer = canvas.toBuffer('image/png');

    const result: RenderedPage = {
      buffer: Buffer.from(pngBuffer),
      width: canvas.width,
      height: canvas.height,
      pageNumber,
    };

    canvasFactory.destroy({ canvas, context });
    page.cleanup();
    pdf.destroy();

    return result;

  } catch (error: any) {
    throw new Error(`Error renderizando página ${pageNumber}: ${error.message}`);
  }
}
