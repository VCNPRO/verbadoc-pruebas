
import React, { useState, useMemo, useEffect } from 'react';
// Fix: Use explicit file extension in import.
import { FileUploader } from './components/FileUploader.tsx';
// Fix: Use explicit file extension in import.
import { ExtractionEditor } from './components/ExtractionEditor.tsx';
// Fix: Use explicit file extension in import.
import { HistoryViewer } from './components/HistoryViewer.tsx';
// Fix: Use explicit file extension in import.
import { TemplatesPanel } from './components/TemplatesPanel.tsx';
// Fix: Use explicit file extension in import.
import { PdfViewer } from './components/PdfViewer.tsx';
// Fix: Use explicit file extension in import.
import { HelpModal } from './components/HelpModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import ConfigModal from './src/components/ConfigModal.tsx';
// Fix: Use explicit file extension in import.
import { ResultsViewer } from './components/ResultsViewer.tsx';
import { EnhancedResultsPage } from './components/EnhancedResultsPage.tsx';
import { ChatbotLaia } from './components/ChatbotLaia.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AIAssistantPanel } from './components/AIAssistantPanel.tsx';
// Fix: Use explicit file extension in import.
import type { UploadedFile, ExtractionResult, SchemaField, SchemaFieldType, Departamento } from './types.ts';
import { logActivity } from './src/utils/activityLogger.ts';
import { AVAILABLE_MODELS, type GeminiModel, transcribeDocument, transcribeHandwrittenDocument } from './services/geminiService.ts';
import { BarcodeService } from './services/barcodeService.ts';
import { getDepartamentoById, getDefaultTheme } from './utils/departamentosConfig.ts';
// ✅ Sistema de autenticación real activado
import { AuthProvider, useAuth } from './src/contexts/AuthContext.tsx';
import { AuthModal } from './src/components/AuthModal.tsx';
// ✅ API de extracciones (BD en lugar de localStorage)
import { createExtraction, getExtractions, deleteExtraction, UnprocessableDocumentError, type ApiExtraction } from './src/services/extractionAPI.ts';
// ✅ Componentes de revisión (Fase 5)
import ReviewListPage from './src/components/ReviewListPage.tsx';
import ReviewPanel from './src/components/ReviewPanel.tsx';
// ✅ Componentes de Admin (Fase 2)
import { ExcelManagementPanel } from './src/components/admin/ExcelManagementPanel.tsx';
import { ColumnMappingEditor } from './src/components/admin/ColumnMappingEditor.tsx';
// ✅ Master Excel Page (Excel de salida)
import MasterExcelPage from './src/components/MasterExcelPage.tsx';
// ✅ Unprocessable Page (Documentos no procesables)
import UnprocessablePage from './src/components/UnprocessablePage.tsx';
// ✅ IDP Template Editor
import TemplateEditorPage from './src/pages/TemplateEditorPage.tsx';
// ✅ Servicio de sincronización
import { SyncService } from './src/services/syncService.ts';
// ✅ Plantilla FUNDAE por defecto
import { FUNDAE_SCHEMA, FUNDAE_EXTRACTION_PROMPT } from './src/constants/fundae-template.ts';

import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';

function ProtectedRoute({ children }: { children: JSX.Element }) {
    const { user } = useAuth();
    if (user?.role !== 'admin') {
        return <Navigate to="/" />;
    }
    return children;
}

const renderPdfToImage = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // Usar solo la primera página
    const viewport = page.getViewport({ scale: 2.0 }); // Escala 2.0 para buena resolución
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    // Devolver la imagen como base64, sin el prefijo
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
};

