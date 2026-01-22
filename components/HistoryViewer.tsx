
import React from 'react';
// Fix: Use explicit file extension in import.
import type { ExtractionResult } from '../types.ts';
// Fix: Use explicit file extension in import.
import { HistoryIcon } from './Icons.tsx';
// Fix: Use explicit file extension in import.
import { JsonViewer } from './JsonViewer.tsx';

interface HistoryViewerProps {
    history: ExtractionResult[];
    onReplay: (result: ExtractionResult) => void;
    theme?: any;
    isHealthMode?: boolean;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ history, onReplay, theme, isHealthMode }) => {
    const cardBg = isHealthMode ? '#ffffff' : 'rgba(30, 41, 59, 0.5)';
    const borderColor = isHealthMode ? theme?.border || '#6ee7b7' : 'rgba(51, 65, 85, 0.5)';
    const textColor = isHealthMode ? theme?.text || '#064e3b' : '#f1f5f9';
    const textSecondary = isHealthMode ? theme?.textSecondary || '#065f46' : '#94a3b8';
    const accentColor = isHealthMode ? theme?.primary || '#047857' : '#06b6d4';

    if (history.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center h-full rounded-lg border p-6 text-center transition-colors duration-500"
                style={{
                    backgroundColor: cardBg,
                    borderColor: borderColor
                }}
            >
                <HistoryIcon className="w-16 h-16 mb-4" style={{ color: textSecondary }} />
                <h3 className="text-xl font-semibold" style={{ color: textColor }}>Historial Vacío</h3>
                <p className="max-w-sm mx-auto mt-1" style={{ color: textSecondary }}>
                    Las extracciones que complete aparecerán aquí para que pueda revisarlas y reutilizarlas.
                </p>
            </div>
        );
    }
    
    return (
        <div
            className="rounded-lg border flex flex-col h-full transition-colors duration-500"
            style={{
                backgroundColor: cardBg,
                borderColor: borderColor
            }}
        >
            <div className="p-4 border-b transition-colors duration-500" style={{ borderBottomColor: borderColor }}>
                <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: textColor }}>
                    <HistoryIcon className="w-6 h-6" style={{ color: accentColor }} />
                    Historial de Extracciones
                </h2>
            </div>
            <div className="overflow-y-auto flex-grow">
                <ul className="divide-y transition-colors duration-500" style={{ borderColor: borderColor }}>
                    {history.map(item => (
                        <li key={item.id} className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold" style={{ color: accentColor }}>{item.fileName}</p>
                                    <p className="text-xs" style={{ color: textSecondary }}>{new Date(item.timestamp).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => onReplay(item)}
                                    className="text-xs px-2 py-1 rounded-md transition-all font-medium hover:opacity-90"
                                    style={{
                                        color: isHealthMode ? '#ffffff' : '#f1f5f9',
                                        backgroundColor: isHealthMode ? theme?.primary || '#047857' : '#475569'
                                    }}
                                >
                                    Reutilizar
                                </button>
                            </div>
                            <div
                                className="mt-3 p-3 rounded-md max-h-60 overflow-y-auto transition-colors duration-500"
                                style={{
                                    backgroundColor: isHealthMode ? '#f9fafb' : 'rgba(15, 23, 42, 0.5)',
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    borderColor: isHealthMode ? '#e5e7eb' : '#475569'
                                }}
                            >
                                <JsonViewer data={item.extractedData} />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
