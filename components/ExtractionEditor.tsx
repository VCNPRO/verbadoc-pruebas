
import React, { useEffect, useState, useMemo } from 'react';
// Fix: Use explicit file extension in import.
import type { UploadedFile, SchemaField } from '../types.ts';
// Fix: Use explicit file extension in import.
import { SchemaBuilder } from './SchemaBuilder.tsx';
import { ImageSearchPanel } from './ImageSearchPanel.tsx';
import { CubeIcon, ExclamationTriangleIcon, SparklesIcon } from './Icons.tsx';
// Las funciones de exportación están ahora en ResultsViewer
import { AVAILABLE_MODELS, type GeminiModel, searchImageInDocument, generateSchemaFromPrompt } from '../services/geminiService.ts';
import { HealthSchemaViewer } from './HealthSchemaViewer.tsx';

interface ExtractionEditorProps {
    file: UploadedFile | undefined;
    template: any;
    onUpdateTemplate: (sectionId: string, fieldName: string, newLabel: string) => void;
    onSaveTemplateChanges?: (templateId: string, updatedPrompt: string, updatedSchema: SchemaField[]) => void;
    schema: SchemaField[];
    setSchema: React.Dispatch<React.SetStateAction<SchemaField[]>>;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    onExtract: (modelId?: GeminiModel) => void;
    isLoading?: boolean;
    onFullTranscription?: () => void;
    isTranscribing?: boolean;
    onHtrTranscription?: () => void;
    isHtrTranscribing?: boolean;
    onBarcodeRead?: () => void;
    isBarcodeReading?: boolean;
    isGeneratingMetadata?: boolean;
    theme?: any;
    isLightMode?: boolean;
}

// Example prompt
const EXAMPLE_PROMPT = `
Extraer la siguiente información del documento:
- Nombre completo del cliente
- Fecha de la factura
- Lista de artículos comprados, incluyendo nombre del artículo y precio
- Total de la factura
`;

// Example schema corresponding to the prompt
const EXAMPLE_SCHEMA: SchemaField[] = [
    { id: 'f1', name: 'nombre_cliente', type: 'STRING' },
    { id: 'f2', name: 'fecha_factura', type: 'STRING' },
    { id: 'f3', name: 'articulos', type: 'ARRAY_OF_OBJECTS', children: [
        { id: 'f3_1', name: 'descripcion', type: 'STRING' },
        { id: 'f3_2', name: 'precio', type: 'NUMBER' },
    ]},
    { id: 'f4', name: 'total', type: 'NUMBER' },
];


