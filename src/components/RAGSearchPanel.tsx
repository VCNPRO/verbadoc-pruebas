/**
 * RAGSearchPanel.tsx
 *
 * Panel for semantic search over documents (RAG).
 * Route: /rag
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PdfViewerOptimized } from './PdfViewerOptimized';

interface RAGSearchPanelProps {
  isDarkMode?: boolean;
}

interface RAGResult {
  documentId: string;
  filename: string;
  text: string;
  score: number;
  pdfUrl?: string;
}

export default function RAGSearchPanel({ isDarkMode = false }: RAGSearchPanelProps) {
  const navigate = useNavigate();

  const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
  const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const bgSecondary = isDarkMode ? 'bg-[#1e293b]' : 'bg-[#e8edf2]';
  const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
  const border = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RAGResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError('');
      setHasSearched(true);

      const response = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: query.trim() })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error en la busqueda');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err: any) {
      console.error('RAG search error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (pdfUrl: string, filename: string) => {
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Error al descargar el PDF.');
    }
  };

  return (
    <div className={`min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className={`${bgCard} border-b ${border}`}>
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>
                Busqueda Semantica (RAG)
              </h1>
              <p className={`${textSecondary} mt-1`}>
                Busca informacion en tus documentos usando lenguaje natural
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className={`px-4 py-2 ${textSecondary} border ${border} rounded-lg ${isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]'}`}
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>

      {/* Search Area */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className={`${bgCard} border ${border} rounded-xl p-6 mb-8`}>
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Escribe tu consulta en lenguaje natural..."
              className={`flex-1 px-4 py-3 border ${border} rounded-lg text-lg ${bgPrimary} ${textPrimary} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Buscando...
                </>
              ) : (
                'Buscar'
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {hasSearched && !loading && results.length === 0 && !error && (
          <div className={`${bgCard} border ${border} rounded-xl p-12 text-center`}>
            <p className={`text-lg ${textSecondary}`}>
              No se encontraron resultados para tu consulta.
            </p>
            <p className={`text-sm ${textSecondary} mt-2`}>
              Intenta con diferentes palabras o una consulta mas general.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <p className={`text-sm ${textSecondary} mb-4`}>
              {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((result, idx) => (
              <div
                key={`${result.documentId}-${idx}`}
                className={`${bgCard} border ${border} rounded-xl p-6`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={`font-semibold ${textPrimary}`}>
                      {result.filename}
                    </h3>
                    <p className={`text-xs ${textSecondary}`}>
                      Relevancia: {(result.score * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {result.pdfUrl && (
                      <>
                        <button
                          onClick={() => setViewingPdf(result.pdfUrl!)}
                          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                        >
                          Ver PDF
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(result.pdfUrl!, result.filename)}
                          className={`px-3 py-1.5 text-sm border ${border} rounded-lg ${textSecondary} ${isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]'}`}
                        >
                          Descargar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className={`${bgSecondary} rounded-lg p-4`}>
                  <p className={`text-sm ${textPrimary} leading-relaxed`}>
                    {result.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bgCard} rounded-xl shadow-2xl w-[80vw] h-[85vh] overflow-hidden flex flex-col`}>
            <div className={`${bgSecondary} px-6 py-4 border-b ${border} flex items-center justify-between`}>
              <h3 className={`font-semibold ${textPrimary}`}>Visor PDF</h3>
              <button
                onClick={() => setViewingPdf(null)}
                className={`p-2 ${isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]'} rounded-lg`}
              >
                <svg className={`h-6 w-6 ${textSecondary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1">
              <PdfViewerOptimized
                pdfUrl={viewingPdf}
                highlights={[]}
                currentErrorId={null}
                onHighlightClick={() => {}}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
