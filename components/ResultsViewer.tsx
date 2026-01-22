import React, { useState, useEffect } from 'react';
import type { ExtractionResult } from '../types.ts';
import { JsonViewer } from './JsonViewer.tsx';
import { downloadExcel, downloadCSV, downloadPDF as downloadExtractionPDF, downloadTextAsPDF } from '../utils/exportUtils.ts';
import { DocumentTextIcon, TableCellsIcon } from './Icons.tsx';

interface ResultsViewerProps {
    results: ExtractionResult[];
    theme?: any;
    isLightMode?: boolean;
    onClose?: () => void;
    onDeleteResult?: (resultId: string) => void;
    onClearHistory?: () => void;
    onExportHistory?: () => void;
    onExportExcel?: (transposed: boolean) => void;
    onExportAllPDFs?: () => void;
    onImportHistory?: () => void;
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({
    results,
    theme,
    isLightMode,
    onClose,
    onDeleteResult,
    onClearHistory,
    onExportHistory,
    onExportExcel,
    onExportAllPDFs,
    onImportHistory
}) => {
    const [selectedResult, setSelectedResult] = useState<ExtractionResult | null>(null);
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
    
    useEffect(() => {
        if (results.length > 0 && !selectedResult) {
            setSelectedResult(results[0]);
        }
        if (selectedResult && !results.find(r => r.id === selectedResult.id)) {
            setSelectedResult(results.length > 0 ? results[0] : null);
        }
    }, [results, selectedResult]);

    const [excelTransposed, setExcelTransposed] = useState<boolean>(false);
    const [historyExcelTransposed, setHistoryExcelTransposed] = useState<boolean>(false);

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

    const toggleSelectAll = () => {
        if (selectedResultIds.size === results.length) {
            setSelectedResultIds(new Set());
        } else {
            setSelectedResultIds(new Set(results.map(r => r.id)));
        }
    };

    const cardBg = isLightMode ? '#ffffff' : 'rgba(30, 41, 59, 0.5)';
    const borderColor = isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)';
    const textColor = isLightMode ? '#1e3a8a' : '#f1f5f9';
    const textSecondary = isLightMode ? '#475569' : '#94a3b8';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';
    const headerBg = isLightMode ? '#eff6ff' : 'rgba(2, 6, 23, 0.5)';

    // Handlers for Transcription downloads
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

