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

// Input en iframe aislado - contexto de navegación separado
const IsolatedInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
  isLightMode: boolean;
}> = ({ value, onChange, onSubmit, placeholder, disabled, isLightMode }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isInitialized = useRef(false);

  const bgColor = isLightMode ? '#ffffff' : '#1e293b';
  const textColor = isLightMode ? '#1e293b' : '#e2e8f0';
  const borderColor = isLightMode ? '#e2e8f0' : '#475569';
  const placeholderColor = isLightMode ? '#94a3b8' : '#64748b';

  const iframeContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          background: transparent;
        }
        textarea {
          width: 100%;
          height: 80px;
          padding: 12px 16px;
          font-size: 16px;
          line-height: 1.5;
          font-family: system-ui, -apple-system, sans-serif;
          background: ${bgColor};
          color: ${textColor};
          border: 2px solid ${borderColor};
          border-radius: 8px;
          resize: none;
          outline: none;
        }
        textarea:focus { border-color: #10b981; }
        textarea::placeholder { color: ${placeholderColor}; }
        textarea:disabled { opacity: 0.6; }
      </style>
    </head>
    <body>
      <textarea
        id="input"
        placeholder="${placeholder}"
        ${disabled ? 'disabled' : ''}
      ></textarea>
      <script>
        const textarea = document.getElementById('input');
        textarea.addEventListener('input', () => {
          window.parent.postMessage({ type: 'input', value: textarea.value }, '*');
        });
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.parent.postMessage({ type: 'submit' }, '*');
          }
        });
        window.addEventListener('message', (e) => {
          if (e.data.type === 'setValue') {
            textarea.value = e.data.value;
          }
          if (e.data.type === 'setDisabled') {
            textarea.disabled = e.data.disabled;
          }
        });
      </script>
    </body>
    </html>
  `;

  // Escuchar mensajes del iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'input') {
        onChange(e.data.value);
      }
      if (e.data.type === 'submit') {
        onSubmit();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onChange, onSubmit]);

  // Sincronizar valor con el iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow && isInitialized.current) {
      iframeRef.current.contentWindow.postMessage({ type: 'setValue', value }, '*');
    }
  }, [value]);

  // Sincronizar disabled
  useEffect(() => {
    if (iframeRef.current?.contentWindow && isInitialized.current) {
      iframeRef.current.contentWindow.postMessage({ type: 'setDisabled', disabled }, '*');
    }
  }, [disabled]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={iframeContent}
      onLoad={() => {
        isInitialized.current = true;
        if (value) {
          iframeRef.current?.contentWindow?.postMessage({ type: 'setValue', value }, '*');
        }
      }}
      style={{
        width: '100%',
        height: '84px',
        border: 'none',
        borderRadius: '8px',
        background: 'transparent',
      }}
      sandbox="allow-scripts"
    />
  );
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
