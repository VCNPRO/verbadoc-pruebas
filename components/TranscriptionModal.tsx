// components/TranscriptionModal.tsx
import React from 'react';
import { downloadTextAsPDF } from '../utils/exportUtils.ts';

interface TranscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    text: string;
    filename: string;
    isLightMode?: boolean;
}

export const TranscriptionModal: React.FC<TranscriptionModalProps> = ({ isOpen, onClose, text, filename, isLightMode }) => {
    if (!isOpen) return null;

    const handleDownloadTXT = () => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename.replace(/\.[^/.]+$/, '')}_transcripcion.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = () => {
        downloadTextAsPDF(text, `${filename.replace(/\.[^/.]+$/, '')}_transcripcion`);
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
                style={{
                    backgroundColor: isLightMode ? '#ffffff' : '#1e293b'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-4 border-b"
                    style={{
                        backgroundColor: isLightMode ? '#eff6ff' : 'rgba(15, 23, 42, 0.5)',
                        borderBottomColor: isLightMode ? '#93c5fd' : '#475569'
                    }}
                >
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: isLightMode ? '#1e3a8a' : '#f1f5f9' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: isLightMode ? '#2563eb' : '#06b6d4' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Transcripción Completa
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg transition-all hover:opacity-80"
                        style={{
                            backgroundColor: isLightMode ? '#fee2e2' : 'rgba(239, 68, 68, 0.2)',
                            color: isLightMode ? '#dc2626' : '#f87171'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow p-6 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm" style={{ color: isLightMode ? '#334155' : '#cbd5e1' }}>
                        {text}
                    </pre>
                </div>

                {/* Footer with actions */}
                <div
                    className="p-4 border-t flex justify-end gap-3"
                    style={{
                        backgroundColor: isLightMode ? '#f9fafb' : 'rgba(30, 41, 59, 0.8)',
                        borderTopColor: isLightMode ? '#dbeafe' : '#334155'
                    }}
                >
                    <button
                        onClick={handleDownloadTXT}
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                        style={{
                            backgroundColor: isLightMode ? '#2563eb' : '#3b82f6',
                            color: '#ffffff'
                        }}
                    >
                        Descargar TXT
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                        style={{
                            backgroundColor: isLightMode ? '#dc2626' : '#ef4444',
                            color: '#ffffff'
                        }}
                    >
                        Descargar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