function AppContent() {
    const { user, loading, logout } = useAuth();
    const navigate = useNavigate();

    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [history, setHistory] = useState<ExtractionResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [viewingFile, setViewingFile] = useState<File | null>(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
    const [currentDepartamento, setCurrentDepartamento] = useState<Departamento>('general');
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [showResultsExpanded, setShowResultsExpanded] = useState<boolean>(false);
    const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-2.5-pro');
    const [isDarkMode, setIsDarkMode] = useState<boolean>(true); // Default to dark mode

    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [isHtrTranscribing, setIsHtrTranscribing] = useState<boolean>(false);
    const [isBarcodeReading, setIsBarcodeReading] = useState<boolean>(false);

    // Contadores para botones de navegación
    const [reviewCount, setReviewCount] = useState<number>(0);
    const [masterExcelCount, setMasterExcelCount] = useState<number>(0);
    const [unprocessableCount, setUnprocessableCount] = useState<number>(0);

    // Archivos duplicados detectados
    const [duplicateFiles, setDuplicateFiles] = useState<Set<string>>(new Set());

    // State for the editor, which can be reused across different files
    const [prompt, setPrompt] = useState<string>(FUNDAE_EXTRACTION_PROMPT);
    const [schema, setSchema] = useState<SchemaField[]>(FUNDAE_SCHEMA);

    // Obtener el tema basado en el departamento actual
    const currentTheme = useMemo(() => {
        const departamentoInfo = getDepartamentoById(currentDepartamento);
        return departamentoInfo?.theme || getDefaultTheme();
    }, [currentDepartamento]);

    // Determinar si estamos en modo claro
    const isLightMode = !isDarkMode;

    // Determinar si es usuario reviewer (nmd_*)
    const isReviewer = user?.role === 'reviewer';

    // ✅ Cargar historial desde la base de datos al iniciar (reemplaza localStorage)
    useEffect(() => {
        if (!user) return; // Solo cargar si hay usuario autenticado

        async function loadHistory() {
            try {
                const { extractions } = await getExtractions({ limit: 100 });

                // Convertir extracciones de la API al formato de historial
                const historyEntries: ExtractionResult[] = extractions.map(ex => ({
                    id: ex.id,
                    type: 'extraction' as const,
                    fileId: ex.id, // Usar el mismo ID
                    fileName: ex.filename,
                    schema: [], // No tenemos el schema original, pero no lo necesitamos para visualizar
                    extractedData: ex.extracted_data,
                    timestamp: new Date(ex.created_at).toISOString(),
                }));

                setHistory(historyEntries);
                console.log('✅ Historial cargado desde BD:', historyEntries.length, 'extracciones');
            } catch (error) {
                console.error('Error al cargar historial desde BD:', error);
                // Si falla, mantener el historial vacío
            }
        }

        loadHistory();
    }, [user]); // Cargar cuando cambie el usuario

    // ✅ Iniciar sincronización automática (Backup local) cuando hay usuario
    useEffect(() => {
        if (user) {
            console.log('🔄 Iniciando servicio de sincronización (Polling 5 min)...');
            SyncService.startAutoSync();
        } else {
            SyncService.stopAutoSync();
        }

        return () => {
            SyncService.stopAutoSync();
        };
    }, [user]);

    // ✅ Cargar contadores para los botones de navegación
    useEffect(() => {
        if (!user) return;

        async function loadCounts() {
            try {
                // Cargar contador de revisión (documentos con errores o needs_review)
                const reviewResponse = await fetch('/api/extractions?needsReview=true&limit=1', {
                    credentials: 'include'
                });
                if (reviewResponse.ok) {
                    const reviewData = await reviewResponse.json();
                    setReviewCount(reviewData.count || 0);
                }

                // Cargar contador de Excel Master
                const masterResponse = await fetch('/api/master-excel', {
                    credentials: 'include'
                });
                if (masterResponse.ok) {
                    const masterData = await masterResponse.json();
                    setMasterExcelCount(masterData.stats?.total || masterData.rows?.length || 0);
                }

                // Cargar contador de No Procesables
                const unprocessableResponse = await fetch('/api/unprocessable', {
                    credentials: 'include'
                });
                if (unprocessableResponse.ok) {
                    const unprocessableData = await unprocessableResponse.json();
                    setUnprocessableCount(unprocessableData.total || unprocessableData.documents?.length || 0);
                }
            } catch (error) {
                console.error('Error al cargar contadores:', error);
            }
        }

        loadCounts();
        // Recargar contadores cada 10 segundos
        const interval = setInterval(loadCounts, 10000);
        return () => clearInterval(interval);
    }, [user]);

    const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);

    const handleFileSelect = (id: string | null) => {
        setActiveFileId(id);
    };
    
    const handleExtract = async () => {
        if (!activeFile) return;

        console.log('🚀 Iniciando nuevo flujo de extracción IDP...');
        setIsLoading(true);
        setFiles(currentFiles =>
            currentFiles.map(f => f.id === activeFile.id ? { ...f, status: 'procesando', error: undefined, extractedData: undefined } : f)
        );

        try {
            // 1. Convertir PDF a imagen en el frontend
            console.log('   - Convirtiendo PDF a imagen...');
            const base64Image = await renderPdfToImage(activeFile.file);
            console.log('   ✅ Imagen generada.');

            // 2. Llamar al nuevo backend para procesar la imagen
            console.log('   - Enviando a la API de extracción IDP...');
            const extractResponse = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64Image }),
            });

            if (!extractResponse.ok) {
                const errorData = await extractResponse.json();
                throw new Error(errorData.message || 'La API de extracción falló');
            }

            const result = await extractResponse.json();
            const { extractedData, confidence, status, matchedTemplateId } = result;
            console.log('   ✅ API de extracción completada.');
            console.log(`   - Datos extraídos:`, extractedData);
            console.log(`   - Confianza: ${confidence}, Estado: ${status}`);

            // 3. Guardar el resultado en la base de datos a través de /api/extractions
            console.log('   - Guardando resultado en la base de datos...');
            const finalExtraction = await createExtraction({
                filename: activeFile.file.name,
                extractedData: extractedData,
                modelUsed: `IDP - Template ${matchedTemplateId}`,
                fileType: activeFile.file.type,
                fileSizeBytes: activeFile.file.size,
                confidenceScore: confidence,
                validationStatus: status, // Usar el estado determinado por la API
            });
            console.log('   ✅ Resultado guardado en la BD con ID:', finalExtraction.id);
            
            // 4. Actualizar el estado del frontend
            setFiles(currentFiles =>
                currentFiles.map(f => f.id === activeFile.id ? { ...f, status: 'completado', extractedData: extractedData } : f)
            );
            
            const newHistoryEntry: ExtractionResult = {
                id: finalExtraction.id,
                type: 'extraction',
                fileId: activeFile.id,
                fileName: activeFile.file.name,
                schema: [], // El schema ya no es relevante en este flujo
                extractedData: extractedData,
                timestamp: new Date(finalExtraction.created_at).toISOString(),
            };
            setHistory(currentHistory => [newHistoryEntry, ...currentHistory]);
            setShowResultsExpanded(true);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
            setFiles(currentFiles =>
                currentFiles.map(f => f.id === activeFile.id ? { ...f, status: 'error', error: errorMessage } : f)
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleExtractSelected = async (selectedIds: string[]) => {
        const filesToProcess = files.filter(f => selectedIds.includes(f.id));
        if (filesToProcess.length === 0) return;

        setIsLoading(true);

        // Lazy import the service (only if needed for non-JSON files)
        const nonJsonFiles = filesToProcess.filter(f => !f.file.name.toLowerCase().endsWith('.json'));
        // Cargar servicio híbrido para archivos no-JSON
        let extractWithHybridSystem: any = null;
        if (nonJsonFiles.length > 0) {
            const service = await import('./services/geminiService.ts');
            extractWithHybridSystem = service.extractWithHybridSystem;
        }

        // --- PROCESAMIENTO CON CONCURRENCIA (10 a la vez - Vercel Pro) ---
        const CONCURRENCY = 10;
        const queue = [...filesToProcess];
        const results: any[] = [];

        const processFile = async (file: UploadedFile) => {
            // Verificar si el archivo ya fue procesado antes (duplicado)
            const isDuplicate = history.some(h => h.fileName === file.file.name);
            if (isDuplicate) {
                setDuplicateFiles(prev => new Set(prev).add(file.file.name));
                console.log(`⚠️ DUPLICADO DETECTADO: ${file.file.name} ya fue procesado anteriormente`);
            }

            // Reset status for the current file
            setFiles(currentFiles =>
                currentFiles.map(f => f.id === file.id ? { ...f, status: 'procesando', error: undefined, extractedData: undefined } : f)
            );

            try {
                let extractedData: object;

                // Check if file is JSON
                if (file.file.name.toLowerCase().endsWith('.json')) {
                    const text = await file.file.text();
                    extractedData = JSON.parse(text);
                } else {
                    // Usar sistema híbrido (Coordenadas → IA)
                    const hybridResult = await extractWithHybridSystem(file.file, schema, prompt, selectedModel, { confidenceThreshold: 0.5 });
                    extractedData = hybridResult.data;
                    console.log(`📐 ${file.file.name}: método=${hybridResult.method}, confianza=${hybridResult.confidencePercentage}%`);
                }

                setFiles(currentFiles =>
                    currentFiles.map(f => f.id === file.id ? { ...f, status: 'completado', extractedData: extractedData, error: undefined } : f)
                );

                // Guardar en la base de datos
                try {
                    const apiExtraction = await createExtraction({
                        filename: file.file.name,
                        extractedData: extractedData,
                        modelUsed: selectedModel,
                        fileType: file.file.type,
                        fileSizeBytes: file.file.size,
                        pageCount: 1,
                    });

                    const newHistoryEntry: ExtractionResult = {
                        id: apiExtraction.id,
                        type: 'extraction',
                        fileId: file.id,
                        fileName: file.file.name,
                        schema: JSON.parse(JSON.stringify(schema)),
                        extractedData: extractedData,
                        timestamp: new Date(apiExtraction.created_at).toISOString(),
                    };
                    setHistory(currentHistory => [newHistoryEntry, ...currentHistory]);

                    // 🔥 CORREGIDO: Subir permanentemente a Vercel Blob con mejor manejo
                    console.log(`📤 Subiendo documento ${file.file.name} permanentemente...`);
                    try {
                        const uploadResponse = await fetch(`/api/extractions/upload?extractionId=${apiExtraction.id}&filename=${encodeURIComponent(file.file.name)}&contentType=${encodeURIComponent(file.file.type)}`, {
                            method: 'POST',
                            body: file.file,
                        });
                        if (!uploadResponse.ok) {
                            console.error(`❌ Error subiendo ${file.file.name}:`, await uploadResponse.text());
                        }
                    } catch (e) {
                        console.error('❌ Error en subida permanente (bulk):', e);
                    }
                } catch (dbError) {
                    // 🔥 Manejo especial para documentos no procesables (422)
                    if (dbError instanceof UnprocessableDocumentError && dbError.unprocessableId) {
                        console.log(`📄 Documento no procesable (bulk): ${file.file.name}, subiendo PDF...`);
                        try {
                            const uploadResponse = await fetch(`/api/unprocessable/upload?unprocessableId=${dbError.unprocessableId}&filename=${encodeURIComponent(file.file.name)}&contentType=${encodeURIComponent(file.file.type)}`, {
                                method: 'POST',
                                body: file.file,
                                credentials: 'include',
                            });
                            if (uploadResponse.ok) {
                                console.log(`✅ PDF subido a no procesable: ${file.file.name}`);
                            }
                        } catch (uploadError) {
                            console.error('❌ Error subiendo PDF a no procesable:', uploadError);
                        }
                        setFiles(currentFiles =>
                            currentFiles.map(f => f.id === file.id ? {
                                ...f,
                                status: 'error',
                                error: `No procesable: ${dbError.reason}`,
                                extractedData: extractedData
                            } : f)
                        );
                        return;
                    }
                    console.error('⚠️ Error al guardar en BD (continuando):', dbError);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
                setFiles(currentFiles =>
                    currentFiles.map(f => f.id === file.id ? { ...f, status: 'error', error: errorMessage, extractedData: undefined } : f)
                );
            }
        };

        // Ejecutar con límite de concurrencia
        const workers = Array(Math.min(CONCURRENCY, queue.length)).fill(null).map(async () => {
            while (queue.length > 0) {
                const file = queue.shift();
                if (file) await processFile(file);
            }
        });

        await Promise.all(workers);
        // ----------------------------------------------------

        setIsLoading(false);
        setShowResultsExpanded(true); // Mostrar resultados automáticamente
    };

    const handleExtractAll = async () => {
        const pendingFiles = files.filter(f => f.status === 'pendiente' || f.status === 'error');
        if (pendingFiles.length === 0) return;

        setIsLoading(true);

        // Lazy import the service (only if needed for non-JSON files)
        const nonJsonFiles = pendingFiles.filter(f => !f.file.name.toLowerCase().endsWith('.json'));
        let extractWithHybridSystem: any = null;
        if (nonJsonFiles.length > 0) {
            const service = await import('./services/geminiService.ts');
            extractWithHybridSystem = service.extractWithHybridSystem;
        }

        // --- PROCESAMIENTO CON CONCURRENCIA (10 a la vez - Vercel Pro) ---
        const CONCURRENCY = 10;
        const queue = [...pendingFiles];

        const processFile = async (file: UploadedFile) => {
            // Verificar si el archivo ya fue procesado antes (duplicado)
            const isDuplicate = history.some(h => h.fileName === file.file.name);
            if (isDuplicate) {
                setDuplicateFiles(prev => new Set(prev).add(file.file.name));
                console.log(`⚠️ DUPLICADO DETECTADO: ${file.file.name} ya fue procesado anteriormente`);
            }

            // Reset status for the current file
            setFiles(currentFiles =>
                currentFiles.map(f => f.id === file.id ? { ...f, status: 'procesando', error: undefined, extractedData: undefined } : f)
            );

            try {
                let extractedData: object;

                // Check if file is JSON
                if (file.file.name.toLowerCase().endsWith('.json')) {
                    const text = await file.file.text();
                    extractedData = JSON.parse(text);
                } else {
                    // Usar sistema híbrido (Coordenadas → IA)
                    const hybridResult = await extractWithHybridSystem(file.file, schema, prompt, selectedModel, { confidenceThreshold: 0.5 });
                    extractedData = hybridResult.data;
                    console.log(`📐 ${file.file.name}: método=${hybridResult.method}, confianza=${hybridResult.confidencePercentage}%`);
                }

                setFiles(currentFiles =>
                    currentFiles.map(f => f.id === file.id ? { ...f, status: 'completado', extractedData: extractedData, error: undefined } : f)
                );

                // Guardar en la base de datos
                try {
                    const apiExtraction = await createExtraction({
                        filename: file.file.name,
                        extractedData: extractedData,
                        modelUsed: selectedModel,
                        fileType: file.file.type,
                        fileSizeBytes: file.file.size,
                        pageCount: 1,
                    });

                    const newHistoryEntry: ExtractionResult = {
                        id: apiExtraction.id,
                        type: 'extraction',
                        fileId: file.id,
                        fileName: file.file.name,
                        schema: JSON.parse(JSON.stringify(schema)),
                        extractedData: extractedData,
                        timestamp: new Date(apiExtraction.created_at).toISOString(),
                    };
                    setHistory(currentHistory => [newHistoryEntry, ...currentHistory]);

                    // 🔥 CORREGIDO: Subir permanentemente a Vercel Blob con mejor manejo
                    console.log(`📤 Subiendo documento ${file.file.name} permanentemente...`);
                    try {
                        const uploadResponse = await fetch(`/api/extractions/upload?extractionId=${apiExtraction.id}&filename=${encodeURIComponent(file.file.name)}&contentType=${encodeURIComponent(file.file.type)}`, {
                            method: 'POST',
                            body: file.file,
                        });
                        if (!uploadResponse.ok) {
                            console.error(`❌ Error subiendo ${file.file.name}:`, await uploadResponse.text());
                        }
                    } catch (e) {
                        console.error('❌ Error en subida permanente (bulk):', e);
                    }
                } catch (dbError) {
                    // 🔥 Manejo especial para documentos no procesables (422)
                    if (dbError instanceof UnprocessableDocumentError && dbError.unprocessableId) {
                        console.log(`📄 Documento no procesable (extractAll): ${file.file.name}, subiendo PDF...`);
                        try {
                            const uploadResponse = await fetch(`/api/unprocessable/upload?unprocessableId=${dbError.unprocessableId}&filename=${encodeURIComponent(file.file.name)}&contentType=${encodeURIComponent(file.file.type)}`, {
                                method: 'POST',
                                body: file.file,
                                credentials: 'include',
                            });
                            if (uploadResponse.ok) {
                                console.log(`✅ PDF subido a no procesable: ${file.file.name}`);
                            }
                        } catch (uploadError) {
                            console.error('❌ Error subiendo PDF a no procesable:', uploadError);
                        }
                        setFiles(currentFiles =>
                            currentFiles.map(f => f.id === file.id ? {
                                ...f,
                                status: 'error',
                                error: `No procesable: ${dbError.reason}`,
                                extractedData: extractedData
                            } : f)
                        );
                        return;
                    }
                    console.error('⚠️ Error al guardar en BD:', dbError);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
                setFiles(currentFiles =>
                    currentFiles.map(f => f.id === file.id ? { ...f, status: 'error', error: errorMessage, extractedData: undefined } : f)
                );
            }
        };

        // Ejecutar con límite de concurrencia
        const workers = Array(Math.min(CONCURRENCY, queue.length)).fill(null).map(async () => {
            while (queue.length > 0) {
                const file = queue.shift();
                if (file) await processFile(file);
            }
        });

        await Promise.all(workers);
        // ----------------------------------------------------

        setIsLoading(false);
        setShowResultsExpanded(true); // Mostrar resultados automáticamente
    };

    const handleFullTranscription = async () => {
        if (!activeFile) return;

        setIsTranscribing(true);
        try {
            const text = await transcribeDocument(activeFile.file, selectedModel);
            
            const newHistoryEntry: ExtractionResult = {
                id: `hist-${Date.now()}`,
                type: 'transcription',
                fileId: activeFile.id,
                fileName: activeFile.file.name,
                transcription: text,
                timestamp: new Date().toISOString(),
            };
            setHistory(currentHistory => [newHistoryEntry, ...currentHistory]);

            setFiles(currentFiles =>
                currentFiles.map(f => f.id === activeFile.id ? { ...f, transcription: text } : f)
            );
            
            setShowResultsExpanded(true);
        } catch (error) {
            alert(`Error en la transcripción: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleHtrTranscription = async () => {
        if (!activeFile) return;

        setIsHtrTranscribing(true);
        try {
            const text = await transcribeHandwrittenDocument(activeFile.file, 'gemini-2.5-pro');

            const newHistoryEntry: ExtractionResult = {
                id: `hist-${Date.now()}`,
                type: 'transcription',
                fileId: activeFile.id,
                fileName: activeFile.file.name,
                transcription: text,
                timestamp: new Date().toISOString(),
            };
            setHistory(currentHistory => [newHistoryEntry, ...currentHistory]);

            setFiles(currentFiles =>
                currentFiles.map(f => f.id === activeFile.id ? { ...f, transcription: text } : f)
            );

            setShowResultsExpanded(true);
        } catch (error) {
            alert(`Error en la transcripción HTR: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
            setIsHtrTranscribing(false);
        }
    };

    const handleBarcodeRead = async () => {
        if (!activeFile) return;

        setIsBarcodeReading(true);
        try {
            // Convertir archivo a base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const base64 = reader.result as string;
                    // Remover el prefijo data:image/...;base64,
                    const base64Data = base64.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(activeFile.file);
            const base64Image = await base64Promise;

            // Crear servicio y detectar códigos (usa backend con Service Account)
            const barcodeService = new BarcodeService();
            const result = await barcodeService.detectAndReadCodes(base64Image, activeFile.file.type);

            // Crear entrada en historial
            const newHistoryEntry: ExtractionResult = {
                id: `hist-${Date.now()}`,
                type: 'extraction',
                fileId: activeFile.id,
                fileName: activeFile.file.name,
                extractedData: {
                    codesDetected: result.codesDetected,
                    codes: result.codes,
                    documentType: result.documentType,
                    structuredData: result.structuredData,
                    validationStatus: result.validationStatus,
                    processingTime: result.processingTime
                },
                schema: [
                    { id: 'f1', name: 'codesDetected', type: 'NUMBER' },
                    { id: 'f2', name: 'codes', type: 'ARRAY_OF_OBJECTS' },
                    { id: 'f3', name: 'documentType', type: 'STRING' },
                    { id: 'f4', name: 'structuredData', type: 'OBJECT' },
                    { id: 'f5', name: 'validationStatus', type: 'STRING' }
                ],
                timestamp: new Date().toISOString(),
            };
            setHistory(currentHistory => [newHistoryEntry, ...currentHistory]);

            setFiles(currentFiles =>
                currentFiles.map(f => f.id === activeFile.id ? {
                    ...f,
                    extractedData: newHistoryEntry.extractedData
                } : f)
            );

            setShowResultsExpanded(true);

            if (result.codesDetected === 0) {
                alert('No se detectaron códigos QR ni códigos de barras en el documento.');
            } else {
                alert(`✅ Se detectaron ${result.codesDetected} código(s) en el documento.`);
            }
        } catch (error) {
            alert(`Error en la lectura de códigos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
            setIsBarcodeReading(false);
        }
    };
    
    const handleReplay = (result: ExtractionResult) => {
        if (result.type === 'transcription') {
            alert('No se puede re-ejecutar una transcripción. Vuelve a ejecutar la acción desde el editor.');
            return;
        }
        
        const originalFile = files.find(f => f.id === result.fileId);
        if (originalFile) {
            setActiveFileId(originalFile.id);
            if (result.schema) {
                setSchema(JSON.parse(JSON.stringify(result.schema)));
            }
        } else {
             alert(`El archivo original "${result.fileName}" ya no está en el lote actual. Cargue el archivo de nuevo para reutilizar esta extracción.`);
        }
    };

    const handleSelectTemplate = (template: any) => {
        console.log('📋 Plantilla seleccionada:', template);
        setSelectedTemplate(template);
        const isHealthTemplate = 'secciones' in template;

        if (isHealthTemplate) {
            const newSchema: SchemaField[] = template.secciones.flatMap((seccion: any) =>
                seccion.campos.map((campo: any) => {
                    let type: SchemaFieldType = 'STRING';
                    switch (campo.tipo_dato) {
                        case 'numero':
                            type = 'NUMBER';
                            break;
                        case 'multiseleccion':
                            type = 'ARRAY_OF_STRINGS';
                            break;
                        case 'tabla':
                            type = 'ARRAY_OF_OBJECTS';
                            break;
                        default:
                            type = 'STRING';
                    }
                    return {
                        id: `field-${campo.nombre_campo}-${Date.now()}`,
                        name: campo.etiqueta,
                        type: type,
                    };
                })
            );
            setSchema(newSchema);
            setPrompt('Extrae la información clave del siguiente documento de Europa.');
            console.log('✅ Health template aplicada - Schema:', newSchema.length, 'campos');
        } else {
            // Validar que template.schema existe y es un array
            if (!template.schema || !Array.isArray(template.schema)) {
                console.error('❌ Error: La plantilla no tiene un schema válido', template);
                alert('Error: Esta plantilla no tiene un esquema válido. Por favor, verifica la plantilla.');
                return;
            }

            const newSchema = JSON.parse(JSON.stringify(template.schema));
            const newPrompt = template.prompt || 'Extrae la información clave del siguiente documento según el esquema JSON proporcionado.';

            setSchema(newSchema);
            setPrompt(newPrompt);
            console.log('✅ Plantilla aplicada - Schema:', newSchema.length, 'campos, Prompt:', newPrompt.substring(0, 50) + '...');
        }

        if (template.departamento) {
            setCurrentDepartamento(template.departamento);
        }

        // Mostrar notificación visual
        console.log('🎯 Estado actualizado - Revisa el panel central');
    };

    const handleSaveTemplateChanges = (templateId: string, updatedPrompt: string, updatedSchema: SchemaField[]) => {
        console.log('💾 App.tsx - Guardando cambios en plantilla:', templateId);

        // Buscar la plantilla original
        const originalTemplate = selectedTemplate;
        if (!originalTemplate) {
            console.error('❌ No hay plantilla seleccionada');
            return;
        }

        // Si es una plantilla predefinida (no custom), crear una copia personalizada
        if (!originalTemplate.custom) {
            const newCustomTemplate = {
                id: `custom-${Date.now()}`,
                name: `${originalTemplate.name} (Modificada)`,
                description: originalTemplate.description || 'Copia modificada de plantilla predefinida',
                type: 'modelo',
                icon: originalTemplate.icon || 'file',
                schema: JSON.parse(JSON.stringify(updatedSchema)),
                prompt: updatedPrompt,
                custom: true,
                archived: false
            };

            console.log('📋 Creando copia personalizada:', newCustomTemplate.name);

            // Obtener plantillas personalizadas del localStorage
            const stored = localStorage.getItem('customTemplates_europa');
            const customTemplates = stored ? JSON.parse(stored) : [];

            // Agregar la nueva plantilla
            const updatedTemplates = [...customTemplates, newCustomTemplate];
            localStorage.setItem('customTemplates_europa', JSON.stringify(updatedTemplates));

            console.log('✅ Copia guardada exitosamente como plantilla personalizada');

            // Seleccionar la nueva plantilla
            setSelectedTemplate(newCustomTemplate);
            return;
        }

        // Si es una plantilla personalizada, actualizarla
        const stored = localStorage.getItem('customTemplates_europa');
        if (!stored) {
            console.error('❌ No se encontraron plantillas personalizadas');
            return;
        }

        const customTemplates = JSON.parse(stored);
        const updatedTemplates = customTemplates.map((t: any) => {
            if (t.id === templateId) {
                return {
                    ...t,
                    schema: JSON.parse(JSON.stringify(updatedSchema)),
                    prompt: updatedPrompt
                };
            }
            return t;
        });

        localStorage.setItem('customTemplates_europa', JSON.stringify(updatedTemplates));
        console.log('✅ Plantilla personalizada actualizada exitosamente');

        // Actualizar la plantilla seleccionada en el estado
        const updatedTemplate = updatedTemplates.find((t: any) => t.id === templateId);
        if (updatedTemplate) {
            setSelectedTemplate(updatedTemplate);
        }
    };

    const handleDepartamentoChange = (departamento: Departamento) => {
        setCurrentDepartamento(departamento);
    };

    const handleViewFile = (file: File) => {
        setViewingFile(file);
    };

    const handleCloseViewer = () => {
        setViewingFile(null);
    };

    const handleUpdateHealthTemplate = (sectionId: string, fieldName: string, newLabel: string) => {
        if (!selectedTemplate) return;

        const newTemplate = { ...selectedTemplate };
        const section = newTemplate.secciones.find((s: any) => s.id === sectionId);
        if (section) {
            const field = section.campos.find((f: any) => f.nombre_campo === fieldName);
            if (field) {
                field.etiqueta = newLabel;
            }
        }
        setSelectedTemplate(newTemplate);
    };

    // Borrar un resultado individual del historial
    const handleDeleteResult = async (resultId: string) => {
        if (confirm('¿Estás seguro de que deseas eliminar este resultado?')) {
            try {
                // Eliminar de la base de datos
                await deleteExtraction(resultId);

                // Solo si tuvo éxito, eliminar del estado local
                setHistory(prevHistory => prevHistory.filter(r => r.id !== resultId));
                console.log('✅ Resultado eliminado de BD y frontend:', resultId);
            } catch (error: any) {
                console.error('❌ Error al eliminar resultado:', error);
                alert(`Error al eliminar: ${error.message}`);
            }
        }
    };

    // Limpiar todo el historial
    const handleClearHistory = async () => {
        if (confirm('¿Estás seguro de que deseas eliminar todo el historial? Esta acción no se puede deshacer.')) {
            try {
                console.log(`🗑️ Eliminando ${history.length} registros de la BD...`);

                // Eliminar todos los registros de la BD
                const deletePromises = history.map(item => deleteExtraction(item.id));
                await Promise.all(deletePromises);

                // Solo si todo tuvo éxito, limpiar el estado local
                setHistory([]);
                localStorage.removeItem('verbadoc-history');
                console.log('✅ Historial eliminado completamente de BD y frontend');
            } catch (error: any) {
                console.error('❌ Error al limpiar historial:', error);
                alert(`Error al limpiar historial: ${error.message}`);
            }
        }
    };

    // Exportar historial como JSON
    const handleExportHistory = () => {
        if (history.length === 0) {
            alert('No hay historial para exportar');
            return;
        }

        const dataStr = JSON.stringify(history, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `verbadoc-historial-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        console.log('📥 Historial exportado');
    };

    // Exportar historial como Excel
    const handleExportExcel = async (transposed: boolean = false) => {
        if (history.length === 0) {
            alert('No hay historial para exportar');
            return;
        }

        try {
            const XLSX = await import('xlsx');

            // 1. Recopilar todos los campos únicos de todos los documentos en el historial
            const allFieldPaths = new Set<string>();
            const flattenObject = (obj: any, prefix = ''): any => {
                let result: any = {};
                for (const key in obj) {
                    const value = obj[key];
                    const newKey = prefix ? `${prefix}.${key}` : key;

                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        Object.assign(result, flattenObject(value, newKey));
                    } else if (Array.isArray(value)) {
                        // Manejar arrays correctamente
                        if (value.length === 0) {
                            result[newKey] = '';
                        } else if (typeof value[0] === 'object' && value[0] !== null) {
                            // Array de objetos: expandir el primer elemento inline
                            if (value.length === 1) {
                                // Si solo hay un elemento, expandir sus propiedades
                                Object.assign(result, flattenObject(value[0], newKey));
                            } else {
                                // Si hay múltiples elementos, expandir todos con índices
                                value.forEach((item, idx) => {
                                    Object.assign(result, flattenObject(item, `${newKey}[${idx}]`));
                                });
                            }
                        } else {
                            // Array de primitivos: unir con saltos de línea
                            result[newKey] = value.join('\n');
                        }
                    } else {
                        result[newKey] = value;
                    }
                    allFieldPaths.add(newKey);
                }
                return result;
            };

            const flattenedHistoryData = history.map(entry => ({
                fileName: entry.fileName,
                extractedData: flattenObject(entry.extractedData)
            }));

            const sortedFieldPaths = Array.from(allFieldPaths).sort();

            let excelData: (string | number | null)[][];
            let sheetName: string;
            let fileName: string;

            if (transposed) {
                // FORMATO VERTICAL/TRANSPUESTO: Campos como filas, documentos como columnas
                // 2. Preparar la cabecera: 'Campo' + nombres de los documentos
                const header = ['Campo', ...flattenedHistoryData.map(data => data.fileName)];

                // 3. Preparar las filas de datos
                excelData = [header];

                sortedFieldPaths.forEach(fieldPath => {
                    const row: (string | number | null)[] = [fieldPath];
                    flattenedHistoryData.forEach(data => {
                        const value = data.extractedData[fieldPath];
                        row.push(value !== undefined ? value : 'N/A');
                    });
                    excelData.push(row);
                });

                sheetName = 'Resultados Pivotados';
                fileName = `verbadoc-resultados-pivotados-${new Date().toISOString().split('T')[0]}.xlsx`;
            } else {
                // FORMATO HORIZONTAL: Campos como columnas, documentos como filas
                // 2. Preparar la cabecera: 'Archivo' + nombres de los campos
                const header = ['Archivo', ...sortedFieldPaths];

                // 3. Preparar las filas de datos (cada documento es una fila)
                excelData = [header];

                flattenedHistoryData.forEach(data => {
                    const row: (string | number | null)[] = [data.fileName];
                    sortedFieldPaths.forEach(fieldPath => {
                        const value = data.extractedData[fieldPath];
                        row.push(value !== undefined ? value : 'N/A');
                    });
                    excelData.push(row);
                });

                sheetName = 'Resultados';
                fileName = `verbadoc-resultados-${new Date().toISOString().split('T')[0]}.xlsx`;
            }

            // Crear una nueva hoja de cálculo y añadir los datos
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

            // Auto-size columns (opcional, puede ser costoso para muchas columnas)
            const maxColWidths = excelData[0].map((_, colIdx) =>
                Math.max(...excelData.map(row => (row[colIdx] ? String(row[colIdx]).length : 0)))
            );
            worksheet['!cols'] = maxColWidths.map(w => ({ wch: Math.min(w + 2, 50) })); // +2 para padding, max 50

            // Generar el archivo Excel y descargarlo
            XLSX.writeFile(workbook, fileName);

            console.log(`📊 Historial exportado como Excel ${transposed ? 'pivotado' : 'horizontal'}`);
        } catch (error) {
            console.error('Error exportando a Excel:', error);
            alert('Error al exportar a Excel');
        }
    };

    // Exportar todos los PDFs del historial (un PDF por documento)
    const handleExportAllPDFs = () => {
        if (history.length === 0) {
            alert('No hay historial para exportar');
            return;
        }

        // Importar las funciones necesarias dinámicamente
        import('./utils/exportUtils.ts').then(({downloadPDF}) => {
            history.forEach((entry, index) => {
                // Pequeño delay entre descargas para evitar problemas en el navegador
                if (entry.type === 'extraction' && entry.extractedData) {
                    setTimeout(() => {
                        downloadPDF(
                            entry.extractedData,
                            `${entry.fileName.replace(/\.[^/.]+$/, '')}_extraccion`,
                            entry.schema,
                            true // Siempre formato vertical
                        );
                    }, index * 300); // 300ms de delay entre cada PDF
                }
            });

            console.log(`📄 Exportando PDFs de extracciones...`);
            alert(`Se descargarán los PDFs de las extracciones de datos.`);
        });
    };

    // Importar historial desde JSON
    const handleImportHistory = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target?.result as string);
                    if (Array.isArray(imported)) {
                        if (confirm(`¿Importar ${imported.length} extracciones? Esto se añadirá al historial existente.`)) {
                            setHistory(currentHistory => [...imported, ...currentHistory]);
                            console.log('📤 Historial importado:', imported.length, 'extracciones');
                        }
                    } else {
                        alert('El archivo no contiene un historial válido');
                    }
                } catch (error) {
                    alert('Error al leer el archivo. Asegúrate de que sea un JSON válido.');
                    console.error('Error al importar historial:', error);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // Mostrar loader mientras se verifica la autenticación
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f0f9ff' }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Cargando...</p>
                </div>
            </div>
        );
    }

    // Mostrar modal de autenticación si no hay usuario
    if (!user) {
        return <AuthModal isLightMode={!isDarkMode} />;
    }

    // Página para usuarios Reviewer (nmd_*)
    const ReviewerHomePage = () => (
        <div
            className="min-h-screen font-sans transition-colors duration-500 flex flex-col"
            style={{
                backgroundColor: isDarkMode ? '#0f172a' : '#f0f9ff',
                color: isDarkMode ? '#e2e8f0' : '#0f172a'
            }}
        >
            <header
                className="backdrop-blur-sm border-b-2 sticky top-0 z-10 transition-colors duration-500 shadow-md"
                style={{
                    backgroundColor: isDarkMode ? 'rgba(2, 6, 23, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                    borderBottomColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(59, 130, 246, 0.5)'
                }}
            >
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-baseline gap-3">
                            <h1
                                className="text-2xl font-bold font-orbitron tracking-wider transition-colors duration-500"
                                style={{ color: isLightMode ? '#1e3a8a' : '#f1f5f9' }}
                            >verbadoc pro europa</h1>
                            <span className="text-xs px-2 py-1 rounded bg-amber-500 text-white font-semibold">
                                REVIEWER
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm" style={{ color: isLightMode ? '#475569' : '#94a3b8' }}>
                                {user?.email}
                            </span>
                            <button
                                onClick={logout}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-semibold shadow hover:shadow-md"
                                style={{
                                    backgroundColor: isLightMode ? '#ef4444' : '#dc2626',
                                    borderColor: isLightMode ? '#dc2626' : '#b91c1c',
                                    color: '#ffffff'
                                }}
                            >
                                Salir
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-8">
                <div className="max-w-4xl mx-auto">
                    <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Panel de Revisión
                    </h2>
                    <p className={`mb-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Selecciona una sección para comenzar a trabajar:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Botón Revisar */}
                        <button
                            onClick={() => navigate('/review')}
                            className="p-6 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-xl text-left"
                            style={{
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                borderColor: isDarkMode ? '#f97316' : '#f59e0b'
                            }}
                        >
                            <div className="text-4xl mb-4">📋</div>
                            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Revisar Formularios
                            </h3>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Formularios con errores pendientes de revisión
                            </p>
                            {reviewCount > 0 && (
                                <span className="inline-block mt-3 px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-full">
                                    {reviewCount} pendientes
                                </span>
                            )}
                        </button>

                        {/* Botón Excel Master */}
                        <button
                            onClick={() => navigate('/master-excel')}
                            className="p-6 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-xl text-left"
                            style={{
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                borderColor: isDarkMode ? '#10b981' : '#059669'
                            }}
                        >
                            <div className="text-4xl mb-4">📊</div>
                            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Excel Master
                            </h3>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Ver todos los formularios procesados
                            </p>
                            {masterExcelCount > 0 && (
                                <span className="inline-block mt-3 px-3 py-1 bg-emerald-600 text-white text-sm font-bold rounded-full">
                                    {masterExcelCount} registros
                                </span>
                            )}
                        </button>

                        {/* Botón No Procesables */}
                        <button
                            onClick={() => navigate('/unprocessable')}
                            className="p-6 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-xl text-left"
                            style={{
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                borderColor: isDarkMode ? '#ef4444' : '#dc2626'
                            }}
                        >
                            <div className="text-4xl mb-4">⚠️</div>
                            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                No Procesables
                            </h3>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Documentos que no pudieron procesarse
                            </p>
                            {unprocessableCount > 0 && (
                                <span className="inline-block mt-3 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full">
                                    {unprocessableCount} documentos
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </main>

            <footer
                className="border-t py-4 px-8 text-center text-sm"
                style={{
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    borderTopColor: isDarkMode ? '#334155' : '#dbeafe',
                    color: isDarkMode ? '#64748b' : '#64748b'
                }}
            >
                © 2026 VerbadocPro Europa - Panel de Revisión
            </footer>
        </div>
    );

    // Página Principal
    const HomePage = () => (
        <div
            className="min-h-screen font-sans transition-colors duration-500 flex flex-col"
            style={{
                backgroundColor: isDarkMode ? '#0f172a' : '#f0f9ff', // Light blue for light mode
                color: isDarkMode ? '#e2e8f0' : '#0f172a'
            }}
        >
            <header
                className="backdrop-blur-sm border-b-2 sticky top-0 z-10 transition-colors duration-500 shadow-md"
                style={{
                    backgroundColor: isDarkMode ? 'rgba(2, 6, 23, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                    borderBottomColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(59, 130, 246, 0.5)'
                }}
            >
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-baseline gap-3">
                            <h1
                                className="text-3xl font-bold font-orbitron tracking-wider transition-colors duration-500"
                                style={{
                                    color: isLightMode ? '#1e3a8a' : '#f1f5f9'
                                }}
                            >verbadoc pro europa</h1>
                            <p
                                className="text-sm font-sans transition-colors duration-500"
                                style={{
                                    color: isLightMode ? '#475569' : '#94a3b8'
                                }}
                            >
                                Extracción Inteligente de Datos
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Config Button */}
                            <button
                                onClick={() => setIsConfigModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-all duration-500 font-semibold shadow hover:shadow-md hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#6366f1' : '#4f46e5',
                                    borderColor: isLightMode ? '#4f46e5' : '#6366f1',
                                    color: '#ffffff'
                                }}
                                title="Configuración"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="hidden sm:inline">Config</span>
                            </button>
                            {/* Selector de Modelo IA */}
                            <div className="flex items-center gap-2">
                                <label
                                    htmlFor="model-select"
                                    className="text-xs font-medium hidden sm:inline"
                                    style={{ color: isLightMode ? '#1e3a8a' : '#94a3b8' }}
                                >
                                    Modelo IA:
                                </label>
                                <select
                                    id="model-select"
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                                    className="text-sm px-3 py-1.5 rounded-md border-2 focus:outline-none focus:ring-2 transition-all"
                                    style={{
                                        backgroundColor: isLightMode ? '#f9fafb' : '#1e293b',
                                        borderColor: isLightMode ? '#3b82f6' : '#475569',
                                        color: isLightMode ? '#1e3a8a' : '#f1f5f9'
                                    }}
                                >
                                    {AVAILABLE_MODELS.map(model => (
                                        <option key={model.id} value={model.id}>
                                            {model.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => navigate('/resultados')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-all duration-500 font-semibold shadow hover:shadow-md hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#3b82f6' : '#06b6d4',
                                    borderColor: isLightMode ? '#1d4ed8' : '#0891b2',
                                    color: '#ffffff'
                                }}
                                title="Ver Historial de Resultados"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="hidden sm:inline">Resultados</span>
                            </button>
                            {/* ✅ Botón de Revisión (Fase 5) */}
                            <button
                                onClick={() => navigate('/review')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-all duration-500 font-semibold shadow hover:shadow-md hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#f59e0b' : '#f97316',
                                    borderColor: isLightMode ? '#d97706' : '#ea580c',
                                    color: '#ffffff'
                                }}
                                title="Revisar Formularios con Errores"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="hidden sm:inline">Revisar</span>
                                {reviewCount > 0 && (
                                    <span className="bg-white/25 px-1.5 rounded text-xs font-bold">
                                        {reviewCount}
                                    </span>
                                )}
                            </button>
                            {/* ✅ Botón Excel Master */}
                            <button
                                onClick={() => navigate('/master-excel')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-all duration-500 font-semibold shadow hover:shadow-md hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#10b981' : '#059669',
                                    borderColor: isLightMode ? '#059669' : '#047857',
                                    color: '#ffffff'
                                }}
                                title="Ver Excel Master de Formularios"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="hidden sm:inline">Excel</span>
                                {masterExcelCount > 0 && (
                                    <span className="bg-white/25 px-1.5 rounded text-xs font-bold">
                                        {masterExcelCount}
                                    </span>
                                )}
                            </button>
                            {/* ✅ Botón No Procesables */}
                            <button
                                onClick={() => navigate('/unprocessable')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-all duration-500 font-semibold shadow hover:shadow-md hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#ef4444' : '#dc2626',
                                    borderColor: isLightMode ? '#dc2626' : '#b91c1c',
                                    color: '#ffffff'
                                }}
                                title="Ver documentos no procesables"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="hidden sm:inline">No Proc.</span>
                                {unprocessableCount > 0 && (
                                    <span className="bg-white/25 px-1.5 rounded text-xs font-bold">
                                        {unprocessableCount}
                                    </span>
                                )}
                            </button>
                            {/* ✅ Botón Editor de Plantillas IDP */}
                            <button
                                onClick={() => navigate('/templates')}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-all duration-500 font-semibold shadow hover:shadow-md hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#8b5cf6' : '#7c3aed',
                                    borderColor: isLightMode ? '#7c3aed' : '#a78bfa',
                                    color: '#ffffff'
                                }}
                                title="Editor de Plantillas de Extracción"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
                                <span className="hidden sm:inline">Plantillas</span>
                            </button>
                            <button
                                onClick={() => setIsHelpModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs transition-all duration-500 font-semibold shadow hover:shadow-md hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#2563eb' : '#0891b2',
                                    borderColor: isLightMode ? '#1d4ed8' : '#06b6d4',
                                    color: '#ffffff'
                                }}
                                title="Ayuda y Guía de Usuario"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="hidden sm:inline">Ayuda</span>
                            </button>

                            {/* Logout Button */}
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition-all duration-500 hover:shadow-lg hover:scale-105"
                                style={{
                                    backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                                    borderColor: isLightMode ? '#ef4444' : '#475569',
                                    color: isLightMode ? '#dc2626' : '#f87171'
                                }}
                                title="Cerrar Sesión"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="p-4 sm:p-6 lg:p-8 flex-grow">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                    <div className="lg:col-span-3 h-full">
                        <FileUploader
                            files={files}
                            setFiles={setFiles}
                            activeFileId={activeFileId}
                            onFileSelect={handleFileSelect}
                            onExtractAll={handleExtractAll}
                            onExtractSelected={handleExtractSelected}
                            isLoading={isLoading}
                            onViewFile={handleViewFile}
                            theme={currentTheme}
                            isLightMode={isLightMode}
                            duplicateFiles={duplicateFiles}
                        />
                    </div>
                    <div className="lg:col-span-6 h-full">
                        <ExtractionEditor
                            file={activeFile}
                            template={selectedTemplate}
                            onUpdateTemplate={handleUpdateHealthTemplate}
                            schema={schema}
                            setSchema={setSchema}
                            prompt={prompt}
                            setPrompt={setPrompt}
                            onExtract={handleExtract}
                            isLoading={isLoading || isTranscribing || isHtrTranscribing || isBarcodeReading}
                            onFullTranscription={handleFullTranscription}
                            isTranscribing={isTranscribing}
                            onHtrTranscription={handleHtrTranscription}
                            isHtrTranscribing={isHtrTranscribing}
                            onBarcodeRead={handleBarcodeRead}
                            isBarcodeReading={isBarcodeReading}
                            theme={currentTheme}
                            isLightMode={isLightMode}
                        />
                    </div>
                    <div className="lg:col-span-3 h-full">
                        <div className="h-full flex flex-col overflow-auto">
                            {/* AI Assistant Panel */}
                            <div className="mb-4">
                                <AIAssistantPanel
                                    file={activeFile?.file || null}
                                    onSchemaGenerated={(generatedSchema, generatedPrompt) => {
                                        setSchema(generatedSchema);
                                        setPrompt(generatedPrompt);
                                    }}
                                    onValidationComplete={(validationResult) => {
                                        console.log('Validación completada:', validationResult);
                                    }}
                                    onStartExtraction={(newSchema, newPrompt) => {
                                        // 🔥 Usar schema pasado directamente para evitar race conditions
                                        if (activeFile && !isLoading) {
                                            console.log('🚀 Iniciando extracción automática con schema recibido:', newSchema.length, 'campos');
                                            // Actualizar schema y prompt localmente
                                            setSchema(newSchema);
                                            setPrompt(newPrompt);
                                            // Ejecutar extracción con el schema correcto
                                            setTimeout(() => handleExtract(), 100);
                                        }
                                    }}
                                    extractedData={activeFile?.extractedData}
                                    currentSchema={schema}
                                />
                            </div>

                            {/* Templates Panel */}
                            <div>
                                <TemplatesPanel
                                    onSelectTemplate={handleSelectTemplate}
                                    currentSchema={schema}
                                    currentPrompt={prompt}
                                    onDepartamentoChange={handleDepartamentoChange}
                                    currentDepartamento={currentDepartamento}
                                    theme={currentTheme}
                                    isLightMode={isLightMode}
                                    user={user}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <PdfViewer
                file={viewingFile}
                onClose={handleCloseViewer}
            />

            <HelpModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
            />

            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                isLightMode={isLightMode}
            />

            <ConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                isDarkMode={isDarkMode}
                onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            />

            {/* Footer */}
            <footer
                className="border-t-2 py-6 px-8 mt-auto"
                style={{
                    backgroundColor: isLightMode ? '#ffffff' : '#0f172a',
                    borderTopColor: isLightMode ? '#dbeafe' : '#334155',
                }}
            >
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                        {/* Company Info */}
                        <div>
                            <h4 className="font-bold mb-2" style={{ color: isLightMode ? '#1e3a8a' : '#10b981' }}>
                                verbadoc
                            </h4>
                            <p className="text-sm" style={{ color: isLightMode ? '#475569' : '#94a3b8' }}>
                                Extracción inteligente de datos con IA procesada en Europa
                            </p>
                        </div>

                        {/* Legal Links */}
                        <div>
                            <h4 className="font-bold mb-2" style={{ color: isLightMode ? '#1e3a8a' : '#10b981' }}>
                                Legal
                            </h4>
                            <div className="space-y-1">
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); setIsSettingsModalOpen(true); }}
                                    className="block text-sm hover:underline transition-colors"
                                    style={{ color: isLightMode ? '#475569' : '#94a3b8' }}
                                >
                                    Política de Privacidad
                                </a>
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); setIsSettingsModalOpen(true); }}
                                    className="block text-sm hover:underline transition-colors"
                                    style={{ color: isLightMode ? '#475569' : '#94a3b8' }}
                                >
                                    Términos y Condiciones
                                </a>
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); setIsSettingsModalOpen(true); }}
                                    className="block text-sm hover:underline transition-colors"
                                    style={{ color: isLightMode ? '#475569' : '#94a3b8' }}
                                >
                                    Cumplimiento RGPD
                                </a>
                            </div>
                        </div>

                        {/* Contact */}
                        <div>
                            <h4 className="font-bold mb-2" style={{ color: isLightMode ? '#1e3a8a' : '#10b981' }}>
                                Contacto
                            </h4>
                            <div className="space-y-1">
                                <a
                                    href="mailto:legal@verbadoc.com"
                                    className="block text-sm hover:underline transition-colors"
                                    style={{ color: isLightMode ? '#475569' : '#94a3b8' }}
                                >
                                    legal@verbadoc.com
                                </a>
                                <a
                                    href="mailto:soporte@verbadoc.com"
                                    className="block text-sm hover:underline transition-colors"
                                    style={{ color: isLightMode ? '#475569' : '#94a3b8' }}
                                >
                                    soporte@verbadoc.com
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="border-t pt-4" style={{ borderTopColor: isLightMode ? '#e5e7eb' : '#334155' }}>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-2">
                            <p className="text-xs" style={{ color: isLightMode ? '#64748b' : '#64748b' }}>
                                © 2025 verbadoc. Todos los derechos reservados. • Procesamiento 100% en Europa 🇪🇺
                            </p>
                            <p className="text-xs" style={{ color: isLightMode ? '#64748b' : '#64748b' }}>
                                v2.0 • Powered by Google Gemini AI (Bélgica)
                            </p>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Chatbot Laia */}
            <ChatbotLaia isLightMode={isLightMode} />
        </div>
    );

    // Retornar rutas
    // Si es reviewer, mostrar rutas restringidas
    if (isReviewer) {
        return (
            <Routes>
                <Route path="/" element={<ReviewerHomePage />} />
                <Route path="/review" element={<ReviewListPage />} />
                <Route path="/review/:id" element={<ReviewPanel />} />
                <Route path="/master-excel" element={<MasterExcelPage />} />
                <Route path="/unprocessable" element={<UnprocessablePage />} />
                {/* Cualquier otra ruta redirige al inicio */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
                path="/resultados"
                element={
                    <EnhancedResultsPage
                        results={history}
                        theme={currentTheme}
                        isLightMode={isLightMode}
                        isDarkMode={isDarkMode}
                        onDeleteResult={handleDeleteResult}
                        onClearHistory={handleClearHistory}
                        onExportHistory={handleExportHistory}
                        onExportExcel={handleExportExcel}
                        onExportAllPDFs={handleExportAllPDFs}
                        onImportHistory={handleImportHistory}
                        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
                    />
                }
            />
            {/* ✅ Fase 5: Sistema de Revisión */}
            <Route path="/review" element={<ReviewListPage />} />
            <Route path="/review/:id" element={<ReviewPanel />} />
            {/* ✅ Fase 2: Admin - Gestión de Excel y Mapeo */}
            <Route
                path="/admin/excel-management"
                element={
                    <ProtectedRoute>
                        <ExcelManagementPanel />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/column-mapping"
                element={
                    <ProtectedRoute>
                        <ColumnMappingEditor />
                    </ProtectedRoute>
                }
            />
            {/* ✅ Master Excel - Ver todos los formularios procesados */}
            <Route path="/master-excel" element={<MasterExcelPage />} />
            {/* ✅ Unprocessable - Ver documentos no procesables */}
            <Route path="/unprocessable" element={<UnprocessablePage />} />
            {/* ✅ IDP Template Editor */}
            <Route path="/templates" element={<TemplateEditorPage />} />
            {/* Admin Dashboard */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute>
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
// Limpieza automática de localStorage (ejecutar al cargar el módulo)
const CLEANUP_VERSION_KEY = 'verbadoc_cleanup_version';
const CURRENT_CLEANUP_VERSION = '2';
const lastCleanupVersion = localStorage.getItem(CLEANUP_VERSION_KEY);
if (lastCleanupVersion !== CURRENT_CLEANUP_VERSION) {
    console.log('🧹 Limpiando datos antiguos de localStorage...');
    localStorage.removeItem('currentUserId');
    localStorage.setItem(CLEANUP_VERSION_KEY, CURRENT_CLEANUP_VERSION);
    console.log('✅ Limpieza completada. Recargando...');
    window.location.reload();
}

}

function App() {
    // Force rebuild - timestamp: 2026-01-10T14:30:00Z
    return (
        <AppContent />
    );
}

export default App;
