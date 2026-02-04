/**
 * RAG SEARCH PANEL - "Pregúntale al Documento"
 * components/RAGSearchPanel.tsx
 *
 * Panel de consultas con lenguaje natural - VERSIÓN LIMPIA
 */

import React, { useState, useRef, useEffect } from 'react';

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

// Componente de input aislado con Shadow DOM - inmune a extensiones
const IsolatedInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
  isLightMode: boolean;
}> = ({ value, onChange, onSubmit, placeholder, disabled, isLightMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Crear Shadow DOM si no existe
    let shadow = containerRef.current.shadowRoot;
    if (!shadow) {
      shadow = containerRef.current.attachShadow({ mode: 'closed' });
    }

    // Estilos y textarea dentro del Shadow DOM
    const bgMain = isLightMode ? '#ffffff' : '#1e293b';
    const textColor = isLightMode ? '#1e293b' : '#e2e8f0';
    const borderColor = isLightMode ? '#e2e8f0' : '#475569';

    shadow.innerHTML = `
      <style>
        textarea {
          width: 100%;
          min-height: 80px;
          padding: 12px 16px;
          font-size: 16px;
          line-height: 1.5;
          font-family: inherit;
          background-color: ${bgMain};
          color: ${textColor};
          border: 2px solid ${borderColor};
          border-radius: 8px;
          resize: none;
          outline: none;
          box-sizing: border-box;
        }
        textarea:focus {
          border-color: #10b981;
        }
        textarea::placeholder {
          color: ${isLightMode ? '#94a3b8' : '#64748b'};
        }
        textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      </style>
      <textarea placeholder="${placeholder}" ${disabled ? 'disabled' : ''}></textarea>
    `;

    const textarea = shadow.querySelector('textarea');
    if (textarea) {
      inputRef.current = textarea as HTMLTextAreaElement;
      textarea.value = value;

      textarea.addEventListener('input', (e) => {
        onChange((e.target as HTMLTextAreaElement).value);
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      });
    }
  }, [isLightMode, disabled]);

  // Actualizar valor cuando cambia externamente
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
};

export const RAGSearchPanel: React.FC<Props> = ({ isLightMode, query, setQuery }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ query: query.trim(), topK: 5 }),
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
      {/* Zona de escritura con Shadow DOM aislado */}
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
          <IsolatedInput
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            placeholder="Escribe tu pregunta aquí... (Enter para enviar)"
            disabled={isLoading}
            isLightMode={isLightMode}
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !query.trim()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: isLoading || !query.trim() ? (isLightMode ? '#cbd5e1' : '#374151') : accentGreen,
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '120px',
              justifyContent: 'center',
            }}
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                Buscando...
              </>
            ) : (
              <>
                🔍 Buscar
              </>
            )}
          </button>
        </div>

      {/* Sugerencias rápidas */}
      {!response && !error && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: textMuted, fontSize: '13px' }}>Prueba:</span>
          {['¿Cuál es el total?', '¿Quién es el proveedor?', 'Resume el documento'].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuery(suggestion)}
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
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: isLightMode ? '#fef2f2' : '#2d1b1b',
            border: `1px solid ${isLightMode ? '#fecaca' : '#5c2828'}`,
            borderRadius: '8px',
            color: isLightMode ? '#dc2626' : '#f87171',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Respuesta */}
      {response && (
        <div style={{ marginTop: '16px' }}>
          {/* Respuesta principal */}
          <div
            style={{
              padding: '16px',
              backgroundColor: isLightMode ? '#ecfdf5' : '#0d2818',
              border: `1px solid ${isLightMode ? '#a7f3d0' : '#166534'}`,
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: '600', color: accentGreen }}>✅ Respuesta</span>
              <span style={{ fontSize: '13px', color: textMuted }}>
                Confianza: {Math.round(response.confidence * 100)}%
              </span>
            </div>
            <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{response.answer}</p>
          </div>

          {/* Fuentes */}
          {response.sources.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: textMuted }}>
                📄 Fuentes ({response.sources.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {response.sources.map((source, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px',
                      backgroundColor: bgInput,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '500', fontSize: '14px' }}>{source.documentName}</span>
                      <span style={{ fontSize: '12px', color: textMuted }}>
                        {Math.round(source.score * 100)}%
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: textMuted, lineHeight: '1.4' }}>
                      "{source.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RAGSearchPanel;
