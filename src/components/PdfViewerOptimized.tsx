/**
 * PdfViewerOptimized.tsx
 *
 * Visor PDF optimizado con SCROLL CONTINUO:
 * - Muestra TODAS las páginas con scroll vertical
 * - Controles de zoom
 * - Highlights interactivos
 * - Memoria optimizada
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker de PDF.js
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
  console.log('📄 PDF.js worker configurado desde unpkg v5.4.296');
}

export interface PdfHighlight {
  id: string;
  pageNumber: number;
  fieldName: string;
  errorType: string;
  errorMessage: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfViewerOptimizedProps {
  pdfUrl: string | null;
  highlights?: PdfHighlight[];
  currentErrorId?: string | null;
  onHighlightClick?: (highlight: PdfHighlight) => void;
  className?: string;
}

interface PageData {
  pageNumber: number;
  width: number;
  height: number;
  rendered: boolean;
}

export const PdfViewerOptimized: React.FC<PdfViewerOptimizedProps> = ({
  pdfUrl,
  highlights = [],
  currentErrorId,
  onHighlightClick,
  className = ''
}) => {
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [pagesData, setPagesData] = useState<PageData[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const loadingTaskRef = useRef<any>(null);
  const renderTasksRef = useRef<Map<number, any>>(new Map());

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      renderTasksRef.current.forEach(task => {
        try { task.cancel(); } catch (e) { /* silenciar */ }
      });
      if (loadingTaskRef.current) {
        try { loadingTaskRef.current.destroy(); } catch (e) { /* silenciar */ }
      }
    };
  }, []);

  // Cargar documento PDF
  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfUrl) {
        setPdfDocument(null);
        setNumPages(0);
        setPagesData([]);
        setError(null);
        return;
      }

      if (loadingTaskRef.current) {
        try { loadingTaskRef.current.destroy(); } catch (e) { /* silenciar */ }
      }

      try {
        setLoading(true);
        setError(null);
        setLoadingProgress(0);

        console.log('📄 Cargando PDF:', pdfUrl.substring(0, 60) + '...');

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          disableStream: false,
          disableAutoFetch: false,
          rangeChunkSize: 65536,
        });

        loadingTask.onProgress = (progress: any) => {
          if (progress.total > 0) {
            setLoadingProgress(Math.round((progress.loaded / progress.total) * 100));
          }
        };

        loadingTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;

        console.log('✅ PDF cargado. Páginas:', pdf.numPages);
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        setRetryCount(0);

        // Obtener información de todas las páginas
        const pages: PageData[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          pages.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            rendered: false
          });
        }
        setPagesData(pages);

      } catch (err: any) {
        console.error('❌ Error cargando PDF:', err);
        let errorMessage = 'Error al cargar el PDF';
        if (err.name === 'MissingPDFException') errorMessage = 'PDF no encontrado';
        else if (err.name === 'InvalidPDFException') errorMessage = 'PDF corrupto o inválido';
        else if (err.message) errorMessage = err.message;
        setError(errorMessage);

        if (retryCount < 2) {
          setTimeout(() => setRetryCount(prev => prev + 1), 2000);
        }
      } finally {
        setLoading(false);
        setLoadingProgress(0);
      }
    };

    loadPdf();
  }, [pdfUrl, retryCount]);

  // Renderizar todas las páginas cuando cambia el documento o el scale
  useEffect(() => {
    const renderAllPages = async () => {
      if (!pdfDocument || pagesData.length === 0) return;

      // Cancelar renders anteriores
      renderTasksRef.current.forEach(task => {
        try { task.cancel(); } catch (e) { /* silenciar */ }
      });
      renderTasksRef.current.clear();

      console.log(`🖼️ Renderizando ${pagesData.length} páginas con scale ${scale}...`);

      for (let i = 0; i < pagesData.length; i++) {
        const pageData = pagesData[i];
        const canvas = canvasRefs.current.get(pageData.pageNumber);
        if (!canvas) continue;

        try {
          const page = await pdfDocument.getPage(pageData.pageNumber);
          const viewport = page.getViewport({ scale });
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) continue;

          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = Math.floor(viewport.width) + 'px';
          canvas.style.height = Math.floor(viewport.height) + 'px';

          const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

          const renderTask = page.render({
            canvasContext: context,
            viewport,
            transform,
          });

          renderTasksRef.current.set(pageData.pageNumber, renderTask);
          await renderTask.promise;

        } catch (err: any) {
          if (err.name !== 'RenderingCancelledException') {
            console.error(`Error renderizando página ${pageData.pageNumber}:`, err);
          }
        }
      }

      console.log('✅ Todas las páginas renderizadas');
    };

    renderAllPages();
  }, [pdfDocument, pagesData, scale]);

  // Scroll a la página del error seleccionado
  useEffect(() => {
    if (currentErrorId && highlights.length > 0) {
      const highlight = highlights.find(h => h.id === currentErrorId);
      if (highlight) {
        const canvas = canvasRefs.current.get(highlight.pageNumber);
        if (canvas) {
          canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentErrorId, highlights]);

  // Controles de Zoom
  const zoomIn = useCallback(() => setScale(prev => Math.min(prev + 0.25, 3.0)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(prev - 0.25, 0.5)), []);
  const zoomReset = useCallback(() => setScale(1.0), []);

  // Controles de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
        case '_':
          zoomOut();
          break;
        case '0':
          zoomReset();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, zoomReset]);

  // Highlights por página
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, PdfHighlight[]>();
    highlights.forEach(h => {
      const list = map.get(h.pageNumber) || [];
      list.push(h);
      map.set(h.pageNumber, list);
    });
    return map;
  }, [highlights]);

  // Estado vacío
  if (!pdfUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No hay documento cargado</p>
          <p className="text-sm text-gray-400 mt-2">Selecciona un formulario para revisar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-gray-100 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm z-10 flex-shrink-0">
        {/* Info páginas */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">
            {numPages} {numPages === 1 ? 'página' : 'páginas'}
          </span>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={loading}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
            title="Alejar (-)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <span className="text-sm min-w-[60px] text-center font-mono">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            disabled={loading}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
            title="Acercar (+)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button
            onClick={zoomReset}
            disabled={loading}
            className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30"
            title="100% (0)"
          >
            100%
          </button>
        </div>
      </div>

      {/* Viewer Container con SCROLL */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 bg-gray-200/50"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-700 font-medium mb-2">Cargando PDF...</p>
            {loadingProgress > 0 && loadingProgress < 100 && (
              <div className="w-48 h-2 bg-gray-300 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${loadingProgress}%` }}></div>
              </div>
            )}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-16 h-16 mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-600 font-medium mb-2">{error}</p>
            {retryCount >= 2 && (
              <button
                onClick={() => setRetryCount(0)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Reintentar
              </button>
            )}
          </div>
        ) : pdfDocument ? (
          <div className="flex flex-col items-center gap-4">
            {/* Renderizar TODAS las páginas */}
            {pagesData.map((pageData) => {
              const pageHighlights = highlightsByPage.get(pageData.pageNumber) || [];
              return (
                <div
                  key={pageData.pageNumber}
                  className="relative shadow-2xl bg-white"
                  style={{ fontSize: 0 }}
                >
                  {/* Número de página */}
                  <div className="absolute -top-6 left-0 text-xs text-gray-500 font-medium">
                    Página {pageData.pageNumber}
                  </div>

                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current.set(pageData.pageNumber, el);
                    }}
                    className="bg-white"
                  />

                  {/* Highlights de esta página */}
                  {pageHighlights.map(highlight => {
                    const isActive = highlight.id === currentErrorId;
                    const severityColors = {
                      critical: 'border-red-600 bg-red-500/30',
                      high: 'border-orange-500 bg-orange-400/25',
                      medium: 'border-yellow-500 bg-yellow-400/20',
                      low: 'border-blue-500 bg-blue-400/15'
                    };

                    return (
                      <div
                        key={highlight.id}
                        onClick={() => onHighlightClick?.(highlight)}
                        className={`absolute cursor-pointer transition-all duration-200 border-2 ${
                          isActive
                            ? 'border-red-600 bg-red-500/40 z-20 shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse'
                            : `${severityColors[highlight.severity]} hover:shadow-lg z-10`
                        }`}
                        style={{
                          left: `${highlight.x * 100}%`,
                          top: `${highlight.y * 100}%`,
                          width: `${highlight.width * 100}%`,
                          height: `${highlight.height * 100}%`,
                        }}
                        title={`${highlight.fieldName}: ${highlight.errorMessage}`}
                      >
                        {isActive && (
                          <div className="absolute -top-3 -right-3 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg animate-bounce">
                            !
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};
