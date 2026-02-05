import React, { useState, useCallback, useRef } from 'react';
// Fix: Use explicit file extension in import.
import type { UploadedFile } from '../types.ts';
import { UploadCloudIcon, FileIcon, TrashIcon, CheckCircleIcon, ExclamationCircleIcon, SparklesIcon, EyeIcon } from './Icons';

interface FileUploaderProps {
    files: UploadedFile[];
    setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
    activeFileId: string | null;
    onFileSelect: (id: string | null) => void;
    onExtractAll?: () => void;
    onExtractSelected?: (selectedIds: string[]) => void;
    onIngestToRAG?: (selectedIds: string[]) => void;
    onTranscribeSelected?: (selectedIds: string[]) => void;
    onHtrTranscribeSelected?: (selectedIds: string[]) => void;
    isLoading?: boolean;
    isIngesting?: boolean;
    isTranscribing?: boolean;
    isHtrTranscribing?: boolean;
    onViewFile?: (file: File) => void;
    theme?: any;
    isLightMode?: boolean;
    duplicateFiles?: Set<string>;
}

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const StatusIndicator = ({ status }: { status: UploadedFile['status'] }) => {
    switch (status) {
        case 'completado':
            return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
        case 'error':
            return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
        default:
            return null;
    }
};

export const FileUploader: React.FC<FileUploaderProps> = ({ files, setFiles, activeFileId, onFileSelect, onExtractAll, onExtractSelected, onIngestToRAG, onTranscribeSelected, onHtrTranscribeSelected, isLoading, isIngesting, isTranscribing, isHtrTranscribing, onViewFile, theme, isLightMode, duplicateFiles }) => {
    const cardBg = isLightMode ? '#ffffff' : 'rgba(30, 41, 59, 0.5)';
    const borderColor = isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)';
    const textColor = isLightMode ? '#1e3a8a' : '#f1f5f9';
    const textSecondary = isLightMode ? '#475569' : '#94a3b8';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = (fileList: FileList) => {
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
        const MAX_PAGES_ESTIMATE = 500;

        // Validar archivos
        const validFiles: File[] = [];
        const invalidFiles: string[] = [];

        Array.from(fileList).forEach(file => {
            // Validar tamaño
            if (file.size > MAX_FILE_SIZE) {
                invalidFiles.push(
                    `"${file.name}" (${formatBytes(file.size)}) excede el límite de 100 MB`
                );
                return;
            }

            // Advertencia para archivos grandes (>50 MB o ~250 páginas)
            const estimatedPages = Math.ceil(file.size / 204800); // 200 KB/pág
            if (estimatedPages > MAX_PAGES_ESTIMATE) {
                const confirm = window.confirm(
                    `⚠️ Documento grande detectado: "${file.name}"\n\n` +
                    `Tamaño: ${formatBytes(file.size)}\n` +
                    `Páginas estimadas: ~${estimatedPages}\n\n` +
                    `El procesamiento puede tardar hasta ${Math.ceil(estimatedPages * 2 / 60)} minutos.\n\n` +
                    `¿Deseas continuar?`
                );
                if (!confirm) {
                    return;
                }
            }

            validFiles.push(file);
        });

        // Mostrar errores si hay archivos inválidos
        if (invalidFiles.length > 0) {
            alert(
                `❌ Archivos rechazados (límite: 100 MB):\n\n` +
                invalidFiles.join('\n') +
                `\n\nPor favor:\n` +
                `• Divide el documento en partes más pequeñas\n` +
                `• Comprime el PDF (elimina imágenes innecesarias)\n` +
                `• Contacta con soporte si necesitas procesar documentos más grandes`
            );
        }

        // Agregar solo archivos válidos
        if (validFiles.length > 0) {
            const newFiles = validFiles.map(file => ({
                id: `file-${Date.now()}-${Math.random()}`,
                file,
                status: 'pendiente' as const,
            }));
            setFiles(currentFiles => [...currentFiles, ...newFiles]);
            if (!activeFileId && newFiles.length > 0) {
                onFileSelect(newFiles[0].id);
            }
        }
    };

    const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Función recursiva para leer archivos de carpetas
    const readAllFiles = async (items: DataTransferItemList): Promise<File[]> => {
        const files: File[] = [];

        const readEntry = async (entry: any): Promise<void> => {
            if (entry.isFile) {
                return new Promise((resolve) => {
                    entry.file((file: File) => {
                        files.push(file);
                        resolve();
                    });
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                // readEntries solo devuelve un lote (~100), hay que llamar hasta que devuelva vacío
                const readAllEntries = (): Promise<any[]> => {
                    return new Promise((resolve) => {
                        const allEntries: any[] = [];
                        const readBatch = () => {
                            dirReader.readEntries((entries: any[]) => {
                                if (entries.length === 0) {
                                    resolve(allEntries);
                                } else {
                                    allEntries.push(...entries);
                                    readBatch();
                                }
                            });
                        };
                        readBatch();
                    });
                };
                const entries = await readAllEntries();
                for (const e of entries) {
                    await readEntry(e);
                }
            }
        };

        // IMPORTANTE: capturar todas las entries SÍNCRONAMENTE antes de cualquier await
        // porque DataTransferItemList se invalida después del primer tick asíncrono
        const entries: any[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    entries.push(entry);
                }
            }
        }

        // Ahora procesar las entries capturadas
        for (const entry of entries) {
            await readEntry(entry);
        }

        return files;
    };

    const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        // Intentar leer archivos y carpetas usando webkitGetAsEntry
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            try {
                const files = await readAllFiles(e.dataTransfer.items);
                if (files.length > 0) {
                    const fileList = new DataTransfer();
                    files.forEach(file => fileList.items.add(file));
                    handleFiles(fileList.files);
                    return;
                }
            } catch (error) {
                console.error('Error leyendo carpetas:', error);
            }
        }

        // Fallback: usar files directamente (solo archivos sueltos, no carpetas)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };
    
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
        // Reset para permitir re-seleccionar el mismo archivo
        e.target.value = '';
    };
    
    const onRemoveFile = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedFiles = files.filter(f => f.id !== id);
        setFiles(updatedFiles);
        if (activeFileId === id) {
            onFileSelect(updatedFiles.length > 0 ? updatedFiles[0].id : null);
        }
    };
    
    const onClearAll = () => {
        setFiles([]);
        onFileSelect(null);
        setSelectedFileIds(new Set());
    };

    const toggleFileSelection = (fileId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedFileIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedFileIds.size === files.length) {
            setSelectedFileIds(new Set());
        } else {
            setSelectedFileIds(new Set(files.map(f => f.id)));
        }
    };

    const handleProcessSelected = () => {
        if (onExtractSelected && selectedFileIds.size > 0) {
            onExtractSelected(Array.from(selectedFileIds));
        }
    };

    const handleIngestToRAG = () => {
        if (onIngestToRAG && selectedFileIds.size > 0) {
            onIngestToRAG(Array.from(selectedFileIds));
        }
    };

    const handleTranscribeSelected = () => {
        if (onTranscribeSelected && selectedFileIds.size > 0) {
            onTranscribeSelected(Array.from(selectedFileIds));
        }
    };

    const handleHtrTranscribeSelected = () => {
        if (onHtrTranscribeSelected && selectedFileIds.size > 0) {
            onHtrTranscribeSelected(Array.from(selectedFileIds));
        }
    };

    const anyBusy = isLoading || isIngesting || isTranscribing || isHtrTranscribing;

    return (
        <div
            className="rounded-lg border p-4 md:p-6 flex flex-col h-full transition-colors duration-500"
            style={{
                backgroundColor: cardBg,
                borderColor: borderColor
            }}
        >
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold transition-colors duration-500" style={{ color: textColor }}>
                    Lote de Documentos
                </h2>
            </div>

            <div
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                                style={{
                                    borderColor: isDragging ? accentColor : (isLightMode ? '#93c5fd' : '#475569'),
                                    backgroundColor: isDragging ? (isLightMode ? '#eff6ff' : 'rgba(71, 85, 105, 0.5)') : 'transparent'
                                }}
                                className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={onFileChange}
                                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.txt,.json"
                                />
                                <input
                                    ref={folderInputRef}
                                    type="file"
                                    /* @ts-ignore */
                                    webkitdirectory=""
                                    directory=""
                                    multiple
                                    onChange={onFileChange}
                                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                    className="hidden"
                                />
                                <UploadCloudIcon className="w-10 h-10 mb-2" style={{ color: isLightMode ? '#93c5fd' : '#94a3b8' }} />
                                <p className="text-center mb-3" style={{ color: textColor }}>
                                    Arrastre archivos o carpetas aquí
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-4 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                        style={{ backgroundColor: accentColor, color: '#ffffff' }}
                                    >
                                        📄 Seleccionar Archivos
                                    </button>
                                    <button
                                        onClick={() => folderInputRef.current?.click()}
                                        className="px-4 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
                                        style={{ backgroundColor: isLightMode ? '#059669' : '#10b981', color: '#ffffff' }}
                                    >
                                        📁 Seleccionar Carpeta
                                    </button>
                                </div>
                                <p className="text-xs text-center mt-3" style={{ color: textSecondary }}>PDF, JPG, PNG, TIFF, TXT, JSON (máx. 200MB/lote)</p>
                            </div>
                
                            {files.length > 0 && (
                                <div className="mt-4 flex flex-col flex-grow min-h-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedFileIds.size === files.length && files.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded"
                                                style={{ accentColor: accentColor }}
                                            />
                                            <h3 className="text-sm font-semibold" style={{ color: textColor }}>
                                                {selectedFileIds.size > 0 ? `${selectedFileIds.size} seleccionados de ${files.length}` : `Archivos Cargados (${files.length})`}
                                            </h3>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {selectedFileIds.size > 0 && (
                                                <>
                                                    {onTranscribeSelected && (
                                                        <button
                                                            onClick={handleTranscribeSelected}
                                                            disabled={anyBusy}
                                                            className="text-xs px-3 py-1 text-white rounded-md transition-colors hover:opacity-90"
                                                            style={{
                                                                backgroundColor: anyBusy ? (isLightMode ? '#d1d5db' : '#334155') : '#2563eb'
                                                            }}
                                                            title="Transcripción OCR en lote"
                                                        >
                                                            {isTranscribing ? '⏳ Transcribiendo...' : `📝 Transcribir (${selectedFileIds.size})`}
                                                        </button>
                                                    )}
                                                    {onHtrTranscribeSelected && (
                                                        <button
                                                            onClick={handleHtrTranscribeSelected}
                                                            disabled={anyBusy}
                                                            className="text-xs px-3 py-1 text-white rounded-md transition-colors hover:opacity-90"
                                                            style={{
                                                                backgroundColor: anyBusy ? (isLightMode ? '#d1d5db' : '#334155') : '#9333ea'
                                                            }}
                                                            title="Transcripción de texto manuscrito"
                                                        >
                                                            {isHtrTranscribing ? '⏳ HTR...' : `✍️ HTR (${selectedFileIds.size})`}
                                                        </button>
                                                    )}
                                                    {onExtractSelected && (
                                                        <button
                                                            onClick={handleProcessSelected}
                                                            disabled={anyBusy}
                                                            className="text-xs px-3 py-1 text-white rounded-md transition-colors hover:opacity-90"
                                                            style={{
                                                                backgroundColor: anyBusy ? (isLightMode ? '#d1d5db' : '#334155') : '#10b981'
                                                            }}
                                                            title="Extraer datos con plantilla"
                                                        >
                                                            {isLoading ? '⏳ Extrayendo...' : `📊 Extraer con Plantilla (${selectedFileIds.size})`}
                                                        </button>
                                                    )}
                                                    {onIngestToRAG && (
                                                        <button
                                                            onClick={handleIngestToRAG}
                                                            disabled={anyBusy}
                                                            className="text-xs px-3 py-1 text-white rounded-md transition-colors hover:opacity-90"
                                                            style={{
                                                                backgroundColor: anyBusy ? (isLightMode ? '#d1d5db' : '#334155') : '#8b5cf6'
                                                            }}
                                                            title="Subir documentos a la biblioteca para consultas"
                                                        >
                                                            {isIngesting ? '⏳ Subiendo...' : `📚 Biblioteca RAG (${selectedFileIds.size})`}
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {onExtractAll && (
                                                <button
                                                    onClick={onExtractAll}
                                                    disabled={anyBusy || !files.some(f => f.status === 'pendiente' || f.status === 'error')}
                                                    className="text-xs px-3 py-1 text-white rounded-md transition-colors"
                                                    style={{
                                                        backgroundColor: (anyBusy || !files.some(f => f.status === 'pendiente' || f.status === 'error'))
                                                            ? (isLightMode ? '#d1d5db' : '#334155')
                                                            : accentColor
                                                    }}
                                                >
                                                    {isLoading ? 'Procesando...' : 'Extraer Todos'}
                                                </button>
                                            )}
                                            <button onClick={onClearAll} className="text-xs transition-colors" style={{ color: isLightMode ? '#ef4444' : '#f87171' }}>Limpiar</button>
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto pr-2 flex-grow">
                                        <ul className="space-y-1">
                                            {files.map(f => (
                                                <li key={f.id}>
                                                    <button
                                                        onClick={() => onFileSelect(f.id)}
                                                        className="w-full text-left px-2 py-1 rounded transition-all duration-200 border-l-3"
                                                        style={{
                                                            backgroundColor: activeFileId === f.id
                                                                ? (isLightMode ? '#dbeafe' : 'rgba(8, 145, 178, 0.2)')
                                                                : 'transparent',
                                                            borderLeftColor: activeFileId === f.id ? accentColor : 'transparent'
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedFileIds.has(f.id)}
                                                                onChange={(e) => toggleFileSelection(f.id, e)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-3.5 h-3.5 rounded flex-shrink-0"
                                                                style={{ accentColor: accentColor }}
                                                            />
                                                            <span className="text-xs font-medium truncate flex-grow min-w-0" style={{ color: duplicateFiles?.has(f.file.name) ? '#ef4444' : textColor }}>
                                                                {duplicateFiles?.has(f.file.name) && '⚠️ '}
                                                                {f.file.name}
                                                            </span>
                                                            <span className="text-[10px] flex-shrink-0" style={{ color: textSecondary }}>
                                                                {formatBytes(f.file.size)}
                                                            </span>
                                                            <StatusIndicator status={f.status} />
                                                            {onViewFile && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onViewFile(f.file); }}
                                                                    className="p-0.5 transition-colors rounded-full flex-shrink-0"
                                                                    style={{ color: textSecondary }}
                                                                    title="Ver documento"
                                                                >
                                                                    <EyeIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => onRemoveFile(f.id, e)}
                                                                className="p-0.5 transition-colors rounded-full flex-shrink-0"
                                                                style={{ color: textSecondary }}
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
        </div>
    );
};