/**
 * BibliotecaPage - Biblioteca RAG
 * Visualización de carpetas y documentos ingestados
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface BibliotecaPageProps {
    isDarkMode: boolean;
}

interface Folder {
    id: string;
    name: string;
    document_count: number;
    created_at: string;
}

interface Doc {
    id: string;
    filename: string;
    created_at: string;
    pdf_blob_url?: string;
    file_type?: string;
}

/** Visor de imagen con zoom y pan */
function ImageViewer({ src, alt, isDarkMode }: { src: string; alt: string; isDarkMode: boolean }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const posStart = useRef({ x: 0, y: 0 });

    const clampScale = (s: number) => Math.min(Math.max(s, 0.5), 5);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        setScale(prev => clampScale(prev + delta));
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        posStart.current = { ...position };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [position]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging) return;
        setPosition({
            x: posStart.current.x + (e.clientX - dragStart.current.x),
            y: posStart.current.y + (e.clientY - dragStart.current.y),
        });
    }, [dragging]);

    const handlePointerUp = useCallback(() => {
        setDragging(false);
    }, []);

    const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

    const btnCls = isDarkMode
        ? 'bg-slate-700 hover:bg-slate-600 text-white'
        : 'bg-gray-200 hover:bg-gray-300 text-gray-800';

    return (
        <div>
            <div
                ref={containerRef}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                    width: '100%',
                    height: '500px',
                    overflow: 'hidden',
                    cursor: dragging ? 'grabbing' : 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    userSelect: 'none',
                    border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                    borderRadius: '8px',
                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                }}
            >
                <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center center',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transition: dragging ? 'none' : 'transform 0.1s ease-out',
                    }}
                />
            </div>
            <div className="flex items-center justify-center gap-2 py-2">
                <button onClick={() => setScale(prev => clampScale(prev - 0.25))} className={`px-3 py-1 rounded-lg text-sm font-bold ${btnCls}`}>−</button>
                <span className={`text-xs font-mono w-14 text-center ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(prev => clampScale(prev + 0.25))} className={`px-3 py-1 rounded-lg text-sm font-bold ${btnCls}`}>+</button>
                <button onClick={resetView} className={`px-3 py-1 rounded-lg text-xs ${btnCls}`}>Reset</button>
            </div>
        </div>
    );
}

export default function BibliotecaPage({ isDarkMode }: BibliotecaPageProps) {
    const navigate = useNavigate();

    const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
    const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
    const bgSecondary = isDarkMode ? 'bg-[#1e293b]' : 'bg-[#e8edf2]';
    const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
    const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
    const borderCls = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';
    const hoverRow = isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]';
    const bgInput = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white border-gray-300';

    const [folders, setFolders] = useState<Folder[]>([]);
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [selectedFolderName, setSelectedFolderName] = useState('');
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [search, setSearch] = useState('');

    // Visor inline de documento
    const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

    // Seleccion de documentos
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetch('/api/rag/folders', { credentials: 'include' })
            .then(r => r.ok ? r.json() : { folders: [] })
            .then(data => setFolders(data.folders || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const openFolder = async (folderId: string, folderName: string) => {
        setSelectedFolder(folderId);
        setSelectedFolderName(folderName);
        setLoadingDocs(true);
        setSelectedDocIds(new Set());
        try {
            const r = await fetch(`/api/extractions?folderId=${folderId}`, { credentials: 'include' });
            if (r.ok) {
                const data = await r.json();
                setDocs((data.extractions || data.results || []).map((e: any) => ({
                    id: e.id,
                    filename: e.filename,
                    created_at: e.created_at,
                    pdf_blob_url: e.pdf_blob_url,
                    file_type: e.file_type,
                })));
            } else {
                setDocs([]);
            }
        } catch {
            setDocs([]);
        } finally {
            setLoadingDocs(false);
        }
    };

    const goBackToFolders = () => {
        setSelectedFolder(null);
        setSelectedFolderName('');
        setDocs([]);
        setSearch('');
        setSelectedDocIds(new Set());
    };

    const downloadDocument = async (doc: Doc) => {
        if (!doc.pdf_blob_url) return;
        const response = await fetch(doc.pdf_blob_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const toggleDocSelection = (docId: string) => {
        setSelectedDocIds(prev => {
            const next = new Set(prev);
            if (next.has(docId)) {
                next.delete(docId);
            } else {
                next.add(docId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedDocIds.size === filteredDocs.length) {
            setSelectedDocIds(new Set());
        } else {
            setSelectedDocIds(new Set(filteredDocs.map(d => d.id)));
        }
    };

    const deleteSelectedDocs = async () => {
        if (selectedDocIds.size === 0) return;

        const count = selectedDocIds.size;
        const confirmed = window.confirm(
            `¿Eliminar ${count} documento${count > 1 ? 's' : ''}?\n\nSe eliminaran los documentos y sus datos del indice RAG. Esta accion no se puede deshacer.`
        );
        if (!confirmed) return;

        setDeleting(true);
        let deleted = 0;

        for (const docId of selectedDocIds) {
            try {
                // Eliminar del indice RAG (embeddings + chunks)
                await fetch('/api/rag/delete', {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'document', documentId: docId }),
                });

                // Eliminar el registro de extraction_results
                await fetch(`/api/extractions/${docId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });

                deleted++;
            } catch (error) {
                console.error(`Error eliminando ${docId}:`, error);
            }
        }

        // Actualizar lista local
        setDocs(prev => prev.filter(d => !selectedDocIds.has(d.id)));
        setSelectedDocIds(new Set());
        setDeleting(false);

        // Actualizar contador de carpeta
        if (selectedFolder) {
            setFolders(prev => prev.map(f =>
                f.id === selectedFolder
                    ? { ...f, document_count: Math.max(0, f.document_count - deleted) }
                    : f
            ));
        }
    };

    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    const filteredDocs = docs.filter(d => d.filename.toLowerCase().includes(search.toLowerCase()));
    const allSelected = filteredDocs.length > 0 && selectedDocIds.size === filteredDocs.length;

    return (
        <div className={`min-h-screen ${bgPrimary}`}>
            {/* Header */}
            <div className={`${bgCard} border-b ${borderCls}`}>
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className={`text-2xl font-bold ${textPrimary}`}>Biblioteca RAG</h1>
                            <p className={`${textSecondary} mt-1`}>
                                {selectedFolder ? `Carpeta: ${selectedFolderName}` : 'Carpetas y documentos ingestados'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {selectedFolder && (
                                <button
                                    onClick={goBackToFolders}
                                    className={`px-4 py-2 ${textSecondary} border ${borderCls} rounded-lg ${hoverRow}`}
                                >
                                    ← Carpetas
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/')}
                                className={`px-4 py-2 ${textSecondary} border ${borderCls} rounded-lg ${hoverRow}`}
                            >
                                ← Volver al inicio
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Buscador + acciones */}
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className={`${bgCard} border ${borderCls} rounded-lg p-4`}>
                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={selectedFolder ? 'Buscar documento...' : 'Buscar carpeta...'}
                            className={`flex-1 px-3 py-2 rounded-md border ${bgInput}`}
                        />
                        {selectedFolder && selectedDocIds.size > 0 && (
                            <button
                                onClick={deleteSelectedDocs}
                                disabled={deleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Eliminando...
                                    </>
                                ) : (
                                    `Eliminar (${selectedDocIds.size})`
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-7xl mx-auto px-6 pb-8">
                <div className={`${bgCard} border ${borderCls} rounded-lg overflow-hidden`}>
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className={textSecondary}>Cargando carpetas...</p>
                        </div>
                    ) : !selectedFolder ? (
                        /* Vista de carpetas */
                        filteredFolders.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-6xl mb-4">📂</div>
                                <p className={`${textSecondary} text-lg`}>{search ? 'Sin resultados' : 'No hay carpetas'}</p>
                                <p className={`${textSecondary} text-sm mt-2`}>Sube documentos desde "Biblioteca RAG" para crear carpetas</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className={`${bgSecondary} border-b ${borderCls}`}>
                                    <tr>
                                        <th className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Carpeta</th>
                                        <th className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Documentos</th>
                                        <th className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFolders.map(folder => (
                                        <tr
                                            key={folder.id}
                                            className={`border-b ${borderCls} ${hoverRow} cursor-pointer`}
                                            onClick={() => openFolder(folder.id, folder.name)}
                                        >
                                            <td className={`px-6 py-4 ${textPrimary} font-medium`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">📁</span>
                                                    {folder.name}
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 ${textSecondary}`}>{folder.document_count} docs</td>
                                            <td className={`px-6 py-4 ${textSecondary} text-sm`}>
                                                {folder.created_at ? new Date(folder.created_at).toLocaleDateString('es-ES') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        /* Vista de documentos dentro de carpeta */
                        loadingDocs ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className={textSecondary}>Cargando documentos...</p>
                            </div>
                        ) : filteredDocs.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-6xl mb-4">📄</div>
                                <p className={`${textSecondary} text-lg`}>{search ? 'Sin resultados' : 'Carpeta vacia'}</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className={`${bgSecondary} border-b ${borderCls}`}>
                                    <tr>
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded cursor-pointer accent-emerald-600"
                                            />
                                        </th>
                                        <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Documento</th>
                                        <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Fecha</th>
                                        <th className={`px-4 py-3 text-right text-xs font-medium ${textSecondary} uppercase`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDocs.map(doc => {
                                        const isExpanded = expandedDocId === doc.id;
                                        const isSelected = selectedDocIds.has(doc.id);
                                        const ext = doc.filename.toLowerCase().split('.').pop() || '';
                                        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
                                        const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'webm'];
                                        const isImage = doc.file_type?.startsWith('image/') || imageExts.includes(ext);
                                        const isAudio = doc.file_type?.startsWith('audio/') || audioExts.includes(ext);
                                        const icon = isAudio ? '🎵' : isImage ? '🖼️' : '📄';
                                        const viewLabel = isAudio ? 'Escuchar' : 'Ver';
                                        return (
                                            <React.Fragment key={doc.id}>
                                                <tr className={`border-b ${borderCls} ${hoverRow} ${isSelected ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50') : ''}`}>
                                                    <td className="px-4 py-4 w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleDocSelection(doc.id)}
                                                            className="w-4 h-4 rounded cursor-pointer accent-emerald-600"
                                                        />
                                                    </td>
                                                    <td className={`px-4 py-4 ${textPrimary}`}>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg">{icon}</span>
                                                            {doc.filename}
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-4 ${textSecondary} text-sm`}>
                                                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('es-ES') : '-'}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {doc.pdf_blob_url && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                                                                        className={`px-3 py-1.5 text-sm rounded-lg ${isExpanded ? 'bg-emerald-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                                                    >
                                                                        {isExpanded ? 'Ocultar' : viewLabel}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => downloadDocument(doc)}
                                                                        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                                                    >
                                                                        Descargar
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={async () => {
                                                                    if (!window.confirm(`¿Eliminar "${doc.filename}"?`)) return;
                                                                    try {
                                                                        await fetch('/api/rag/delete', {
                                                                            method: 'DELETE',
                                                                            credentials: 'include',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ type: 'document', documentId: doc.id }),
                                                                        });
                                                                        await fetch(`/api/extractions/${doc.id}`, {
                                                                            method: 'DELETE',
                                                                            credentials: 'include',
                                                                        });
                                                                        setDocs(prev => prev.filter(d => d.id !== doc.id));
                                                                        setSelectedDocIds(prev => {
                                                                            const next = new Set(prev);
                                                                            next.delete(doc.id);
                                                                            return next;
                                                                        });
                                                                        if (selectedFolder) {
                                                                            setFolders(prev => prev.map(f =>
                                                                                f.id === selectedFolder
                                                                                    ? { ...f, document_count: Math.max(0, f.document_count - 1) }
                                                                                    : f
                                                                            ));
                                                                        }
                                                                    } catch (err) {
                                                                        console.error('Error eliminando:', err);
                                                                        alert('Error al eliminar el documento');
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
                                                                title="Eliminar documento"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && doc.pdf_blob_url && (
                                                    <tr className={`border-b ${borderCls}`}>
                                                        <td colSpan={4} className="px-6 py-4">
                                                            <div className={`border ${borderCls} rounded-lg overflow-hidden`}>
                                                                <div className="flex justify-center p-4">
                                                                    {isAudio ? (
                                                                        <audio controls src={doc.pdf_blob_url} style={{ width: '100%', maxWidth: '500px' }}>
                                                                            Tu navegador no soporta el reproductor de audio.
                                                                        </audio>
                                                                    ) : isImage ? (
                                                                        <ImageViewer src={doc.pdf_blob_url!} alt={doc.filename} isDarkMode={isDarkMode} />
                                                                    ) : (
                                                                        <iframe
                                                                            src={doc.pdf_blob_url}
                                                                            title={doc.filename}
                                                                            style={{ width: '100%', height: '500px', border: 'none' }}
                                                                        />
                                                                    )}
                                                                </div>
                                                                <div className={`px-4 py-2 border-t ${borderCls} flex justify-end`}>
                                                                    <a
                                                                        href={doc.pdf_blob_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-sm text-emerald-500 hover:text-emerald-400"
                                                                    >
                                                                        Abrir en nueva pestana →
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