export const ExtractionEditor: React.FC<ExtractionEditorProps> = ({ file, template, onUpdateTemplate, onSaveTemplateChanges, schema, setSchema, prompt, setPrompt, onExtract, isLoading, onFullTranscription, isTranscribing, onHtrTranscription, isHtrTranscribing, onBarcodeRead, isBarcodeReading, isGeneratingMetadata, theme, isLightMode }) => {
    const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-3-pro-preview');
    const [isSearchingImage, setIsSearchingImage] = useState(false);
    const [imageSearchResult, setImageSearchResult] = useState<any>(null);
    const [showImageSearch, setShowImageSearch] = useState(false);
    const [showPrompt, setShowPrompt] = useState(true);
    const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
    
    // Estado local para el prompt para evitar re-renderizados lentos del padre
    const [localPrompt, setLocalPrompt] = useState(prompt);

    // Sincronizar estado local cuando el prop externo cambia (ej: al seleccionar plantilla)
    useEffect(() => {
        setLocalPrompt(prompt);
    }, [prompt]);

    // Manejar cambio localmente
    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalPrompt(e.target.value);
        // Opcional: Actualizar padre en tiempo real si es necesario, o dejarlo para onBlur
        setPrompt(e.target.value);
    };

    const cardBg = isLightMode ? '#ffffff' : 'rgba(30, 41, 59, 0.5)';
    const borderColor = isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)';
    const textColor = isLightMode ? '#1e3a8a' : '#f1f5f9';
    const textSecondary = isLightMode ? '#475569' : '#94a3b8';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';

    // Detectar cambios en la plantilla
    const hasTemplateChanges = useMemo(() => {
        if (!template) return false;
        if ('secciones' in template) return false; // No permitir guardar plantillas de salud

        // Comparar prompt (con valor por defecto si no existe)
        const templatePrompt = template.prompt || '';
        const promptChanged = prompt !== templatePrompt;

        // Comparar schema (con valor por defecto si no existe)
        const templateSchema = template.schema || [];
        const schemaChanged = JSON.stringify(schema) !== JSON.stringify(templateSchema);

        return promptChanged || schemaChanged;
    }, [template, prompt, schema]);

    // Siempre mostrar botón guardar cuando hay plantilla seleccionada (no de salud)
    const canSaveTemplate = useMemo(() => {
        if (!template) return false;
        if ('secciones' in template) return false;
        return true;
    }, [template]);

    // DEBUG: Log cuando cambian los props importantes (deshabilitado para evitar lag)
    // useEffect(() => {
    //     console.log('🔄 ExtractionEditor - Props recibidos:', {
    //         prompt: prompt?.substring(0, 50) + '...',
    //         schemaLength: schema?.length,
    //         schemaFields: schema?.map(f => f.name).join(', '),
    //         file: file?.file?.name || 'sin archivo',
    //         hasChanges: hasTemplateChanges
    //     });
    // }, [prompt, schema, file, hasTemplateChanges]);

    const handleImageSearch = async (referenceImage: File, modelId: GeminiModel) => {
        if (!file) return;

        setIsSearchingImage(true);
        setImageSearchResult(null);

        try {
            const result = await searchImageInDocument(file.file, referenceImage, modelId);
            setImageSearchResult(result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            setImageSearchResult({
                found: false,
                description: `Error: ${errorMessage}`
            });
        } finally {
            setIsSearchingImage(false);
        }
    };

    const useExample = () => {
        setPrompt(EXAMPLE_PROMPT.trim());
        // Deep copy example schema with new IDs to avoid state mutation issues
        const newSchema = JSON.parse(JSON.stringify(EXAMPLE_SCHEMA)).map((field: SchemaField, i: number) => ({
             ...field,
             id: `field-${Date.now()}-${i}`,
             children: field.children?.map((child: SchemaField, j: number) => ({
                 ...child,
                 id: `field-${Date.now()}-${i}-${j}`
             }))
        }));
        setSchema(newSchema);
    };

    const handleGenerateSchema = async () => {
        if (!prompt.trim()) {
            alert('Por favor, escribe primero un prompt describiendo qué datos quieres extraer.');
            return;
        }

        setIsGeneratingSchema(true);
        try {
            const generatedFields = await generateSchemaFromPrompt(prompt, selectedModel);
            setSchema(generatedFields);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            alert(`Error al generar campos: ${errorMessage}`);
        } finally {
            setIsGeneratingSchema(false);
        }
    };

    const handleSaveChanges = () => {
        if (!template || !onSaveTemplateChanges) return;

        // Si es una plantilla predefinida (no custom), preguntar si quiere guardar como copia
        if (!template.custom) {
            const saveCopy = confirm(
                `"${template.name}" es una plantilla predefinida y no se puede modificar directamente.\n\n` +
                `¿Deseas guardar una copia personalizada con tus cambios?`
            );
            if (!saveCopy) return;
        }

        console.log('💾 Guardando cambios en plantilla:', template.id, template.name);
        onSaveTemplateChanges(template.id, prompt, schema);
        alert(`✅ Cambios guardados en la plantilla "${template.name}"`);
    };

    // Si no hay archivo, pero hay plantilla seleccionada, mostrar la plantilla
    const showTemplatePreview = !file && template;

    if (!file && !template) {
        return (
            <div
                className="flex flex-col items-center justify-center h-full rounded-lg border p-6 text-center transition-colors duration-500"
                style={{
                    backgroundColor: cardBg,
                    borderColor: borderColor
                }}
            >
                <CubeIcon className="w-16 h-16 mb-4" style={{ color: textSecondary }} />
                <h3 className="text-xl font-semibold" style={{ color: textColor }}>Seleccione una plantilla o archivo</h3>
                <p className="max-w-sm mx-auto mt-1" style={{ color: textSecondary }}>
                    Elija una plantilla del panel derecho para ver su estructura, o suba un documento del panel izquierdo para comenzar la extracción.
                </p>
            </div>
        );
    }

    const hasSchemaErrors = schema.some(field => field.error || (field.children && field.children.some(child => child.error)));

    return (
        <div
            className="flex flex-col h-full rounded-lg border transition-colors duration-500"
            style={{
                backgroundColor: cardBg,
                borderColor: borderColor
            }}
        >
            <div className="p-4 md:p-6 border-b transition-colors duration-500" style={{ borderBottomColor: borderColor }}>
                <h2 className="text-lg font-semibold mb-1" style={{ color: textColor }}>
                    {showTemplatePreview ? (
                        <>Vista Previa de Plantilla: <span className="font-normal" style={{ color: accentColor }}>{template?.name || 'Sin nombre'}</span></>
                    ) : (
                        <>Editor de Extracción: <span className="font-normal" style={{ color: accentColor }}>{file?.file?.name || 'Sin nombre'}</span></>
                    )}
                </h2>
                <p className="text-sm" style={{ color: textSecondary }}>
                    {showTemplatePreview
                        ? 'Revise la estructura de esta plantilla. Suba un documento para usarla en la extracción.'
                        : 'Defina la estructura de datos que desea extraer del documento.'}
                </p>
            </div>

            <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-6">
                {/* Prompt colapsable */}
                <div>
                    <button
                        onClick={() => setShowPrompt(!showPrompt)}
                        className="flex items-center justify-between w-full text-left mb-2"
                    >
                        <div className="flex items-center gap-2">
                            <label className="text-base font-medium flex items-center gap-2 cursor-pointer" style={{ color: textColor }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                1. Prompt (Instrucción)
                            </label>
                            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{
                                backgroundColor: isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)',
                                color: isLightMode ? '#1e3a8a' : '#22d3ee'
                            }}>
                                Editable ✏️
                            </span>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 transition-transform ${showPrompt ? 'rotate-180' : ''}`}
                            style={{ color: textSecondary }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showPrompt && (
                        <>
                            <textarea
                                id="prompt"
                                value={localPrompt}
                                onChange={handlePromptChange}
                                rows={4}
                                className="w-full rounded-md p-3 focus:ring-2 focus:outline-none transition-all text-sm"
                                style={{
                                    backgroundColor: isLightMode ? '#f9fafb' : '#0f172a',
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    borderColor: isLightMode ? '#d1d5db' : '#475569',
                                    color: textColor
                                }}
                                placeholder="Ej: Extrae del informe médico: nombre del paciente, fecha de consulta, diagnóstico principal y tratamiento prescrito."
                            />
                        </>
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-medium" style={{ color: textColor }}>2. Definición del Esquema JSON</h3>
                        {!(template && 'secciones' in template) && (
                            <button
                                onClick={handleGenerateSchema}
                                disabled={isGeneratingSchema || !prompt.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                                style={{
                                    backgroundColor: isLightMode ? '#2563eb' : '#06b6d4',
                                    color: '#ffffff'
                                }}
                            >
                                {isGeneratingSchema ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-3.5 h-3.5" />
                                        Generar Campos desde Prompt
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    {template && 'secciones' in template ? (
                        <HealthSchemaViewer template={template} onUpdate={onUpdateTemplate} theme={theme} isLightMode={isLightMode} />
                    ) : (
                        <SchemaBuilder schema={schema} setSchema={setSchema} theme={theme} isLightMode={isLightMode} />
                    )}
                </div>

                {/* Búsqueda de imágenes - sección colapsable */}
                <div className="border-t pt-4 transition-colors duration-500" style={{ borderTopColor: borderColor }}>
                    <button
                        onClick={() => setShowImageSearch(!showImageSearch)}
                        className="flex items-center justify-between w-full text-left"
                    >
                        <h3 className="text-base font-medium flex items-center gap-2" style={{ color: textColor }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            3. Búsqueda de Imágenes/Logos (Opcional)
                        </h3>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 transition-transform ${showImageSearch ? 'rotate-180' : ''}`}
                            style={{ color: textSecondary }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showImageSearch && (
                        <>
                            <ImageSearchPanel
                                file={file}
                                onSearch={handleImageSearch}
                                isSearching={isSearchingImage}
                            />

                            {/* Mostrar resultado de búsqueda */}
                            {imageSearchResult && (
                                <div className={`mt-4 p-4 rounded-lg border ${imageSearchResult.found ? 'bg-green-900/20 border-green-700/50' : ''}`}
                                    style={{
                                        backgroundColor: imageSearchResult.found ? undefined : (isLightMode ? '#f3f4f6' : 'rgba(30, 41, 59, 0.5)'),
                                        borderColor: imageSearchResult.found ? undefined : borderColor
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        {imageSearchResult.found ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" style={{ color: textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                        <div className="flex-1">
                                            <h4 className="text-sm font-semibold mb-1" style={{ color: imageSearchResult.found ? '#22c55e' : textColor }}>
                                                {imageSearchResult.found ? '✓ Imagen encontrada' : 'Imagen no encontrada'}
                                            </h4>
                                            <p className="text-sm mb-2" style={{ color: textColor }}>{imageSearchResult.description}</p>
                                            {imageSearchResult.location && (
                                                <p className="text-xs" style={{ color: textSecondary }}>
                                                    <span className="font-medium">Ubicación:</span> {imageSearchResult.location}
                                                </p>
                                            )}
                                            {imageSearchResult.confidence && (
                                                <p className="text-xs" style={{ color: textSecondary }}>
                                                    <span className="font-medium">Confianza:</span> {imageSearchResult.confidence}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="p-4 md:p-6 border-t transition-colors duration-500" style={{ borderTopColor: borderColor, backgroundColor: isLightMode ? '#f9fafb' : 'rgba(30, 41, 59, 0.8)' }}>
                {/* Botón Guardar Cambios - Visible cuando hay plantilla seleccionada */}
                {canSaveTemplate && onSaveTemplateChanges && (
                    <button
                        onClick={handleSaveChanges}
                        disabled={hasSchemaErrors || schema.length === 0}
                        className="w-full flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-md transition-all mb-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{
                            backgroundColor: hasTemplateChanges
                                ? (isLightMode ? '#f59e0b' : '#f59e0b')
                                : (isLightMode ? '#6b7280' : '#4b5563'),
                            color: '#ffffff'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        {hasTemplateChanges ? 'Guardar Cambios en Plantilla' : 'Guardar como Nueva Plantilla'}
                    </button>
                )}

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                        onClick={onFullTranscription}
                        disabled={isLoading || !file}
                        className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{
                            backgroundColor: isLightMode ? '#1d4ed8' : '#1e40af'
                        }}
                    >
                        {isTranscribing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Transcribiendo...
                            </>
                        ) : isGeneratingMetadata && !isTranscribing && !isHtrTranscribing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Generando metadatos...
                            </>
                        ) : (
                            `Transcripción Completa`
                        )}
                    </button>
                    <button
                        onClick={onHtrTranscription}
                        disabled={isLoading || !file}
                        className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{
                            backgroundColor: isLightMode ? '#9333ea' : '#7e22ce'
                        }}
                    >
                        {isHtrTranscribing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Transcribiendo HTR...
                            </>
                        ) : isGeneratingMetadata && !isTranscribing && !isHtrTranscribing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Generando metadatos...
                            </>
                        ) : (
                            `Transcribir Manuscrito (HTR)`
                        )}
                    </button>
                </div>

                {/* Botón de Lectura de Códigos QR/Barras */}
                {onBarcodeRead && (
                    <button
                        onClick={onBarcodeRead}
                        disabled={isLoading || !file}
                        className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 mb-3"
                        style={{
                            backgroundColor: isLightMode ? '#059669' : '#10b981'
                        }}
                    >
                        {isBarcodeReading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Leyendo Códigos...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                Leer Códigos QR/Barras
                            </>
                        )}
                    </button>
                )}

                <button
                    onClick={() => onExtract(selectedModel)}
                    disabled={isLoading || !file || hasSchemaErrors || schema.length === 0}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{
                        backgroundColor: accentColor
                    }}
                >
                    {isLoading && !isTranscribing && !isHtrTranscribing && !isGeneratingMetadata ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Extrayendo Datos con {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}...
                        </>
                    ) : (
                        `Ejecutar Extracción con Plantilla`
                    )}
                </button>
                {hasSchemaErrors && (
                    <p className="text-xs text-red-400 mt-2 text-center flex items-center justify-center gap-1">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        Corrija los errores en los nombres de los campos del esquema para continuar.
                    </p>
                )}
            </div>

            {/* Visor PDF y botones de exportación movidos a la pestaña "Resultados de Extracción" */}
             {file?.error && (
                <div className="border-t p-4 md:p-6 transition-colors duration-500" style={{ borderTopColor: borderColor }}>
                    <h3 className="text-base font-medium text-red-400 mb-2">Error de Extracción</h3>
                    <p className="text-sm bg-red-900/30 p-3 rounded-md text-red-300">{file.error}</p>
                </div>
            )}
        </div>
    );
};
