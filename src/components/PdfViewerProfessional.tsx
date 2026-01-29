import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker de PDF.js - Usar unpkg directamente
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
  console.log('📄 PDF.js worker configurado desde unpkg v5.4.530');
}

export interface PdfHighlight {
  id: string;
  pageNumber: number;
  fieldName: string;
  errorType: string;
  errorMessage: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  // Coordenadas relativas (0-1)
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfViewerProfessionalProps {
  pdfUrl: string | null;
  highlights?: PdfHighlight[];
  currentErrorId?: string | null;
  onHighlightClick?: (highlight: PdfHighlight) => void;
  className?: string;
}

export const PdfViewerProfessional: React.FC<PdfViewerProfessionalProps> = ({
  pdfUrl,
  highlights = [],
  currentErrorId,
  onHighlightClick,
  className = ''
}) => {
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Cargar documento PDF
  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfUrl) {
        setPdfDocument(null);
        setNumPages(0);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('📄 Cargando PDF con pdfjs-dist...', pdfUrl.substring(0, 50) + '...');
        
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        console.log('✅ PDF cargado. Páginas:', pdf.numPages);
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err: any) {
        console.error('❌ Error cargando PDF:', err);
        setError(err.message || 'Error al cargar el PDF');
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfUrl]);

  // Renderizar página actual
  const renderPage = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDocument.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Limpiar canvas antes de nuevo render
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Ajustar dimensiones del canvas para alta resolución (HiDPI)
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";

      const transform = outputScale !== 1 
        ? [outputScale, 0, 0, outputScale, 0, 0] 
        : undefined;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        transform: transform
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
      
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error renderizando página:', err);
      }
    }
  }, [pdfDocument, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Navegar a la página del error seleccionado
  useEffect(() => {
    if (currentErrorId && highlights.length > 0) {
      const highlight = highlights.find(h => h.id === currentErrorId);
      if (highlight && highlight.pageNumber !== currentPage) {
        setCurrentPage(highlight.pageNumber);
      }
    }
  }, [currentErrorId, highlights, currentPage]);

  // Controles de Zoom
  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const zoomReset = () => setScale(1.0);
  const zoomFit = () => {
    if (containerRef.current && pdfDocument) {
      // Ajuste aproximado para A4 en pantalla
      const width = containerRef.current.clientWidth;
      setScale((width - 40) / 600); // 600px ancho base aprox
    }
  };

  // Ajuste inicial
  useEffect(() => {
    if (pdfDocument) zoomFit();
  }, [pdfDocument]);

  if (!pdfUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg">No hay documento cargado</p>
        </div>
      </div>
    );
  }

  // Highlights de la página actual
  const currentHighlights = highlights.filter(h => h.pageNumber === currentPage);

  return (
    <div className={`flex flex-col h-full bg-gray-100 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm z-10">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Anterior"
          >
            ←
          </button>
          <span className="text-sm font-medium min-w-[80px] text-center">
            {currentPage} / {numPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Siguiente"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={zoomOut} className="p-1 rounded hover:bg-gray-100" title="Zoom Out">-</button>
          <span className="text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1 rounded hover:bg-gray-100" title="Zoom In">+</button>
          <button onClick={zoomFit} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">Ajustar</button>
        </div>
      </div>

      {/* Viewer Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex justify-center items-start bg-gray-200/50"
      >
        {loading ? (
           <div className="mt-20 flex flex-col items-center">
             <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
             <p className="text-gray-600">Renderizando PDF...</p>
           </div>
        ) : error ? (
           <div className="mt-20 text-red-500 font-medium">{error}</div>
        ) : (
          <div className="relative shadow-xl" style={{ fontSize: 0 }}>
            <canvas ref={canvasRef} className="bg-white" />
            
            {/* Highlights Overlay */}
            {currentHighlights.map(highlight => {
               const isActive = highlight.id === currentErrorId;
               return (
                 <div
                   key={highlight.id}
                   onClick={() => onHighlightClick && onHighlightClick(highlight)}
                   className={`absolute cursor-pointer transition-all border-2 ${
                     isActive 
                       ? 'border-red-600 bg-red-500/30 z-20 shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
                       : 'border-yellow-500 bg-yellow-400/20 hover:bg-yellow-400/30 z-10'
                   }`}
                   style={{
                     left: `${highlight.x * 100}%`,
                     top: `${highlight.y * 100}%`,
                     width: `${highlight.width * 100}%`,
                     height: `${highlight.height * 100}%`
                   }}
                   title={`${highlight.fieldName}: ${highlight.errorMessage}`}
                 >
                   {isActive && (
                     <div className="absolute -top-3 -right-3 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                       !
                     </div>
                   )}
                 </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
