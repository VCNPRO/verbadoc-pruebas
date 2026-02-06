/**
 * RAG SEARCH PANEL - "Pregúntale al Documento"
 * components/RAGSearchPanel.tsx
 *
 * Panel de consultas con lenguaje natural
 * Incluye soporte de voz (micrófono + leer respuesta)
 * Soporte multiidioma: ES, CA, GL, EU, PT, FR, EN, IT, DE
 */

import React, { useState, useEffect } from 'react';
import { useVoice } from '../src/hooks/useVoice';

// Configuración de idiomas soportados
const SUPPORTED_LANGUAGES = [
  { code: 'es', locale: 'es-ES', name: 'Español', flag: '🇪🇸' },
  { code: 'ca', locale: 'ca-ES', name: 'Català', flag: '🏴󠁥󠁳󠁣󠁴󠁿' },
  { code: 'gl', locale: 'gl-ES', name: 'Galego', flag: '🏴󠁥󠁳󠁧󠁡󠁿' },
  { code: 'eu', locale: 'eu-ES', name: 'Euskara', flag: '🏴' },
  { code: 'pt', locale: 'pt-PT', name: 'Português', flag: '🇵🇹' },
  { code: 'fr', locale: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'en', locale: 'en-GB', name: 'English', flag: '🇬🇧' },
  { code: 'it', locale: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'de', locale: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
];

// Textos traducidos por idioma
const UI_TEXTS: Record<string, { placeholder: string; listening: string; search: string; searching: string }> = {
  es: { placeholder: 'Escribe o habla tu pregunta...', listening: '🎤 Escuchando... habla ahora', search: 'Buscar', searching: 'Buscando...' },
  ca: { placeholder: 'Escriu o parla la teva pregunta...', listening: '🎤 Escoltant... parla ara', search: 'Cercar', searching: 'Cercant...' },
  gl: { placeholder: 'Escribe ou fala a túa pregunta...', listening: '🎤 Escoitando... fala agora', search: 'Buscar', searching: 'Buscando...' },
  eu: { placeholder: 'Idatzi edo esan zure galdera...', listening: '🎤 Entzuten... hitz egin orain', search: 'Bilatu', searching: 'Bilatzen...' },
  pt: { placeholder: 'Escreva ou fale sua pergunta...', listening: '🎤 Ouvindo... fale agora', search: 'Pesquisar', searching: 'Pesquisando...' },
  fr: { placeholder: 'Écrivez ou parlez votre question...', listening: '🎤 Écoute... parlez maintenant', search: 'Rechercher', searching: 'Recherche...' },
  en: { placeholder: 'Type or speak your question...', listening: '🎤 Listening... speak now', search: 'Search', searching: 'Searching...' },
  it: { placeholder: 'Scrivi o parla la tua domanda...', listening: '🎤 Ascolto... parla ora', search: 'Cerca', searching: 'Ricerca...' },
  de: { placeholder: 'Schreiben oder sprechen Sie Ihre Frage...', listening: '🎤 Zuhören... sprechen Sie jetzt', search: 'Suchen', searching: 'Suche...' },
};

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
  documentUrl?: string;
  fileType?: string;
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

  // Estado para visor de documentos
  const [viewingDoc, setViewingDoc] = useState<{ url: string; name: string; isImage: boolean } | null>(null);

  // Estado de idioma
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    // Cargar idioma guardado o usar español por defecto
    const saved = localStorage.getItem('verbadoc-rag-language');
    return saved || 'es';
  });

  // Hook de voz
  const {
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    isListening,
    clearTranscript,
    speak,
    stopSpeaking,
    isSpeaking,
    isSttSupported,
    isTtsSupported,
    error: voiceError,
    settings: voiceSettings,
    updateSettings: updateVoiceSettings,
  } = useVoice();

  // Estado para mostrar configuración de voz
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Cuando el usuario termina de hablar, actualizar la query
  useEffect(() => {
    if (transcript && !isListening) {
      setQuery(transcript);
      clearTranscript();
    }
  }, [transcript, isListening]);

  // Mostrar transcripción en tiempo real
  useEffect(() => {
    if (isListening && (transcript || interimTranscript)) {
      setQuery(transcript + interimTranscript);
    }
  }, [transcript, interimTranscript, isListening]);

  // Cargar carpetas al montar
  useEffect(() => {
    fetch('/api/rag/folders', { credentials: 'include' })
      .then(res => res.ok ? res.json() : { folders: [] })
      .then(data => setFolders(data.folders || []))
      .catch(() => {});
  }, []);

  // Guardar idioma y sincronizar con voz
  useEffect(() => {
    localStorage.setItem('verbadoc-rag-language', selectedLanguage);
    // Actualizar idioma de voz
    const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);
    if (langConfig) {
      updateVoiceSettings({ language: langConfig.locale });
    }
  }, [selectedLanguage, updateVoiceSettings]);

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
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Error al crear la carpeta');
      }
    } catch (err) {
      alert('Error de conexion al crear la carpeta');
    }
  };

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    // Detener escucha y síntesis de voz si están activas
    if (isListening) stopListening();
    if (isSpeaking) stopSpeaking();

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: query.trim(),
          topK: 5,
          folderId: selectedFolderId || undefined,
          language: selectedLanguage,
        }),
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
      {/* Selectores de carpeta e idioma */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Selector de carpeta */}
        <label style={{ fontSize: '13px', color: textMuted, whiteSpace: 'nowrap' }}>Carpeta:</label>
        <select
          value={selectedFolderId}
          onChange={(e) => setSelectedFolderId(e.target.value)}
          style={{
            flex: 1,
            minWidth: '150px',
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

        {/* Separador */}
        <div style={{ width: '1px', height: '24px', backgroundColor: borderColor, margin: '0 4px' }} />

        {/* Selector de idioma */}
        <label style={{ fontSize: '13px', color: textMuted, whiteSpace: 'nowrap' }}>Idioma:</label>
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          style={{
            padding: '6px 10px',
            fontSize: '13px',
            backgroundColor: bgInput,
            color: textColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '6px',
            outline: 'none',
          }}
          title="Idioma de preguntas y respuestas"
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
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
          border: `2px solid ${isListening ? accentGreen : borderColor}`,
          transition: 'border-color 0.2s',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={isListening ? UI_TEXTS[selectedLanguage]?.listening : `${UI_TEXTS[selectedLanguage]?.placeholder || UI_TEXTS.es.placeholder} (Enter)`}
            disabled={isLoading}
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              paddingRight: isSttSupported ? '50px' : '16px',
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
          {/* Botón micrófono dentro del textarea */}
          {isSttSupported && (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              style={{
                position: 'absolute',
                right: '8px',
                bottom: '8px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: isListening ? '#ef4444' : (isLightMode ? '#e2e8f0' : '#374151'),
                color: isListening ? '#ffffff' : textMuted,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title={isListening ? 'Detener' : 'Hablar'}
            >
              {isListening ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          )}
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
            {isLoading ? `⏳ ${UI_TEXTS[selectedLanguage]?.searching || 'Buscando...'}` : `🔍 ${UI_TEXTS[selectedLanguage]?.search || 'Buscar'}`}
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

      {/* Error de voz */}
      {voiceError && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          backgroundColor: isLightMode ? '#fef3c7' : '#422006',
          border: `1px solid ${isLightMode ? '#fcd34d' : '#854d0e'}`,
          borderRadius: '8px',
          color: isLightMode ? '#92400e' : '#fbbf24',
          fontSize: '13px',
        }}>
          🎤 {voiceError}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: '600', color: accentGreen }}>Respuesta</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Botón leer respuesta */}
                {isTtsSupported && (
                  <button
                    type="button"
                    onClick={() => isSpeaking ? stopSpeaking() : speak(response.answer)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      backgroundColor: isSpeaking ? '#ef4444' : 'transparent',
                      color: isSpeaking ? '#ffffff' : accentGreen,
                      border: `1px solid ${isSpeaking ? '#ef4444' : accentGreen}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title={isSpeaking ? 'Detener lectura' : 'Leer respuesta'}
                  >
                    {isSpeaking ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        Detener
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <path d="M15.54 8.46a5 5 0 010 7.07" />
                          <path d="M19.07 4.93a10 10 0 010 14.14" />
                        </svg>
                        Leer
                      </>
                    )}
                  </button>
                )}
                <span style={{ fontSize: '13px', color: textMuted }}>
                  Confianza: {Math.round(response.confidence * 100)}%
                </span>
              </div>
            </div>
            <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{response.answer}</p>
          </div>

          {response.sources.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: textMuted }}>
                Fuentes ({response.sources.length})
              </p>
              {response.sources.map((source, i) => {
                const isImage = source.fileType?.startsWith('image/');
                return (
                  <div key={i} style={{
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: bgInput,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '500', fontSize: '14px' }}>{source.documentName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: textMuted }}>{Math.round(source.score * 100)}%</span>
                        {source.documentUrl && (
                          <button
                            onClick={() => setViewingDoc({
                              url: source.documentUrl!,
                              name: source.documentName,
                              isImage: !!isImage
                            })}
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: accentGreen,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            {isImage ? '🖼️ Ver' : '📄 Ver'}
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: textMuted }}>{source.snippet}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal visor de documento */}
      {viewingDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setViewingDoc(null)}
        >
          <div
            style={{
              backgroundColor: bgMain,
              borderRadius: '12px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: viewingDoc.isImage ? 'auto' : '900px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>{viewingDoc.name}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={viewingDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: accentGreen,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '6px',
                    textDecoration: 'none',
                  }}
                >
                  Abrir en nueva pestaña ↗
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '14px',
                    backgroundColor: 'transparent',
                    color: textMuted,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', justifyContent: 'center' }}>
              {viewingDoc.isImage ? (
                <img
                  src={viewingDoc.url}
                  alt={viewingDoc.name}
                  style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
                />
              ) : (
                <iframe
                  src={viewingDoc.url}
                  title={viewingDoc.name}
                  style={{ width: '100%', height: '75vh', border: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGSearchPanel;
