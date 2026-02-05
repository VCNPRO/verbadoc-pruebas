/**
 * RAG SEARCH PANEL - "Pregúntale al Documento"
 * components/RAGSearchPanel.tsx
 *
 * Panel de consultas con lenguaje natural
 */

import React, { useState, useEffect } from 'react';

interface RagFolder {
  id: string;
  name: string;
  document_count: number;
}

interface RAGSource {
  documentId: string;
  documentName: string;
  snippet: string;
  score: number;
}

interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  confidence: number;
}

interface Props {
  isLightMode: boolean;
  query: string;
  setQuery: (q: string) => void;
}

export const RAGSearchPanel: React.FC<Props> = ({ isLightMode, query, setQuery }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado de carpetas
  const [folders, setFolders] = useState<RagFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Cargar carpetas al montar
  useEffect(() => {
    fetch('/api/rag/folders', { credentials: 'include' })
      .then(res => res.ok ? res.json() : { folders: [] })
      .then(data => setFolders(data.folders || []))
      .catch(() => {});
  }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/rag/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setFolders(prev => [...prev, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedFolderId(data.folder.id);
        setNewFolderName('');
        setShowNewFolder(false);
      }
    } catch {}
  };

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: query.trim(), topK: 5, folderId: selectedFolderId || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error en la búsqueda');
      }

      setResponse({
        answer: data.answer,
        sources: data.sources || [],
        confidence: data.confidence || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Error al procesar la consulta');
    } finally {
      setIsLoading(false);
    }
  };

  const bgMain = isLightMode ? '#ffffff' : '#1a1a2e';
  const bgInput = isLightMode ? '#f8fafc' : '#0f0f1a';
  const borderColor = isLightMode ? '#e2e8f0' : '#2d2d44';
  const textColor = isLightMode ? '#1e293b' : '#e2e8f0';
  const textMuted = isLightMode ? '#64748b' : '#94a3b8';
  const accentGreen = isLightMode ? '#10b981' : '#34d399';

  return (
    <div style={{ backgroundColor: bgMain, color: textColor }}>
      {/* Selector de carpeta */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: textMuted, whiteSpace: 'nowrap' }}>Carpeta:</label>
        <select
          value={selectedFolderId}
          onChange={(e) => setSelectedFolderId(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: '13px',
            backgroundColor: bgInput,
            color: textColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '6px',
            outline: 'none',
          }}
        >
          <option value="">Todas las carpetas</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name} ({f.document_count})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNewFolder(!showNewFolder)}
          style={{
            padding: '6px 10px',
            fontSize: '13px',
            backgroundColor: 'transparent',
            color: accentGreen,
            border: `1px solid ${borderColor}`,
            borderRadius: '6px',
            cursor: 'pointer',
          }}
          title="Nueva carpeta"
        >+</button>
      </div>

      {showNewFolder && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            placeholder="Nombre de la carpeta..."
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '13px',
              backgroundColor: bgInput,
              color: textColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              outline: 'none',
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: !newFolderName.trim() ? (isLightMode ? '#cbd5e1' : '#374151') : accentGreen,
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: !newFolderName.trim() ? 'not-allowed' : 'pointer',
            }}
          >Crear</button>
        </div>
      )}

      {/* Zona de escritura */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          padding: '16px',
          backgroundColor: bgInput,
          borderRadius: '12px',
          border: `2px solid ${borderColor}`,
        }}
      >
        <div style={{ flex: 1 }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Escribe tu pregunta aquí... (Enter para enviar)"
            disabled={isLoading}
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              lineHeight: '1.5',
              backgroundColor: bgMain,
              color: textColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !query.trim()}
            style={{
              padding: '10px 24px',
              fontSize: '15px',
              fontWeight: '600',
              backgroundColor: isLoading || !query.trim() ? (isLightMode ? '#cbd5e1' : '#374151') : accentGreen,
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: '120px',
              justifyContent: 'center',
            }}
          >
            {isLoading ? '⏳ Buscando...' : '🔍 Buscar'}
          </button>
          {(query || response || error) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResponse(null);
                setError(null);
              }}
              style={{
                padding: '6px 24px',
                fontSize: '13px',
                backgroundColor: 'transparent',
                color: textMuted,
                border: `1px solid ${borderColor}`,
                borderRadius: '6px',
                cursor: 'pointer',
                minWidth: '120px',
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Sugerencias */}
      {!response && !error && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: textMuted, fontSize: '13px' }}>Prueba:</span>
          {['¿Cuál es el total?', '¿Quién es el proveedor?', 'Resume el documento'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s)}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                backgroundColor: isLightMode ? '#f1f5f9' : '#1e293b',
                color: textMuted,
                border: `1px solid ${borderColor}`,
                borderRadius: '16px',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: isLightMode ? '#fef2f2' : '#2d1b1b',
          border: `1px solid ${isLightMode ? '#fecaca' : '#5c2828'}`,
          borderRadius: '8px',
          color: isLightMode ? '#dc2626' : '#f87171',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Respuesta */}
      {response && (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            padding: '16px',
            backgroundColor: isLightMode ? '#ecfdf5' : '#0d2818',
            border: `1px solid ${isLightMode ? '#a7f3d0' : '#166534'}`,
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: '600', color: accentGreen }}>Respuesta</span>
              <span style={{ fontSize: '13px', color: textMuted }}>
                Confianza: {Math.round(response.confidence * 100)}%
              </span>
            </div>
            <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{response.answer}</p>
          </div>

          {response.sources.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: textMuted }}>
                Fuentes ({response.sources.length})
              </p>
              {response.sources.map((source, i) => (
                <div key={i} style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: bgInput,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{source.documentName}</span>
                    <span style={{ fontSize: '12px', color: textMuted }}>{Math.round(source.score * 100)}%</span>
                  </div>
                  <p style={{ fontSize: '13px', color: textMuted }}>{source.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RAGSearchPanel;