    // Handlers for Extraction downloads
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
            true // Siempre en formato vertical
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
            alert('Resultado copiado al portapapeles');
        }
    };

    const handleDownloadSelectedCSV = () => {
        if (selectedResultIds.size === 0) {
            alert('Selecciona al menos un resultado para exportar');
            return;
        }

        const selectedResults = results.filter(r => selectedResultIds.has(r.id) && r.type === 'extraction');
        if (selectedResults.length === 0) {
            alert('No hay resultados de extracción seleccionados');
            return;
        }

        // Consolidar todos los resultados en un solo CSV
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

        // Obtener todas las columnas
        const allKeys = new Set<string>();
        rows.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
        const headers = Array.from(allKeys);

        // Crear CSV
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
        link.download = `resultados_consolidados_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadSelectedExcel = () => {
        if (selectedResultIds.size === 0) {
            alert('Selecciona al menos un resultado para exportar');
            return;
        }

        const selectedResults = results.filter(r => selectedResultIds.has(r.id) && r.type === 'extraction');
        if (selectedResults.length === 0) {
            alert('No hay resultados de extracción seleccionados');
            return;
        }

        // Consolidar todos los resultados
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
            `resultados_consolidados_${new Date().toISOString().split('T')[0]}`,
            null,
            false // horizontal
        );
    };

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full rounded-lg border p-6 text-center transition-colors duration-500" style={{ backgroundColor: cardBg, borderColor: borderColor }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: textSecondary }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <h3 className="text-xl font-semibold" style={{ color: textColor }}>Sin Resultados</h3>
                <p className="max-w-sm mx-auto mt-1" style={{ color: textSecondary }}>Los resultados de las extracciones y transcripciones aparecerán aquí.</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border flex flex-col h-full transition-colors duration-500" style={{ backgroundColor: cardBg, borderColor: borderColor }}>
            <div className="p-4 border-b transition-colors duration-500" style={{ backgroundColor: headerBg, borderBottomColor: borderColor }}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: textColor }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: accentColor }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Resultados
                    </h2>
                    {onClose && <button onClick={onClose} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: textSecondary }}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {results.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: textColor }}>
                                <input
                                    type="checkbox"
                                    checked={selectedResultIds.size === results.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded"
                                    style={{ accentColor: accentColor }}
                                />
                                {selectedResultIds.size > 0 ? `${selectedResultIds.size} seleccionados` : 'Seleccionar todos'}
                            </label>
                            {selectedResultIds.size > 0 && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDownloadSelectedCSV}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all hover:opacity-90"
                                        style={{ backgroundColor: isLightMode ? '#059669' : '#10b981', color: '#ffffff' }}
                                        title="Exportar seleccionados a CSV consolidado"
                                    >
                                        📊 CSV
                                    </button>
                                    <button
                                        onClick={handleDownloadSelectedExcel}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all hover:opacity-90"
                                        style={{ backgroundColor: isLightMode ? '#16a34a' : '#22c55e', color: '#ffffff' }}
                                        title="Exportar seleccionados a Excel consolidado"
                                    >
                                        📗 Excel
                                    </button>
                                </div>
                            )}
                        </div>

                        <label className="block text-sm font-medium mb-2" style={{ color: textColor }}>Ver resultado:</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto p-2 rounded" style={{ backgroundColor: isLightMode ? '#f9fafb' : 'rgba(15, 23, 42, 0.5)' }}>
                            {results.map(result => (
                                <div key={result.id} className="flex items-center gap-2 p-2 rounded transition-colors hover:opacity-80" style={{ backgroundColor: selectedResult?.id === result.id ? (isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)') : 'transparent' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedResultIds.has(result.id)}
                                        onChange={() => toggleResultSelection(result.id)}
                                        className="w-4 h-4 rounded flex-shrink-0"
                                        style={{ accentColor: accentColor }}
                                    />
                                    <button
                                        onClick={() => setSelectedResult(result)}
                                        className="flex-1 text-left text-sm truncate"
                                        style={{ color: textColor }}
                                    >
                                        {result.type === 'transcription' ? '📄' : '📊'} {result.fileName} - {new Date(result.timestamp).toLocaleString()}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Botones para borrar resultados */}
                        {onDeleteResult && selectedResult && (
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => onDeleteResult(selectedResult.id)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: isLightMode ? '#dc2626' : '#ef4444',
                                        color: '#ffffff'
                                    }}
                                    title="Borrar resultado seleccionado"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Borrar este resultado
                                </button>
                                {onClearHistory && results.length > 1 && (
                                    <button
                                        onClick={onClearHistory}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                        style={{
                                            backgroundColor: isLightMode ? '#7c2d12' : '#991b1b',
                                            color: '#ffffff'
                                        }}
                                        title="Borrar todos los resultados"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Borrar todos
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {(onClearHistory || onExportHistory || onImportHistory || onExportExcel) && (
                    <div className="p-3 rounded-lg border transition-colors" style={{ backgroundColor: isLightMode ? '#eff6ff' : 'rgba(55, 65, 81, 0.5)', borderColor: borderColor }}>
                        <h3 className="text-sm font-semibold mb-2" style={{ color: textColor }}>📂 Gestión de Historial ({results.length} resultados)</h3>
                        {onExportExcel && (
                            <div className="mb-3 p-2 rounded-md" style={{ backgroundColor: isLightMode ? '#f0f9ff' : 'rgba(15, 23, 42, 0.5)' }}>
                                <p className="text-xs font-medium mb-1.5" style={{ color: textColor }}>Formato de Excel para historial completo (solo extracciones):</p>
                                {/* ... (resto de la UI de gestión de historial) ... */}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">{/* ... (botones de gestión) ... */}</div>
                    </div>
                )}

                {selectedResult && (
                    <>
                        <div className="p-3 rounded-lg border transition-colors" style={{ backgroundColor: isLightMode ? '#f0fdf4' : 'rgba(15, 23, 42, 0.5)', borderColor: borderColor }}>
                            <p className="text-sm font-semibold" style={{ color: textColor }}>{selectedResult.fileName}</p>
                            <p className="text-xs mt-1" style={{ color: textSecondary }}>{selectedResult.type === 'transcription' ? 'Transcripción' : 'Extracción'} el {new Date(selectedResult.timestamp).toLocaleString()}</p>
                        </div>
                        
                        {/* VISTA PARA TRANSCRIPCIÓN */}
                        {selectedResult.type === 'transcription' && (
                            <div className="space-y-4">
                                {selectedResult.metadata && (
                                    <div className="p-3 rounded-lg border" style={{ backgroundColor: isLightMode ? '#f0f9ff' : 'rgba(30, 41, 59, 0.8)', borderColor: borderColor }}>
                                        <h4 className="text-sm font-bold mb-2" style={{ color: textColor }}>Metadatos Generados</h4>
                                        <div className="space-y-2 text-sm">
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
                                <div>
                                    <h4 className="text-sm font-bold mb-2" style={{ color: textColor }}>Transcripción Completa</h4>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <button onClick={handleDownloadTranscriptionPDF} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90" style={{ backgroundColor: isLightMode ? '#dc2626' : '#ef4444', color: '#ffffff' }} title="Descargar PDF"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>Descargar PDF</button>
                                        <button onClick={handleDownloadTranscriptionTXT} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90" style={{ backgroundColor: isLightMode ? '#2563eb' : '#3b82f6', color: '#ffffff' }}><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Descargar TXT</button>
                                        <button onClick={handleCopyToClipboard} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90" style={{ backgroundColor: isLightMode ? '#6ee7b7' : 'rgba(100, 116, 139, 0.5)', color: isLightMode ? '#064e3b' : '#f1f5f9', borderWidth: '1px', borderStyle: 'solid', borderColor: borderColor }}><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copiar Texto</button>
                                    </div>
                                    <div className="p-4 rounded-lg border transition-colors overflow-auto" style={{ backgroundColor: isLightMode ? '#f9fafb' : 'rgba(15, 23, 42, 0.5)', borderColor: borderColor, maxHeight: '45vh' }}>
                                        <pre className="whitespace-pre-wrap text-sm" style={{ color: isLightMode ? '#334155' : '#cbd5e1' }}>{selectedResult.transcription}</pre>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* VISTA PARA EXTRACCIÓN */}
                        {selectedResult.type === 'extraction' && (
                            <>
                                <div className="p-3 rounded-lg border transition-colors" style={{ backgroundColor: isLightMode ? '#f0f9ff' : 'rgba(30, 41, 59, 0.5)', borderColor: borderColor }}>
                                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: textColor }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: accentColor }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                        </svg>
                                        Formato de Excel
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setExcelTransposed(false)}
                                            className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${!excelTransposed ? 'font-bold' : ''}`}
                                            style={{
                                                backgroundColor: !excelTransposed ? (isLightMode ? '#2563eb' : '#3b82f6') : (isLightMode ? '#e2e8f0' : 'rgba(71, 85, 105, 0.3)'),
                                                color: !excelTransposed ? '#ffffff' : (isLightMode ? '#64748b' : '#94a3b8'),
                                                borderWidth: '1px',
                                                borderStyle: 'solid',
                                                borderColor: !excelTransposed ? (isLightMode ? '#2563eb' : '#3b82f6') : borderColor
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
                                                backgroundColor: excelTransposed ? (isLightMode ? '#2563eb' : '#3b82f6') : (isLightMode ? '#e2e8f0' : 'rgba(71, 85, 105, 0.3)'),
                                                color: excelTransposed ? '#ffffff' : (isLightMode ? '#64748b' : '#94a3b8'),
                                                borderWidth: '1px',
                                                borderStyle: 'solid',
                                                borderColor: excelTransposed ? (isLightMode ? '#2563eb' : '#3b82f6') : borderColor
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
                                            : '📊 Cada campo en una columna (ideal para comparar registros)'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handleDownloadJSON}
                                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                        style={{ backgroundColor: isLightMode ? '#8b5cf6' : '#a78bfa', color: '#ffffff' }}
                                        title="Descargar JSON"
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
                                        title="Descargar CSV"
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
                                        title={`Descargar Excel (${excelTransposed ? 'Vertical' : 'Horizontal'})`}
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
                                        title="Descargar PDF (formato vertical)"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        PDF
                                    </button>
                                    <button
                                        onClick={handleCopyToClipboard}
                                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                        style={{
                                            backgroundColor: isLightMode ? '#6ee7b7' : 'rgba(100, 116, 139, 0.5)',
                                            color: isLightMode ? '#064e3b' : '#f1f5f9',
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            borderColor: borderColor
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copiar
                                    </button>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold mb-2" style={{ color: textColor }}>Datos Extraídos:</h3>
                                    <div className="p-4 rounded-lg border transition-colors overflow-x-auto" style={{ backgroundColor: isLightMode ? '#f9fafb' : 'rgba(15, 23, 42, 0.5)', borderColor: borderColor }}>
                                        <JsonViewer data={selectedResult.extractedData} />
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
