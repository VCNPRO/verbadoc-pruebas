/**
 * FASE 2: Renderizado de PDF a PNG de alta resolución
 * api/_lib/pdfRenderer.ts
 *
 * Usa Sharp para convertir páginas de PDF a PNG individuales.
 * Sharp soporta PDF via libvips en la mayoría de entornos.
 * Si no funciona, se usa fallback con el PDF en crudo.
 */

import sharp from 'sharp';

export interface RenderedPage {
  buffer: Buffer;
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Renderiza un PDF a imágenes PNG individuales por página.
 * Usa Sharp (libvips) para la conversión.
 *
 * @param pdfBuffer - Buffer del archivo PDF
 * @param dpi - Resolución de renderizado (default: 300)
 * @returns Array de páginas renderizadas
 */
export async function renderPdfToImages(
  pdfBuffer: Buffer,
  dpi: number = 300
): Promise<RenderedPage[]> {
  const pages: RenderedPage[] = [];

  try {
    // Sharp puede leer PDFs página por página usando la opción { page: N }
    // Primero, detectar cuántas páginas tiene
    const metadata = await sharp(pdfBuffer, { page: 0, density: dpi }).metadata();
    const totalPages = metadata.pages || 1;

    console.log(`[pdfRenderer] PDF tiene ${totalPages} página(s), renderizando a ${dpi} DPI...`);

    for (let i = 0; i < totalPages; i++) {
      const pageImage = sharp(pdfBuffer, { page: i, density: dpi });
      const pageMetadata = await pageImage.metadata();

      const pngBuffer = await pageImage
        .png()
        .toBuffer();

      pages.push({
        buffer: pngBuffer,
        width: pageMetadata.width || 0,
        height: pageMetadata.height || 0,
        pageNumber: i + 1, // 1-indexed
      });

      console.log(`[pdfRenderer] Página ${i + 1}/${totalPages}: ${pageMetadata.width}x${pageMetadata.height}px`);
    }

    return pages;
  } catch (sharpError: any) {
    // Si Sharp no soporta PDF en este entorno (ej: libvips sin poppler),
    // intentar método alternativo
    console.warn(`[pdfRenderer] Sharp no pudo procesar el PDF: ${sharpError.message}`);
    console.log('[pdfRenderer] Intentando método alternativo (PNG directo)...');

    // Fallback: si el input ya es una imagen (PNG/JPEG), procesarla directamente
    try {
      const img = sharp(pdfBuffer);
      const meta = await img.metadata();

      if (meta.format && ['png', 'jpeg', 'webp', 'tiff'].includes(meta.format)) {
        const pngBuffer = await img.png().toBuffer();
        return [{
          buffer: pngBuffer,
          width: meta.width || 0,
          height: meta.height || 0,
          pageNumber: 1,
        }];
      }
    } catch {
      // Ignorar - no es una imagen tampoco
    }

    throw new Error(
      `No se pudo renderizar el PDF. Sharp error: ${sharpError.message}. ` +
      `Asegúrate de que libvips tenga soporte para PDF (poppler) en este entorno.`
    );
  }
}

/**
 * Renderiza una única página de un PDF.
 * Útil para procesamiento selectivo.
 */
export async function renderSinglePage(
  pdfBuffer: Buffer,
  pageNumber: number, // 1-indexed
  dpi: number = 300
): Promise<RenderedPage> {
  const pageIndex = pageNumber - 1; // Sharp usa 0-indexed

  try {
    const pageImage = sharp(pdfBuffer, { page: pageIndex, density: dpi });
    const metadata = await pageImage.metadata();

    const pngBuffer = await pageImage.png().toBuffer();

    return {
      buffer: pngBuffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
      pageNumber,
    };
  } catch (error: any) {
    throw new Error(`Error renderizando página ${pageNumber}: ${error.message}`);
  }
}

/**
 * Obtiene el número de páginas de un PDF sin renderizar.
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const metadata = await sharp(pdfBuffer, { page: 0 }).metadata();
    return metadata.pages || 1;
  } catch {
    return 1; // Asumir 1 si falla
  }
}
