/**
 * RAGSearchPanel.tsx
 *
 * Panel for semantic search over documents (RAG).
 * Route: /rag
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { getLanguageByCode } from '../config/languages';
import { PdfViewerOptimized } from './PdfViewerOptimized';

interface RAGSearchPanelProps {
  isDarkMode?: boolean;
}

interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  snippet: string;
  score: number;
  documentUrl?: string;
  fileType?: string;
}

export default function RAGSearchPanel({ isDarkMode = false }: RAGSearchPanelProps) {
  const navigate = useNavigate();
  const { t } = useTranslation('rag');
  const { currentLanguage } = useLanguage();

  const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
  const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const bgSecondary = isDarkMode ? 'bg-[#1e293b]' : 'bg-[#e8edf2]';
  const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
  const border = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';

  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // URLs seguras via proxy (nunca exponer blob URLs directas)
  const getDocUrl = (docId: string) => `/api/documents/serve?id=${docId}`;
  const getDocDownloadUrl = (docId: string) => `/api/documents/serve?id=${docId}&download=1`;

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError('');
      setAnswer('');
      setSources([]);
      setHasSearched(true);

      const response = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: query.trim(), language: currentLanguage })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('search.searchError'));
      }

      const data = await response.json();
      setAnswer(data.answer || '');
      setSources(data.sources || []);
      setConfidence(data.confidence || 0);
    } catch (err: any) {
      console.error('RAG search error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docId: string, filename: string) => {
    try {
      const response = await fetch(getDocDownloadUrl(docId), { credentials: 'include' });
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading:', err);
      alert(t('search.downloadError'));
    }
  };

  const isAudio = (fileType?: string) => fileType?.startsWith('audio/');
  const isImage = (fileType?: string) => fileType?.startsWith('image/');

  return (
    <div className={`min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className={`${bgCard} border-b ${border}`}>
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>
                {t('search.title')}
              </h1>
              <p className={`${textSecondary} mt-1`}>
                {t('search.subtitle')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/biblioteca')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                {t('library.title', 'Biblioteca')}
              </button>
              <button
                onClick={() => navigate('/')}
                className={`px-4 py-2 ${textSecondary} border ${border} rounded-lg ${isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]'}`}
              >
                {'\u2190'} {t('library.back')}
              </button>
            </div>
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
              placeholder={t('search.placeholder')}
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
                  {t('search.searching')}
                </>
              ) : (
                t('search.ask')
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

        {/* No results */}
        {hasSearched && !loading && !answer && sources.length === 0 && !error && (
          <div className={`${bgCard} border ${border} rounded-xl p-12 text-center`}>
            <p className={`text-lg ${textSecondary}`}>
              {t('search.noDocuments')}
            </p>
            <p className={`text-sm ${textSecondary} mt-2`}>
              {t('search.noDocumentsHint')}
            </p>
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="space-y-6">
            {/* AI Response */}
            <div className={`${bgCard} border ${border} rounded-xl p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🤖</span>
                <h2 className={`font-semibold ${textPrimary}`}>{t('search.answer')}</h2>
                {confidence > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                    confidence >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' :
                    confidence >= 0.4 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {t('search.confidence')}: {Math.round(confidence * 100)}%
                  </span>
                )}
              </div>
              <div className={`${textPrimary} leading-relaxed whitespace-pre-wrap`}>
                {answer}
              </div>
            </div>

            {/* Sources */}
            {sources.length > 0 && (
              <div>
                <p className={`text-sm ${textSecondary} mb-4`}>
                  {sources.length} {sources.length !== 1 ? t('search.sourcesConsulted') : t('search.sourceConsulted')}
                </p>
                <div className="space-y-3">
                  {sources.map((source, idx) => (
                    <div
                      key={`${source.documentId}-${idx}`}
                      className={`${bgCard} border ${border} rounded-xl p-5`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {isAudio(source.fileType) ? '🎵' : isImage(source.fileType) ? '🖼️' : '📄'}
                          </span>
                          <div>
                            <h3 className={`font-semibold ${textPrimary}`}>
                              {source.documentName}
                            </h3>
                            <p className={`text-xs ${textSecondary}`}>
                              {t('search.relevance')}: {Math.round(source.score * 100)}%
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {source.documentUrl ? (
                            <>
                              {!isAudio(source.fileType) && !isImage(source.fileType) && (
                                <button
                                  onClick={() => setViewingPdf(getDocUrl(source.documentId))}
                                  className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                                >
                                  {t('search.view')}
                                </button>
                              )}
                              <button
                                onClick={() => handleDownload(source.documentId, source.documentName)}
                                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                              >
                                {t('search.download')}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => navigate('/biblioteca')}
                              className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                            >
                              {t('search.goToLibrary')}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={`${bgSecondary} rounded-lg p-4`}>
                        <p className={`text-sm ${textPrimary} leading-relaxed`}>
                          {source.snippet}
                        </p>
                      </div>
                      {!source.documentUrl && (
                        <p className={`text-xs ${textSecondary} mt-2 italic`}>
                          {t('search.libraryHint')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bgCard} rounded-xl shadow-2xl w-[80vw] h-[85vh] overflow-hidden flex flex-col`}>
            <div className={`${bgSecondary} px-6 py-4 border-b ${border} flex items-center justify-between`}>
              <h3 className={`font-semibold ${textPrimary}`}>{t('search.documentViewer')}</h3>
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
