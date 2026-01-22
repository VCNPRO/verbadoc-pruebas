/**
 * PdfViewerEnhanced.tsx
 *
 * Visor PDF profesional con:
 * - Zoom in/out/reset
 * - Navegación de páginas
 * - Highlights superpuestos para errores de validación
 * - Click en highlight → navega a error correspondiente
 * - Sincronización bidireccional con panel de errores
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Los CSS de react-pdf se importan desde index.html para evitar problemas con Vite
// import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
// import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configurar worker de PDF.js - usar versión local para evitar problemas de CDN
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PdfHighlight {
  id: string;
  pageNumber: number;
  fieldName: string;
  errorType: string;
  errorMessage: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  // Coordenadas relativas al PDF (0-1)
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfViewerEnhancedProps {
  pdfUrl: string | null;
  highlights?: PdfHighlight[];
  currentErrorId?: string | null;
  onHighlightClick?: (highlight: PdfHighlight) => void;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PdfViewerEnhanced({
  pdfUrl,
  highlights = [],
  currentErrorId = null,
  onHighlightClick,
  className = '',
}: PdfViewerEnhancedProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // PDF LOADING
  // ============================================================================

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    console.log(`📄 PDF cargado: ${numPages} páginas`);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('❌ Error al cargar PDF:', error);
    setError('Error al cargar el PDF');
    setLoading(false);
  }, []);

  // ============================================================================
  // ZOOM CONTROLS
  // ============================================================================

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const zoomReset = useCallback(() => {
    setScale(1.0);
  }, []);

  const zoomFit = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      // Ancho típico de página A4: 595 puntos
      const fitScale = (containerWidth - 40) / 595;
      setScale(Math.max(0.5, Math.min(fitScale, 2.0)));
    }
  }, []);

  // ============================================================================
  // PAGE NAVIGATION
  // ============================================================================

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= numPages) {
        setPageNumber(page);
      }
    },
    [numPages]
  );

  const previousPage = useCallback(() => {
    goToPage(pageNumber - 1);
  }, [pageNumber, goToPage]);

  const nextPage = useCallback(() => {
    goToPage(pageNumber + 1);
  }, [pageNumber, goToPage]);

  // ============================================================================
  // HIGHLIGHTS
  // ============================================================================

  const highlightsForCurrentPage = highlights.filter(
    (h) => h.pageNumber === pageNumber
  );

  const handleHighlightClick = useCallback(
    (highlight: PdfHighlight) => {
      console.log('🔍 Click en highlight:', highlight.fieldName);
      if (onHighlightClick) {
        onHighlightClick(highlight);
      }
    },
    [onHighlightClick]
  );

  // Navegar automáticamente a la página del error actual
  useEffect(() => {
    if (currentErrorId && highlights.length > 0) {
      const highlight = highlights.find((h) => h.id === currentErrorId);
      if (highlight && highlight.pageNumber !== pageNumber) {
        goToPage(highlight.pageNumber);
      }
    }
  }, [currentErrorId, highlights, pageNumber, goToPage]);

  // Ajustar zoom inicial al contenedor
  useEffect(() => {
    if (!loading && containerRef.current) {
      zoomFit();
    }
  }, [loading, zoomFit]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // No activar shortcuts en inputs
      }

      switch (e.key) {
        case 'ArrowLeft':
          previousPage();
          break;
        case 'ArrowRight':
          nextPage();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          zoomReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [previousPage, nextPage, zoomIn, zoomOut, zoomReset]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!pdfUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg">No hay PDF cargado</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-300 shadow-sm">
        {/* Left: Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página anterior (←)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center">
            {loading ? (
              <span className="text-gray-400">...</span>
            ) : (
              <>
                Pág. {pageNumber} / {numPages}
              </>
            )}
          </span>

          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Página siguiente (→)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Center: Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Alejar (-)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>

          <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Acercar (+)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          <button
            onClick={zoomReset}
            className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
            title="Restablecer zoom (0)"
          >
            100%
          </button>

          <button
            onClick={zoomFit}
            className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
            title="Ajustar a ventana"
          >
            Ajustar
          </button>
        </div>

        {/* Right: Info */}
        <div className="text-sm text-gray-500">
          {highlightsForCurrentPage.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              {highlightsForCurrentPage.length} error(es) en esta página
            </span>
          )}
        </div>
      </div>

      {/* PDF VIEWER */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 p-4"
      >
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg text-red-600">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div ref={pageRef} className="relative inline-block shadow-2xl">
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center h-[800px] w-[600px] bg-white">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Cargando PDF...</p>
                    </div>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>

              {/* HIGHLIGHTS OVERLAY */}
              {highlightsForCurrentPage.map((highlight) => {
                const isActive = highlight.id === currentErrorId;
                const severityColors = {
                  critical: 'bg-red-500',
                  high: 'bg-orange-500',
                  medium: 'bg-yellow-500',
                  low: 'bg-blue-500',
                };

                return (
                  <div
                    key={highlight.id}
                    onClick={() => handleHighlightClick(highlight)}
                    className={`absolute border-2 rounded cursor-pointer transition-all ${
                      isActive
                        ? 'border-red-600 bg-red-500/30 scale-105 shadow-lg'
                        : 'border-yellow-400 bg-yellow-300/20 hover:bg-yellow-300/40'
                    }`}
                    style={{
                      left: `${highlight.x * 100}%`,
                      top: `${highlight.y * 100}%`,
                      width: `${highlight.width * 100}%`,
                      height: `${highlight.height * 100}%`,
                      zIndex: isActive ? 20 : 10,
                    }}
                    title={`${highlight.fieldName}: ${highlight.errorMessage}`}
                  >
                    {/* Icono de error */}
                    <div
                      className={`absolute -top-3 -right-3 w-6 h-6 rounded-full ${
                        severityColors[highlight.severity]
                      } flex items-center justify-center text-white text-xs font-bold shadow-md`}
                    >
                      !
                    </div>

                    {/* Tooltip al hacer hover */}
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block">
                      <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">
                        <div className="font-semibold">{highlight.fieldName}</div>
                        <div>{highlight.errorMessage}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="px-4 py-2 bg-white border-t border-gray-300 text-xs text-gray-500 text-center">
        Navegación: ← → | Zoom: + - 0 | Ajustar a ventana
      </div>
    </div>
  );
}

export default PdfViewerEnhanced;
