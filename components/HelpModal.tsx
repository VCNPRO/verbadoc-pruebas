import React, { useState } from 'react';
import { XIcon, InformationCircleIcon } from './Icons';
import { generateQuickGuidePDF } from '../services/pdfGuideService.ts';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <InformationCircleIcon className="w-8 h-8 text-cyan-400" />
                        <div>
                            <h2 className="text-2xl font-bold text-slate-100">
                                Guía de Usuario
                            </h2>
                            <p className="text-sm text-slate-400">Aprende a usar verbadoc pro europa</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Cerrar"
                    >
                        <XIcon className="w-6 h-6 text-slate-300" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    {/* ASISTENTE IA - NUEVO */}
                    <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg p-6 border-2 border-purple-600/50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-2xl">🤖</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-purple-300">🆕 Asistente IA - Tu Mejor Amigo</h3>
                                <p className="text-sm text-purple-200/80">Usa SIEMPRE el Asistente IA primero</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">🏷️</span>
                                    <h4 className="font-semibold text-purple-300">Clasificación Automática</h4>
                                </div>
                                <p className="text-xs text-slate-300">
                                    Detecta el tipo de documento y sugiere el esquema perfecto automáticamente
                                </p>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">✅</span>
                                    <h4 className="font-semibold text-purple-300">Validación Inteligente</h4>
                                </div>
                                <p className="text-xs text-slate-300">
                                    Revisa los datos extraídos y te indica errores e inconsistencias
                                </p>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">📑</span>
                                    <h4 className="font-semibold text-purple-300">Segmentación de PDFs</h4>
                                </div>
                                <p className="text-xs text-slate-300">
                                    Detecta múltiples documentos dentro de un PDF y los separa automáticamente
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* INICIO RÁPIDO - 5 MINUTOS */}
                    <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-lg p-6 border-2 border-cyan-600/50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-cyan-600 rounded-full flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-cyan-300">⚡ Inicio Rápido (5 minutos)</h3>
                                <p className="text-sm text-cyan-200/80">Empieza a extraer datos ahora mismo</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-cyan-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">📤</span>
                                    <h4 className="font-semibold text-cyan-300">1. Sube Documento</h4>
                                </div>
                                <p className="text-xs text-slate-300">Arrastra tu PDF, JPG, PNG o TIFF a la columna izquierda</p>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-lg border border-cyan-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">🤖</span>
                                    <h4 className="font-semibold text-cyan-300">2. Usa Asistente IA</h4>
                                </div>
                                <p className="text-xs text-slate-300">Click en "Clasificar Documento" → El esquema se llena automáticamente</p>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-lg border border-cyan-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">🚀</span>
                                    <h4 className="font-semibold text-cyan-300">3. Ejecuta Extracción</h4>
                                </div>
                                <p className="text-xs text-slate-300">Botón azul grande: "Ejecutar Extracción" (espera 5-30 seg)</p>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-lg border border-cyan-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">💾</span>
                                    <h4 className="font-semibold text-cyan-300">4. Exporta Resultados</h4>
                                </div>
                                <p className="text-xs text-slate-300">Excel (recomendado), CSV o JSON</p>
                            </div>
                        </div>
                    </div>

                    {/* 3 COLUMNAS PRINCIPALES */}
                    <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
                        <h3 className="text-lg font-semibold text-slate-200 mb-4">🎯 Las 3 Columnas de la Interfaz</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div className="bg-slate-800/50 p-3 rounded border border-blue-700/30">
                                <h4 className="font-semibold text-blue-400 mb-2">📄 Documentos</h4>
                                <ul className="text-xs text-slate-300 space-y-1">
                                    <li>• Sube archivos</li>
                                    <li>• Vista previa</li>
                                    <li>• Eliminar</li>
                                </ul>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded border border-cyan-700/30">
                                <h4 className="font-semibold text-cyan-400 mb-2">✏️ Editor</h4>
                                <ul className="text-xs text-slate-300 space-y-1">
                                    <li>• Visor de documento</li>
                                    <li>• Prompt (instrucciones)</li>
                                    <li>• Esquema (estructura)</li>
                                    <li>• Botón extraer</li>
                                    <li>• Resultados</li>
                                </ul>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded border border-green-700/30">
                                <h4 className="font-semibold text-green-400 mb-2">⚙️ Plantillas</h4>
                                <ul className="text-xs text-slate-300 space-y-1">
                                    <li>• Modelos IA (Genérico/Recomendado/Avanzado)</li>
                                    <li>• Plantillas por departamento</li>
                                    <li>• Mis Modelos</li>
                                    <li>• Crear/Guardar</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* CONSEJOS RÁPIDOS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/50">
                            <h4 className="font-semibold text-green-400 mb-3">✅ Haz Esto</h4>
                            <ul className="text-xs text-slate-300 space-y-2">
                                <li>• <strong>Usa el Asistente IA</strong> siempre primero 🤖</li>
                                <li>• <strong>Valida los datos</strong> antes de exportar ✅</li>
                                <li>• <strong>Prueba con 1 primero</strong> antes de procesar 100</li>
                                <li>• <strong>Guarda tus plantillas</strong> para reutilizar</li>
                                <li>• <strong>Exporta a Excel</strong> para análisis</li>
                            </ul>
                        </div>

                        <div className="bg-red-900/20 rounded-lg p-4 border border-red-700/50">
                            <h4 className="font-semibold text-red-400 mb-3">❌ Evita Esto</h4>
                            <ul className="text-xs text-slate-300 space-y-2">
                                <li>• No ignores el Asistente IA - te ahorra mucho tiempo</li>
                                <li>• No mezcles tipos de documentos en un lote</li>
                                <li>• No proceses sin validar primero</li>
                                <li>• No olvides exportar resultados</li>
                            </ul>
                        </div>
                    </div>

                    {/* TIPOS DE CAMPOS */}
                    <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
                        <h3 className="text-lg font-semibold text-slate-200 mb-3">📊 Tipos de Campos Disponibles</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700/30 flex justify-between">
                                <code className="text-blue-400">STRING</code>
                                <span className="text-slate-400">Texto (nombre, dirección)</span>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700/30 flex justify-between">
                                <code className="text-green-400">NUMBER</code>
                                <span className="text-slate-400">Números (precio, cantidad)</span>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700/30 flex justify-between">
                                <code className="text-purple-400">BOOLEAN</code>
                                <span className="text-slate-400">Sí/No (¿pagado?)</span>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700/30 flex justify-between">
                                <code className="text-amber-400">ARRAY_OF_STRINGS</code>
                                <span className="text-slate-400">Lista textos (productos)</span>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700/30 flex justify-between">
                                <code className="text-pink-400">ARRAY_OF_OBJECTS</code>
                                <span className="text-slate-400">Lista grupos (items)</span>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700/30 flex justify-between">
                                <code className="text-cyan-400">OBJECT</code>
                                <span className="text-slate-400">Grupo campos (dirección)</span>
                            </div>
                        </div>
                    </div>

                    {/* GUÍA: Crear Plantilla para Documentos Empresariales */}
                    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg p-6 border-2 border-green-600/50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-green-300">🏢 Guía: Crear Plantilla para Documentos Empresariales</h3>
                                <p className="text-sm text-green-200/80">Paso a paso para usuarios sin experiencia técnica</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Paso 1 */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-green-700/30">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-7 h-7 bg-green-600 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                        1
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-semibold text-green-300 mb-2">Ve al panel derecho</h4>
                                        <p className="text-sm text-slate-300 mb-2">
                                            En la parte derecha de la pantalla, haz clic en <strong className="text-green-400">"Mis Modelos"</strong> para expandir la sección
                                        </p>
                                        <div className="bg-green-900/20 p-2 rounded border border-green-700/30 text-xs text-green-200">
                                            📍 Luego haz clic en "Crear Nueva Plantilla"
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Paso 2 */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-green-700/30">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-7 h-7 bg-green-600 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                        2
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-semibold text-green-300 mb-2">Ponle un nombre a tu plantilla</h4>
                                        <p className="text-sm text-slate-300 mb-2">
                                            En el campo <strong>"Nombre"</strong>, escribe algo descriptivo:
                                        </p>
                                        <div className="bg-slate-900/50 p-2 rounded border border-green-700/30">
                                            <p className="text-xs text-green-300 font-mono">Ejemplo: "Factura de Proveedor"</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Paso 3 */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-green-700/30">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-7 h-7 bg-green-600 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                        3
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-semibold text-green-300 mb-2">Escribe qué información quieres extraer</h4>
                                        <p className="text-sm text-slate-300 mb-2">
                                            En el campo <strong>"Prompt"</strong>, describe en lenguaje normal:
                                        </p>
                                        <div className="bg-slate-900/50 p-3 rounded border border-green-700/30">
                                            <p className="text-xs text-green-300 font-mono">
                                                "Extrae de la factura: número, fecha, proveedor, concepto, subtotal, IVA y total"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Paso 4 */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-green-700/30">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-7 h-7 bg-green-600 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                        4
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-semibold text-green-300 mb-2">Define los campos del esquema</h4>
                                        <div className="space-y-2">
                                            <div className="bg-slate-900/50 p-2 rounded border border-green-700/30 flex items-center gap-2">
                                                <span className="text-xs font-mono text-green-400">numero_factura</span>
                                                <span className="text-xs text-slate-400">→</span>
                                                <span className="text-xs text-blue-300">STRING</span>
                                            </div>
                                            <div className="bg-slate-900/50 p-2 rounded border border-green-700/30 flex items-center gap-2">
                                                <span className="text-xs font-mono text-green-400">total</span>
                                                <span className="text-xs text-slate-400">→</span>
                                                <span className="text-xs text-green-300">NUMBER</span>
                                            </div>
                                        </div>
                                        <div className="bg-yellow-900/20 p-2 rounded border border-yellow-700/30 mt-3">
                                            <p className="text-xs text-yellow-200">
                                                ⚠️ <strong>Importante:</strong> No uses espacios ni tildes. Usa guión bajo (_)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Paso 5 */}
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-green-700/30">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-7 h-7 bg-green-600 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                        5
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-semibold text-green-300 mb-2">Guarda tu plantilla</h4>
                                        <p className="text-sm text-slate-300 mb-2">
                                            Haz clic en <strong className="text-green-400">"Guardar Plantilla"</strong>
                                        </p>
                                        <div className="bg-green-900/20 p-2 rounded border border-green-700/30">
                                            <p className="text-xs text-green-200">
                                                ✅ Tu plantilla aparecerá en "Mis Modelos"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PROCESAMIENTO EN LOTE */}
                    <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg p-5 border border-purple-700/50">
                        <h3 className="text-lg font-semibold text-purple-400 mb-2">🚀 Procesamiento en Lote</h3>
                        <p className="text-slate-300 text-sm mb-2">
                            ¿Tienes muchos documentos similares?
                        </p>
                        <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                            <li>Sube todos los archivos</li>
                            <li>Configura el esquema con el primero</li>
                            <li>Haz clic en <strong className="text-cyan-400">"Procesar Todos"</strong></li>
                            <li>¡Todos los archivos se procesarán automáticamente!</li>
                        </ol>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-900/50">
                    <div className="flex flex-col gap-4">
                        {/* Botones de descarga PDF */}
                        <div className="flex gap-3 justify-center flex-wrap">
                            <button
                                onClick={() => generateQuickGuidePDF()}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Descargar Guía Rápida (PDF)
                            </button>
                            <a
                                href="/docs/Guia_Completa_verbadoc_enterprises.pdf"
                                download="Guia_Completa_verbadoc_enterprises.pdf"
                                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors text-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Descargar Guía Completa (PDF)
                            </a>
                        </div>

                        {/* Footer info y botón cerrar */}
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-slate-500">
                                🇪🇺 100% Procesado en Europa | RGPD Compliant
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                                ¡Entendido!
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
