import React, { useState, useEffect } from 'react';
import { XIcon } from './Icons';

interface PdfViewerProps {
    file: File | null;
    onClose: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, onClose }) => {
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isPdf, setIsPdf] = useState(false);
    const [isImage, setIsImage] = useState(false);

    useEffect(() => {
        if (!file) {
            setFileUrl(null);
            return;
        }

        // Create object URL for the file
        const url = URL.createObjectURL(file);
        setFileUrl(url);

        // Determine file type
        const type = file.type.toLowerCase();
        setIsPdf(type === 'application/pdf');
        setIsImage(type.startsWith('image/'));

        // Cleanup function to revoke the object URL
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file]);

    if (!file || !fileUrl) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full h-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div className="flex-grow min-w-0">
                        <h2 className="text-lg font-semibold text-slate-100 truncate">
                            {file.name}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {(file.size / 1024).toFixed(2)} KB
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Cerrar"
                    >
                        <XIcon className="w-5 h-5 text-slate-300" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-hidden">
                    {isPdf && (
                        <iframe
                            src={fileUrl}
                            className="w-full h-full"
                            title={file.name}
                        />
                    )}
                    {isImage && (
                        <div className="w-full h-full overflow-auto p-4 flex items-center justify-center bg-slate-900">
                            <img
                                src={fileUrl}
                                alt={file.name}
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                    )}
                    {!isPdf && !isImage && (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <p className="text-lg mb-2">Vista previa no disponible</p>
                                <p className="text-sm">
                                    Este tipo de archivo ({file.type || 'desconocido'}) no se puede visualizar.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                    <div className="flex justify-between items-center">
                        <div className="text-xs text-slate-400">
                            Tipo: {file.type || 'desconocido'}
                        </div>
                        {fileUrl && (
                            <a
                                href={fileUrl}
                                download={file.name}
                                className="text-xs px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors"
                            >
                                Descargar
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
