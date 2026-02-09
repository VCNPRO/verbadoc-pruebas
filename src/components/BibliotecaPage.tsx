/**
 * BibliotecaPage - Biblioteca RAG
 * Visualización de carpetas y documentos ingestados
 */

import React, { useState, useEffect } from 'react';
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

    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    const filteredDocs = docs.filter(d => d.filename.toLowerCase().includes(search.toLowerCase()));

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

            {/* Buscador */}
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className={`${bgCard} border ${borderCls} rounded-lg p-4`}>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={selectedFolder ? 'Buscar documento...' : 'Buscar carpeta...'}
                        className={`w-full px-3 py-2 rounded-md border ${bgInput}`}
                    />
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
                                        <th className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Documento</th>
                                        <th className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Fecha</th>
                                        <th className={`px-6 py-3 text-right text-xs font-medium ${textSecondary} uppercase`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDocs.map(doc => {
                                        const isExpanded = expandedDocId === doc.id;
                                        const isImage = doc.file_type?.startsWith('image/') || false;
                                        const isAudio = doc.file_type?.startsWith('audio/') || false;
                                        const icon = isAudio ? '🎵' : isImage ? '🖼️' : '📄';
                                        const viewLabel = isAudio ? 'Escuchar' : 'Ver';
                                        return (
                                            <React.Fragment key={doc.id}>
                                                <tr className={`border-b ${borderCls} ${hoverRow}`}>
                                                    <td className={`px-6 py-4 ${textPrimary}`}>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg">{icon}</span>
                                                            {doc.filename}
                                                        </div>
                                                    </td>
                                                    <td className={`px-6 py-4 ${textSecondary} text-sm`}>
                                                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('es-ES') : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {doc.pdf_blob_url && (
                                                            <div className="flex items-center justify-end gap-2">
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
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && doc.pdf_blob_url && (
                                                    <tr className={`border-b ${borderCls}`}>
                                                        <td colSpan={3} className="px-6 py-4">
                                                            <div className={`border ${borderCls} rounded-lg overflow-hidden`}>
                                                                <div className="flex justify-center p-4">
                                                                    {isAudio ? (
                                                                        <audio controls src={doc.pdf_blob_url} style={{ width: '100%', maxWidth: '500px' }}>
                                                                            Tu navegador no soporta el reproductor de audio.
                                                                        </audio>
                                                                    ) : isImage ? (
                                                                        <img
                                                                            src={doc.pdf_blob_url}
                                                                            alt={doc.filename}
                                                                            style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
                                                                        />
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
                                                                        Abrir en nueva pestaña →
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
