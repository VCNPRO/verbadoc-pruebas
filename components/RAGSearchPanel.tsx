/**
 * RAG SEARCH PANEL - "Preguntale al Documento"
 * components/RAGSearchPanel.tsx
 *
 * Semantic search interface for querying documents using RAG
 * Features:
 * - Natural language search
 * - Source citations with links
 * - Filter by date, document type
 * - Export results
 * - Query history
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, FileText, Clock, Download, ChevronRight, Loader2, AlertCircle, CheckCircle, MessageSquare, X, History, Filter } from 'lucide-react';

interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  snippet: string;
  score: number;
}

interface RAGResponse {
  success: boolean;
  answer: string;
  sources: RAGSource[];
  confidence: number;
  processingTimeMs: number;
  tokensUsed?: number;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  response: string;
  confidence_score: number;
  created_at: string;
}

interface RAGSearchPanelProps {
  isLightMode?: boolean;
  onDocumentClick?: (documentId: string) => void;
  authToken?: string;
}

const RAGSearchPanelInner: React.FC<RAGSearchPanelProps> = ({
  isLightMode = false,
  onDocumentClick,
  authToken,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    documentIds: [] as string[],
    dateFrom: '',
    dateTo: '',
  });

  // Usar ref para el input en lugar de state controlado
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const historyFetchedRef = useRef(false);

  // Función para obtener el valor actual del input
  const getQueryValue = () => inputRef.current?.value || '';

  // Colors based on theme - memoized to prevent unnecessary recalculations
  const colors = useMemo(() => ({
    bgColor: isLightMode ? 'bg-white' : 'bg-slate-800',
    bgSecondary: isLightMode ? 'bg-gray-50' : 'bg-slate-900',
    textColor: isLightMode ? 'text-gray-900' : 'text-white',
    textMuted: isLightMode ? 'text-gray-500' : 'text-gray-400',
    borderColor: isLightMode ? 'border-gray-200' : 'border-slate-700',
    accentColor: 'text-cyan-500',
    accentBg: isLightMode ? 'bg-cyan-50' : 'bg-cyan-900/20',
  }), [isLightMode]);

  const { bgColor, bgSecondary, textColor, textMuted, borderColor, accentColor, accentBg } = colors;

  // Fetch query history on mount - only once
  const fetchHistory = useCallback(async () => {
    if (historyFetchedRef.current) return;
    historyFetchedRef.current = true;

    try {
      const res = await fetch('/api/rag/ask?limit=20', {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, [authToken]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSearch = useCallback(async () => {
    const queryValue = getQueryValue();
    if (!queryValue.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: queryValue.trim(),
          documentIds: filters.documentIds.length > 0 ? filters.documentIds : undefined,
          topK: 5,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error en la busqueda');
      }

      setResponse(data);
      // Reset history fetched flag to allow refresh
      historyFetchedRef.current = false;
      fetchHistory();

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      setError(err.message || 'Error al procesar la consulta');
    } finally {
      setIsSearching(false);
    }
  }, [isSearching, authToken, filters.documentIds, fetchHistory]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  const handleHistoryClick = useCallback((item: QueryHistoryItem) => {
    if (inputRef.current) {
      inputRef.current.value = item.query;
    }
    setShowHistory(false);
  }, []);

  const exportResults = () => {
    if (!response) return;

    const queryValue = getQueryValue();
    const content = `
CONSULTA RAG - VerbadocPro
============================

Pregunta: ${queryValue}

Respuesta:
${response.answer}

Confianza: ${Math.round(response.confidence * 100)}%
Tiempo de procesamiento: ${response.processingTimeMs}ms

Fuentes:
${response.sources.map((s, i) => `
${i + 1}. ${s.documentName}
   Score: ${Math.round(s.score * 100)}%
   Extracto: ${s.snippet}
`).join('\n')}

Generado: ${new Date().toLocaleString('es-ES')}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rag-query-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={`${bgColor} rounded-xl border ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div className={`${bgSecondary} px-6 py-4 border-b ${borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${accentBg}`}>
              <MessageSquare className={`w-5 h-5 ${accentColor}`} />
            </div>
            <div>
              <h2 className={`font-semibold ${textColor}`}>Preguntale al Documento</h2>
              <p className={`text-sm ${textMuted}`}>Busqueda semantica con IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg hover:${bgSecondary} transition-colors ${showHistory ? accentColor : textMuted}`}
              title="Historial de consultas"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg hover:${bgSecondary} transition-colors ${showFilters ? accentColor : textMuted}`}
              title="Filtros"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={`px-6 py-3 border-b ${borderColor} ${bgSecondary}`}>
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className={`text-xs ${textMuted} block mb-1`}>Desde</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className={`px-3 py-1 rounded border ${borderColor} ${bgColor} ${textColor} text-sm`}
              />
            </div>
            <div>
              <label className={`text-xs ${textMuted} block mb-1`}>Hasta</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className={`px-3 py-1 rounded border ${borderColor} ${bgColor} ${textColor} text-sm`}
              />
            </div>
            {(filters.dateFrom || filters.dateTo) && (
              <button
                onClick={() => setFilters({ ...filters, dateFrom: '', dateTo: '' })}
                className={`text-xs ${accentColor} hover:underline mt-5`}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className={`px-6 py-3 border-b ${borderColor} max-h-48 overflow-y-auto`}>
          <p className={`text-xs ${textMuted} mb-2`}>Consultas recientes:</p>
          <div className="space-y-2">
            {history.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className={`w-full text-left p-2 rounded ${bgSecondary} hover:opacity-80 transition-opacity`}
              >
                <p className={`text-sm ${textColor} truncate`}>{item.query}</p>
                <p className={`text-xs ${textMuted}`}>
                  {new Date(item.created_at).toLocaleDateString('es-ES')} -
                  Confianza: {Math.round(item.confidence_score * 100)}%
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="p-6">
        <div className={`flex gap-3 items-center`}>
          <div className="flex-1 relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${textMuted}`} />
            <input
              ref={inputRef}
              type="text"
              defaultValue=""
              onKeyDown={handleKeyPress}
              placeholder="Escribe tu pregunta sobre los documentos..."
              className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${borderColor} ${bgSecondary} ${textColor} focus:border-cyan-500 focus:outline-none transition-colors`}
              disabled={isSearching}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              data-1p-ignore="true"
              aria-autocomplete="none"
              name={`rag-query-${Date.now()}`}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className={`px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Buscar
              </>
            )}
          </button>
        </div>

        {/* Example queries */}
        {!response && !error && (
          <div className={`mt-4 flex flex-wrap gap-2`}>
            <span className={`text-xs ${textMuted}`}>Prueba:</span>
            {[
              'Cual es el total de la factura?',
              'Quien es el proveedor?',
              'Que productos se mencionan?',
            ].map((example) => (
              <button
                key={example}
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.value = example;
                    inputRef.current.focus();
                  }
                }}
                className={`text-xs px-3 py-1 rounded-full ${bgSecondary} ${textMuted} hover:${accentColor} transition-colors`}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 pb-6">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-500 font-medium">Error en la busqueda</p>
              <p className={`text-sm ${textMuted}`}>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {response && (
        <div ref={resultsRef} className="px-6 pb-6 space-y-6">
          {/* Answer */}
          <div className={`p-4 rounded-xl ${accentBg} border ${borderColor}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-5 h-5 ${accentColor}`} />
                <span className={`font-medium ${textColor}`}>Respuesta</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className={getConfidenceColor(response.confidence)}>
                  Confianza: {Math.round(response.confidence * 100)}%
                </span>
                <span className={textMuted}>
                  {response.processingTimeMs}ms
                </span>
                <button
                  onClick={exportResults}
                  className={`p-1 hover:${accentColor} transition-colors`}
                  title="Exportar resultados"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className={`${textColor} whitespace-pre-wrap leading-relaxed`}>
              {response.answer}
            </p>
          </div>

          {/* Sources */}
          {response.sources.length > 0 && (
            <div>
              <h3 className={`font-medium ${textColor} mb-3 flex items-center gap-2`}>
                <FileText className="w-4 h-4" />
                Fuentes ({response.sources.length})
              </h3>
              <div className="space-y-3">
                {response.sources.map((source, index) => (
                  <div
                    key={`${source.documentId}-${source.chunkIndex}`}
                    className={`p-4 rounded-lg ${bgSecondary} border ${borderColor} hover:border-cyan-500/50 transition-colors cursor-pointer`}
                    onClick={() => onDocumentClick?.(source.documentId)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${accentBg} ${accentColor}`}>
                          Fuente {index + 1}
                        </span>
                        <span className={`font-medium ${textColor} text-sm`}>
                          {source.documentName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${textMuted}`}>
                          Score: {Math.round(source.score * 100)}%
                        </span>
                        <ChevronRight className={`w-4 h-4 ${textMuted}`} />
                      </div>
                    </div>
                    <p className={`text-sm ${textMuted} line-clamp-3`}>
                      "{source.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No sources warning */}
          {response.sources.length === 0 && (
            <div className={`p-4 rounded-lg ${bgSecondary} border ${borderColor}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${textMuted}`} />
                <p className={textMuted}>
                  No se encontraron fuentes relevantes para esta consulta.
                  Intenta reformular tu pregunta.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className={`px-6 py-3 border-t ${borderColor} ${bgSecondary}`}>
        <p className={`text-xs ${textMuted} text-center`}>
          Busqueda potenciada por Gemini + Pinecone | Datos procesados en la UE
        </p>
      </div>
    </div>
  );
};

// Wrap with React.memo to prevent re-renders when parent state changes
export const RAGSearchPanel = React.memo(RAGSearchPanelInner);

export default RAGSearchPanel;
