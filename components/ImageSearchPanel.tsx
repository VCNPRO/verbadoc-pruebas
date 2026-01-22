import React, { useState } from 'react';
import type { UploadedFile } from '../types.ts';
import { AVAILABLE_MODELS, type GeminiModel } from '../services/geminiService.ts';

interface ImageSearchPanelProps {
    file: UploadedFile | undefined;
    onSearch: (referenceImage: File, modelId: GeminiModel) => Promise<void>;
    isSearching: boolean;
}

interface SearchResult {
    found: boolean;
    description: string;
    location?: string;
    confidence?: string;
}

export const ImageSearchPanel: React.FC<ImageSearchPanelProps> = ({ file, onSearch, isSearching }) => {
    const [referenceImage, setReferenceImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-2.5-flash');
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setReferenceImage(file);
            // Create preview URL
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setSearchResult(null);
        }
    };

    const handleSearch = async () => {
        if (!referenceImage || !file) return;

        try {
            const result = await onSearch(referenceImage, selectedModel);
            // The result will be set by the parent component
        } catch (error) {
            console.error('Error en búsqueda de imagen:', error);
        }
    };

    const handleRemoveImage = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setReferenceImage(null);
        setPreviewUrl(null);
        setSearchResult(null);
    };

    if (!file) {
        return null;
    }

    return (
        <div className="mt-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <h3 className="text-base font-medium text-slate-200 mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Búsqueda de Imagen/Logo
            </h3>
            <p className="text-xs text-slate-400 mb-4">
                Carga una imagen de referencia para buscar logos o imágenes similares en el documento
            </p>

            {!referenceImage ? (
                <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-purple-500 hover:bg-slate-800/50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-slate-400 text-sm">
                            <span className="text-purple-400 font-medium">Haz clic para cargar</span> una imagen de referencia
                        </p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF hasta 10MB</p>
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                    />
                </label>
            ) : (
                <div className="space-y-3">
                    {/* Preview de la imagen */}
                    <div className="relative">
                        <img
                            src={previewUrl || ''}
                            alt="Imagen de referencia"
                            className="w-full h-48 object-contain bg-slate-900 rounded-lg border border-slate-600"
                        />
                        <button
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors"
                            title="Eliminar imagen"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <p className="text-sm text-slate-300">
                        <span className="font-medium">Archivo:</span> {referenceImage.name}
                    </p>

                    {/* Selector de modelo */}
                    <div>
                        <label htmlFor="search-model-select" className="block text-sm font-medium text-slate-300 mb-1">
                            Modelo de IA
                        </label>
                        <select
                            id="search-model-select"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-sm text-slate-300"
                        >
                            {AVAILABLE_MODELS.map(model => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Botón de búsqueda */}
                    <button
                        onClick={handleSearch}
                        disabled={isSearching || !file}
                        className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSearching ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Buscando...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Buscar en Documento
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
