import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExtractionResult } from '../types.ts';
import { JsonViewer } from './JsonViewer.tsx';
import { DocumentChat } from './DocumentChat.tsx';
import { downloadExcel, downloadCSV, downloadPDF as downloadExtractionPDF, downloadTextAsPDF } from '../utils/exportUtils.ts';

interface EnhancedResultsPageProps {
    results: ExtractionResult[];
    theme?: any;
    isLightMode?: boolean;
    isDarkMode?: boolean;
    onDeleteResult?: (resultId: string) => void;
    onClearHistory?: () => void;
    onExportHistory?: () => void;
    onExportExcel?: (transposed: boolean) => void;
    onExportAllPDFs?: () => void;
    onImportHistory?: () => void;
    onToggleTheme?: () => void;
}

type FilterStatus = 'all' | 'extraction' | 'transcription';
type SortField = 'name' | 'date';

export const EnhancedResultsPage: React.FC<EnhancedResultsPageProps> = ({
    results,
    theme,
    isLightMode,
    isDarkMode = false,
    onDeleteResult,
    onClearHistory,
    onExportHistory,
    onExportExcel,
    onExportAllPDFs,
    onImportHistory,
    onToggleTheme
}) => {
    const navigate = useNavigate();
    // Estados de filtrado y búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortAsc, setSortAsc] = useState(false);

    // Estados de selección
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
    const [selectedResult, setSelectedResult] = useState<ExtractionResult | null>(null);

    // Estados de formato Excel
    const [excelTransposed, setExcelTransposed] = useState<boolean>(false);
    const [historyExcelTransposed, setHistoryExcelTransposed] = useState<boolean>(false);

    // Seleccionar primer resultado automáticamente
    useEffect(() => {
        if (results.length > 0 && !selectedResult) {
            setSelectedResult(results[0]);
        }
        if (selectedResult && !results.find(r => r.id === selectedResult.id)) {
            setSelectedResult(results.length > 0 ? results[0] : null);
        }
    }, [results, selectedResult]);

    // Colores
    const cardBg = isLightMode ? '#ffffff' : 'rgba(30, 41, 59, 0.5)';
    const borderColor = isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)';
    const textColor = isLightMode ? '#1e3a8a' : '#f1f5f9';
    const textSecondary = isLightMode ? '#475569' : '#94a3b8';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';
    const headerBg = isLightMode ? '#eff6ff' : 'rgba(15, 23, 42, 0.5)';

    // Estadísticas
    const stats = useMemo(() => {
        const total = results.length;
        const extractions = results.filter(r => r.type === 'extraction').length;
        const transcriptions = results.filter(r => r.type === 'transcription').length;

        return { total, extractions, transcriptions };
    }, [results]);

    // Filtrado y búsqueda
    const filteredResults = useMemo(() => {
        let filtered = results;

        // Filtro por tipo
        if (filterStatus !== 'all') {
            filtered = filtered.filter(r => r.type === filterStatus);
        }

        // Búsqueda
        if (searchTerm) {
            filtered = filtered.filter(r =>
                r.fileName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Ordenamiento
        filtered = [...filtered].sort((a, b) => {
            let comparison = 0;

            if (sortField === 'name') {
                comparison = a.fileName.localeCompare(b.fileName);
            } else if (sortField === 'date') {
                comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            }

            return sortAsc ? comparison : -comparison;
        });

        return filtered;
    }, [results, searchTerm, filterStatus, sortField, sortAsc]);

    // Selección
    const toggleSelectAll = () => {
        if (selectedResultIds.size === filteredResults.length && filteredResults.length > 0) {
            setSelectedResultIds(new Set());
        } else {
            setSelectedResultIds(new Set(filteredResults.map(r => r.id)));
        }
    };

    const toggleResultSelection = (resultId: string) => {
        setSelectedResultIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(resultId)) {
                newSet.delete(resultId);
            } else {
                newSet.add(resultId);
            }
            return newSet;
        });
    };

    // ==================== DESCARGAS INDIVIDUALES ====================

    // Para Transcripciones
    const handleDownloadTranscriptionTXT = () => {
        if (!selectedResult || !selectedResult.transcription) return;
        const blob = new Blob([selectedResult.transcription], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedResult.fileName.replace(/\.[^/.]+$/, '')}_transcripcion.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadTranscriptionPDF = () => {
        if (!selectedResult || !selectedResult.transcription) return;
        downloadTextAsPDF(selectedResult.transcription, `${selectedResult.fileName.replace(/\.[^/.]+$/, '')}_transcripcion`);
    };

    // Para Extracciones
    const handleDownloadJSON = () => {
        if (!selectedResult || !selectedResult.extractedData) return;
        const dataStr = JSON.stringify(selectedResult.extractedData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedResult.fileName.replace(/\.[^/.]+$/, '')}_extraccion.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadCSV = () => {
        if (!selectedResult || !selectedResult.extractedData) return;
        downloadCSV(
            selectedResult.extractedData,
            `${selectedResult.fileName.replace(/\.[^/.]+$/, '')}_extraccion`,
            selectedResult.schema
        );
    };

    const handleDownloadExtractionPDF = () => {
        if (!selectedResult || !selectedResult.extractedData) return;
        downloadExtractionPDF(
            selectedResult.extractedData,
            `${selectedResult.fileName.replace(/\.[^/.]+$/, '')}_extraccion`,
            selectedResult.schema,
            true
        );
    };

    const handleDownloadExcel = () => {
        if (!selectedResult || !selectedResult.extractedData) return;
        downloadExcel(
            selectedResult.extractedData,
            `${selectedResult.fileName.replace(/\.[^/.]+$/, '')}_extraccion`,
            selectedResult.schema,
            excelTransposed
        );
    };

    const handleCopyToClipboard = () => {
        if (!selectedResult) return;
        const contentToCopy = selectedResult.type === 'transcription'
            ? selectedResult.transcription
            : JSON.stringify(selectedResult.extractedData, null, 2);

        if (contentToCopy) {
            navigator.clipboard.writeText(contentToCopy);
            alert('✅ Contenido copiado al portapapeles');
        }
    };

    // ==================== EXPORTACIÓN CONSOLIDADA ====================

    const handleDownloadSelectedCSV = () => {
        if (selectedResultIds.size === 0) {
            alert('Selecciona al menos un resultado');
            return;
        }

        const selectedResults = results.filter(r => selectedResultIds.has(r.id) && r.type === 'extraction');
        if (selectedResults.length === 0) {
            alert('No hay resultados de extracción seleccionados');
            return;
        }

        const rows: any[] = [];
        selectedResults.forEach(result => {
            const data = result.extractedData;
            const flatData = {
                archivo: result.fileName,
                fecha_procesamiento: new Date(result.timestamp).toLocaleString(),
                ...data
            };
            rows.push(flatData);
        });

        const allKeys = new Set<string>();
        rows.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
        const headers = Array.from(allKeys);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => headers.map(h => {
                const value = row[h];
                if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                return `"${String(value || '').replace(/"/g, '""')}"`;
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `resultados_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadSelectedExcel = () => {
        if (selectedResultIds.size === 0) {
            alert('Selecciona al menos un resultado');
            return;
        }

        const selectedResults = results.filter(r => selectedResultIds.has(r.id) && r.type === 'extraction');
        if (selectedResults.length === 0) {
            alert('No hay resultados de extracción seleccionados');
            return;
        }

        const rows: any[] = [];
        selectedResults.forEach(result => {
            const data = result.extractedData;
            const flatData = {
                archivo: result.fileName,
                fecha_procesamiento: new Date(result.timestamp).toLocaleString(),
                ...data
            };
            rows.push(flatData);
        });

        downloadExcel(
            rows,
            `resultados_${new Date().toISOString().split('T')[0]}`,
            null,
            false
        );
    };

    // ==================== VISTA VACÍA ====================

    if (results.length === 0) {
        return (
            <div className="min-h-screen flex flex-col" style={{ backgroundColor: isLightMode ? '#f0f9ff' : '#0f172a' }}>
                <header
                    className="backdrop-blur-sm border-b-2 sticky top-0 z-10 transition-colors duration-500 shadow-md"
                    style={{
                        backgroundColor: isLightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(2, 6, 23, 0.7)',
                        borderBottomColor: isLightMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(51, 65, 85, 0.5)'
                    }}
                >
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => navigate('/')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:opacity-80"
                                    style={{
                                        backgroundColor: isLightMode ? '#3b82f6' : '#06b6d4',
                                        color: '#ffffff'
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Volver
                                </button>
                                <h1 className="text-2xl font-bold font-orbitron tracking-wider" style={{ color: textColor }}>
                                    📊 Resultados
                                </h1>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex items-center justify-center p-6">
                    <div 
                        className="max-w-2xl w-full rounded-2xl border-2 p-12 text-center shadow-2xl backdrop-blur-md relative overflow-hidden"
                        style={{ 
                            backgroundColor: isLightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(30, 41, 59, 0.4)', 
                            borderColor: isLightMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(6, 182, 212, 0.3)' 
                        }}
                    >
                        {/* Decoración de fondo */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ backgroundColor: accentColor }}></div>
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-10" style={{ backgroundColor: '#8b5cf6' }}></div>

                        <div className="relative z-10">
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8" style={{ backgroundColor: isLightMode ? '#eff6ff' : 'rgba(6, 182, 212, 0.1)' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: accentColor }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>

                            <h3 className="text-3xl font-bold font-orbitron mb-4 tracking-tight" style={{ color: textColor }}>
                                Historial Vacío
                            </h3>
                            
                            <p className="text-lg mb-8 max-w-md mx-auto leading-relaxed" style={{ color: textSecondary }}>
                                Aún no has realizado ninguna extracción. Sube tus documentos para ver cómo la IA extrae datos estructurados de forma automática.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={() => navigate('/')}
                                    className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white transition-all hover:scale-105 shadow-lg active:scale-95"
                                    style={{ 
                                        background: isLightMode ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' 
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Nueva Extracción
                                </button>
                                
                                {onImportHistory && (
                                    <button
                                        onClick={onImportHistory}
                                        className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold border-2 transition-all hover:opacity-80 active:scale-95"
                                        style={{ 
                                            borderColor: borderColor,
                                            color: textColor,
                                            backgroundColor: isLightMode ? '#ffffff' : 'rgba(30, 41, 59, 0.5)'
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Importar Datos
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ==================== VISTA PRINCIPAL ====================

    return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: isLightMode ? '#f0f9ff' : '#0f172a' }}>
            {/* Header / Navbar */}
            <header
                className="backdrop-blur-sm border-b-2 sticky top-0 z-10 transition-colors duration-500 shadow-md"
                style={{
                    backgroundColor: isLightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(2, 6, 23, 0.7)',
                    borderBottomColor: isLightMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(51, 65, 85, 0.5)'
                }}
            >
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:opacity-80"
                                style={{
                                    backgroundColor: isLightMode ? '#3b82f6' : '#06b6d4',
                                    color: '#ffffff'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Volver
                            </button>
                            <h1
                                className="text-2xl font-bold font-orbitron tracking-wider transition-colors duration-500"
                                style={{
                                    color: isLightMode ? '#1e3a8a' : '#f1f5f9'
                                }}
                            >
                                📊 Resultados
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            {onToggleTheme && (
                                <button
                                    onClick={onToggleTheme}
                                    className="flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition-all duration-500 hover:shadow-lg hover:scale-105"
                                    style={{
                                        backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                                        borderColor: isLightMode ? '#3b82f6' : '#475569',
                                        color: isLightMode ? '#1e3a8a' : '#fbbf24'
                                    }}
                                    title={isDarkMode ? "Cambiar a modo día" : "Cambiar a modo noche"}
                                >
                                    {isDarkMode ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="flex h-[calc(100vh-140px)] gap-4">
            {/* PANEL IZQUIERDO: Estadísticas, Filtros y Lista */}
            <div className="w-80 flex flex-col rounded-lg border overflow-hidden" style={{ backgroundColor: cardBg, borderColor: borderColor }}>
                {/* Header con estadísticas */}
                <div className="p-4 border-b" style={{ borderColor: borderColor, backgroundColor: headerBg }}>
                    <h2 className="text-lg font-bold mb-3" style={{ color: textColor }}>📊 Resultados</h2>

                    {/* Estadísticas */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="p-2 rounded-lg text-center" style={{ backgroundColor: isLightMode ? '#eff6ff' : 'rgba(59, 130, 246, 0.1)' }}>
                            <div className="text-xl font-bold" style={{ color: accentColor }}>{stats.total}</div>
                            <div className="text-xs" style={{ color: textSecondary }}>Total</div>
                        </div>
                        <div className="p-2 rounded-lg text-center" style={{ backgroundColor: isLightMode ? '#f0fdf4' : 'rgba(34, 197, 94, 0.1)' }}>
                            <div className="text-xl font-bold text-green-500">{stats.extractions}</div>
                            <div className="text-xs" style={{ color: textSecondary }}>Datos</div>
                        </div>
                        <div className="p-2 rounded-lg text-center" style={{ backgroundColor: isLightMode ? '#fef3f2' : 'rgba(239, 68, 68, 0.1)' }}>
                            <div className="text-xl font-bold text-purple-500">{stats.transcriptions}</div>
                            <div className="text-xs" style={{ color: textSecondary }}>Textos</div>
                        </div>
                    </div>

                    {/* Búsqueda */}
                    <input
                        type="text"
                        placeholder="🔍 Buscar archivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 rounded-md text-sm border mb-2"
                        style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', borderColor: borderColor, color: textColor }}
                    />

                    {/* Filtros */}
                    <div className="flex gap-2 mb-2">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                            className="flex-1 px-2 py-1.5 rounded-md text-xs border"
                            style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', borderColor: borderColor, color: textColor }}
                        >
                            <option value="all">📁 Todos</option>
                            <option value="extraction">📊 Datos</option>
                            <option value="transcription">📄 Textos</option>
                        </select>
                        <select
                            value={sortField}
                            onChange={(e) => setSortField(e.target.value as SortField)}
                            className="flex-1 px-2 py-1.5 rounded-md text-xs border"
                            style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', borderColor: borderColor, color: textColor }}
                        >
                            <option value="date">📅 Fecha</option>
                            <option value="name">🔤 Nombre</option>
                        </select>
                        <button
                            onClick={() => setSortAsc(!sortAsc)}
                            className="px-2 py-1.5 rounded-md text-xs border hover:opacity-80"
                            style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', borderColor: borderColor, color: textColor }}
                            title={sortAsc ? 'Ascendente' : 'Descendente'}
                        >
                            {sortAsc ? '↑' : '↓'}
                        </button>
                    </div>

                    {/* Checkbox seleccionar todos */}
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:opacity-80" style={{ color: textColor }}>
                        <input
                            type="checkbox"
                            checked={selectedResultIds.size === filteredResults.length && filteredResults.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded"
                            style={{ accentColor: accentColor }}
                        />
                        {selectedResultIds.size > 0 ? `${selectedResultIds.size} seleccionados` : 'Seleccionar todos'}
                    </label>
                </div>

                {/* Lista de resultados */}
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredResults.length === 0 ? (
                        <div className="p-4 text-center text-sm" style={{ color: textSecondary }}>
                            No hay resultados para "{searchTerm}"
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredResults.map((result) => (
                                <div
                                    key={result.id}
                                    className="flex items-start gap-2 p-2 rounded-md cursor-pointer hover:opacity-80 transition-all"
                                    style={{
                                        backgroundColor: selectedResult?.id === result.id
                                            ? (isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)')
                                            : 'transparent'
                                    }}
                                    onClick={() => setSelectedResult(result)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedResultIds.has(result.id)}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            toggleResultSelection(result.id);
                                        }}
                                        className="w-4 h-4 rounded flex-shrink-0 mt-0.5"
                                        style={{ accentColor: accentColor }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <span className="text-sm">
                                                {result.type === 'extraction' ? '📊' : '📄'}
                                            </span>
                                            <span className="text-xs font-medium truncate" style={{ color: textColor }}>
                                                {result.fileName}
                                            </span>
                                        </div>
                                        <div className="text-xs" style={{ color: textSecondary }}>
                                            {new Date(result.timestamp).toLocaleDateString()} {new Date(result.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Acciones consolidadas */}
                {selectedResultIds.size > 0 && (
                    <div className="p-3 border-t space-y-2" style={{ borderColor: borderColor, backgroundColor: headerBg }}>
                        <div className="text-xs font-medium mb-1" style={{ color: textColor }}>Exportar seleccionados:</div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleDownloadSelectedCSV}
                                className="flex-1 px-2 py-1.5 rounded text-xs font-medium text-white transition-all hover:opacity-90"
                                style={{ backgroundColor: '#059669' }}
                            >
                                📊 CSV
                            </button>
                            <button
                                onClick={handleDownloadSelectedExcel}
                                className="flex-1 px-2 py-1.5 rounded text-xs font-medium text-white transition-all hover:opacity-90"
                                style={{ backgroundColor: '#16a34a' }}
                            >
                                📗 Excel
                            </button>
                        </div>
                    </div>
                )}

                {/* Gestión de historial */}
                <div className="p-3 border-t space-y-2" style={{ borderColor: borderColor }}>
                    <div className="text-xs font-medium mb-1" style={{ color: textColor }}>Gestión de Historial:</div>

                    {onExportExcel && (
                        <div className="mb-2 p-2 rounded" style={{ backgroundColor: isLightMode ? '#f0f9ff' : 'rgba(15, 23, 42, 0.5)' }}>
                            <p className="text-xs mb-1" style={{ color: textSecondary }}>Formato Excel historial:</p>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setHistoryExcelTransposed(false)}
                                    className={`flex-1 px-2 py-1 rounded text-xs ${!historyExcelTransposed ? 'font-bold' : ''}`}
                                    style={{
                                        backgroundColor: !historyExcelTransposed ? accentColor : (isLightMode ? '#e2e8f0' : 'rgba(71, 85, 105, 0.3)'),
                                        color: !historyExcelTransposed ? '#ffffff' : textSecondary
                                    }}
                                >
                                    ↔ H
                                </button>
                                <button
                                    onClick={() => setHistoryExcelTransposed(true)}
                                    className={`flex-1 px-2 py-1 rounded text-xs ${historyExcelTransposed ? 'font-bold' : ''}`}
                                    style={{
                                        backgroundColor: historyExcelTransposed ? accentColor : (isLightMode ? '#e2e8f0' : 'rgba(71, 85, 105, 0.3)'),
                                        color: historyExcelTransposed ? '#ffffff' : textSecondary
                                    }}
                                >
                                    ↕ V
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        {onExportHistory && (
                            <button
                                onClick={onExportHistory}
                                className="px-2 py-1.5 rounded text-xs font-medium transition-all hover:opacity-90"
                                style={{ backgroundColor: isLightMode ? '#8b5cf6' : '#a78bfa', color: '#ffffff' }}
                            >
                                💾 JSON
                            </button>
                        )}
                        {onExportExcel && (
                            <button
                                onClick={() => onExportExcel(historyExcelTransposed)}
                                className="px-2 py-1.5 rounded text-xs font-medium transition-all hover:opacity-90"
                                style={{ backgroundColor: isLightMode ? '#16a34a' : '#22c55e', color: '#ffffff' }}
                            >
                                📗 Excel
                            </button>
                        )}
                        {onExportAllPDFs && (
                            <button
                                onClick={onExportAllPDFs}
                                className="px-2 py-1.5 rounded text-xs font-medium transition-all hover:opacity-90"
                                style={{ backgroundColor: isLightMode ? '#dc2626' : '#ef4444', color: '#ffffff' }}
                            >
                                📄 PDFs
                            </button>
                        )}
                        {onImportHistory && (
                            <button
                                onClick={onImportHistory}
                                className="px-2 py-1.5 rounded text-xs font-medium transition-all hover:opacity-90"
                                style={{ backgroundColor: isLightMode ? '#2563eb' : '#3b82f6', color: '#ffffff' }}
                            >
                                📤 Importar
                            </button>
                        )}
                    </div>

                    {onClearHistory && (
                        <button
                            onClick={onClearHistory}
                            className="w-full px-2 py-1.5 rounded text-xs font-medium transition-all hover:opacity-90"
                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                        >
                            🗑️ Limpiar Todo
                        </button>
                    )}
                </div>
            </div>

            {/* PANEL DERECHO: Detalle del resultado seleccionado */}
            <div className="flex-1 flex flex-col rounded-lg border overflow-hidden" style={{ backgroundColor: cardBg, borderColor: borderColor }}>
                {selectedResult ? (
                    <>
                        {/* Header del detalle */}
                        <div className="p-4 border-b" style={{ borderColor: borderColor, backgroundColor: headerBg }}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: textColor }}>
                                        {selectedResult.type === 'extraction' ? '📊' : '📄'} {selectedResult.fileName}
                                    </h3>
                                    <p className="text-sm" style={{ color: textSecondary }}>
                                        {selectedResult.type === 'extraction' ? 'Extracción de Datos' : 'Transcripción de Texto'} • {new Date(selectedResult.timestamp).toLocaleString()}
                                    </p>
                                </div>
                                {onDeleteResult && (
                                    <button
                                        onClick={() => onDeleteResult(selectedResult.id)}
                                        className="px-3 py-2 rounded text-xs font-medium transition-all hover:opacity-90"
                                        style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                                        title="Borrar este resultado"
                                    >
                                        🗑️ Borrar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Contenido del detalle */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Chat: Pregúntale al Documento (para ambos tipos) */}
                            <DocumentChat result={selectedResult} isLightMode={isLightMode} />

                            {/* VISTA PARA TRANSCRIPCIÓN */}
                            {selectedResult.type === 'transcription' && (
                                <>
                                    {/* Metadatos si existen */}
                                    {selectedResult.metadata && (
                                        <div className="p-4 rounded-lg border" style={{ backgroundColor: isLightMode ? '#f0f9ff' : 'rgba(30, 41, 59, 0.8)', borderColor: borderColor }}>
                                            <h4 className="text-sm font-bold mb-3" style={{ color: textColor }}>📋 Metadatos Generados</h4>
                                            <div className="space-y-3 text-sm">
                                                <div>
                                                    <strong style={{ color: textSecondary }}>Título:</strong>
                                                    <p style={{ color: textColor }}>{selectedResult.metadata.title}</p>
                                                </div>
                                                <div>
                                                    <strong style={{ color: textSecondary }}>Resumen:</strong>
                                                    <p style={{ color: textColor }}>{selectedResult.metadata.summary}</p>
                                                </div>
                                                <div>
                                                    <strong style={{ color: textSecondary }}>Palabras Clave:</strong>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {selectedResult.metadata.keywords.map((kw, i) => (
                                                            <span key={i} className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: isLightMode ? '#dbeafe' : '#1e3a8a', color: isLightMode ? '#1e3a8a' : '#dbeafe' }}>{kw}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Botones de descarga para transcripción */}
                                    <div>
                                        <h4 className="text-sm font-bold mb-2" style={{ color: textColor }}>Descargar Transcripción:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={handleDownloadTranscriptionPDF}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                                style={{ backgroundColor: isLightMode ? '#dc2626' : '#ef4444', color: '#ffffff' }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                PDF
                                            </button>
                                            <button
                                                onClick={handleDownloadTranscriptionTXT}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                                style={{ backgroundColor: isLightMode ? '#2563eb' : '#3b82f6', color: '#ffffff' }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                TXT
                                            </button>
                                            <button
                                                onClick={handleCopyToClipboard}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90 border"
                                                style={{
                                                    backgroundColor: isLightMode ? '#6ee7b7' : 'rgba(100, 116, 139, 0.5)',
                                                    color: isLightMode ? '#064e3b' : '#f1f5f9',
                                                    borderColor: borderColor
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                Copiar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Texto completo */}
                                    <div>
                                        <h4 className="text-sm font-bold mb-2" style={{ color: textColor }}>Texto Completo:</h4>
                                        <div className="p-4 rounded-lg border overflow-auto" style={{ backgroundColor: isLightMode ? '#f9fafb' : 'rgba(15, 23, 42, 0.5)', borderColor: borderColor, maxHeight: '50vh' }}>
                                            <pre className="whitespace-pre-wrap text-sm" style={{ color: isLightMode ? '#334155' : '#cbd5e1' }}>{selectedResult.transcription}</pre>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* VISTA PARA EXTRACCIÓN */}
                            {selectedResult.type === 'extraction' && (
                                <>
                                    {/* Selector de formato Excel */}
                                    <div className="p-3 rounded-lg border" style={{ backgroundColor: isLightMode ? '#f0f9ff' : 'rgba(30, 41, 59, 0.5)', borderColor: borderColor }}>
                                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: textColor }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: accentColor }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                            </svg>
                                            Formato de Excel
                                        </h4>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setExcelTransposed(false)}
                                                className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${!excelTransposed ? 'font-bold' : ''}`}
                                                style={{
                                                    backgroundColor: !excelTransposed ? accentColor : (isLightMode ? '#e2e8f0' : 'rgba(71, 85, 105, 0.3)'),
                                                    color: !excelTransposed ? '#ffffff' : textSecondary
                                                }}
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                    </svg>
                                                    Horizontal (Columnas)
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setExcelTransposed(true)}
                                                className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${excelTransposed ? 'font-bold' : ''}`}
                                                style={{
                                                    backgroundColor: excelTransposed ? accentColor : (isLightMode ? '#e2e8f0' : 'rgba(71, 85, 105, 0.3)'),
                                                    color: excelTransposed ? '#ffffff' : textSecondary
                                                }}
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                                    </svg>
                                                    Vertical (Filas)
                                                </div>
                                            </button>
                                        </div>
                                        <p className="text-xs mt-2" style={{ color: textSecondary }}>
                                            {excelTransposed
                                                ? '📄 Cada campo en una fila (ideal para muchos campos)'
                                                : '📊 Cada campo en una columna (ideal para comparar)'}
                                        </p>
                                    </div>

                                    {/* Botones de descarga para extracción */}
                                    <div>
                                        <h4 className="text-sm font-bold mb-2" style={{ color: textColor }}>Descargar Extracción:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={handleDownloadJSON}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                                style={{ backgroundColor: isLightMode ? '#8b5cf6' : '#a78bfa', color: '#ffffff' }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                JSON
                                            </button>
                                            <button
                                                onClick={handleDownloadCSV}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                                style={{ backgroundColor: isLightMode ? '#059669' : '#10b981', color: '#ffffff' }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                CSV
                                            </button>
                                            <button
                                                onClick={handleDownloadExcel}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                                style={{ backgroundColor: isLightMode ? '#16a34a' : '#22c55e', color: '#ffffff' }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                Excel {excelTransposed ? '↕' : '↔'}
                                            </button>
                                            <button
                                                onClick={handleDownloadExtractionPDF}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                                style={{ backgroundColor: isLightMode ? '#dc2626' : '#ef4444', color: '#ffffff' }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                PDF
                                            </button>
                                            <button
                                                onClick={handleCopyToClipboard}
                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90 border"
                                                style={{
                                                    backgroundColor: isLightMode ? '#6ee7b7' : 'rgba(100, 116, 139, 0.5)',
                                                    color: isLightMode ? '#064e3b' : '#f1f5f9',
                                                    borderColor: borderColor
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                Copiar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Datos extraídos con JsonViewer */}
                                    <div>
                                        <h4 className="text-sm font-bold mb-2" style={{ color: textColor }}>Datos Extraídos:</h4>
                                        <div className="p-4 rounded-lg border overflow-x-auto" style={{ backgroundColor: isLightMode ? '#f9fafb' : 'rgba(15, 23, 42, 0.5)', borderColor: borderColor }}>
                                            <JsonViewer data={selectedResult.extractedData} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full p-8 text-center">
                        <div>
                            <div className="text-6xl mb-4">👈</div>
                            <p className="text-lg font-semibold mb-2" style={{ color: textColor }}>Selecciona un resultado</p>
                            <p className="text-sm" style={{ color: textSecondary }}>Haz clic en un archivo de la lista para ver su detalle</p>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </main>
        </div>
    );
};
