import React from 'react';
import { XIcon } from './Icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLightMode?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isLightMode }) => {
    if (!isOpen) return null;

    const bgColor = isLightMode ? '#ffffff' : '#1e293b';
    const textColor = isLightMode ? '#1f2937' : '#f1f5f9';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';
    const cardBg = isLightMode ? '#f0f9ff' : '#0f172a';
    const borderColor = isLightMode ? '#93c5fd' : '#475569';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="rounded-lg border-2 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
                style={{ backgroundColor: bgColor, borderColor }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-6 border-b-2"
                    style={{ borderColor }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: accentColor }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold" style={{ color: textColor }}>
                                Cumplimiento Legal y Seguridad
                            </h2>
                            <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                Compromisos para operar en el sector empresarial europeo
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:opacity-70 rounded-lg transition-colors"
                        title="Cerrar"
                    >
                        <XIcon className="w-6 h-6" style={{ color: textColor }} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6">

                    {/* EU Data Processing */}
                    <div
                        className="rounded-lg p-6 border-2"
                        style={{ backgroundColor: cardBg, borderColor }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">🇪🇺</span>
                            <div>
                                <h3 className="text-xl font-bold" style={{ color: accentColor }}>
                                    Procesamiento 100% en Europa
                                </h3>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Todos los datos se procesan en servidores europeos
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Servidores en Bélgica (europe-west1)</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Infraestructura de Google Cloud en región europea certificada
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>IA procesada en Europa</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Modelos Gemini ejecutados en Vertex AI región europea (Bélgica)
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Sin transferencias internacionales</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Los datos nunca salen del territorio de la Unión Europea
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GDPR Compliance */}
                    <div
                        className="rounded-lg p-6 border-2"
                        style={{ backgroundColor: cardBg, borderColor }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">🔒</span>
                            <div>
                                <h3 className="text-xl font-bold" style={{ color: accentColor }}>
                                    Cumplimiento RGPD/GDPR
                                </h3>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Reglamento General de Protección de Datos
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Datos anonimizados</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Los documentos se procesan sin almacenar información personal identificable
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>No se almacenan documentos</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Procesamiento en memoria, sin persistencia de archivos empresariales
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Derecho al olvido</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Los datos extraídos se almacenan localmente en tu navegador
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Cifrado en tránsito</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        TLS 1.3 para todas las comunicaciones API
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Business Data Protection */}
                    <div
                        className="rounded-lg p-6 border-2"
                        style={{ backgroundColor: cardBg, borderColor }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">🏢</span>
                            <div>
                                <h3 className="text-xl font-bold" style={{ color: accentColor }}>
                                    Protección de Datos Empresariales
                                </h3>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Seguridad específica para el sector empresarial
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Confidencialidad empresarial</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Protección de información comercial sensible y datos financieros
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Segregación por departamentos</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Control de acceso basado en roles departamentales
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Auditoría de accesos</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Registro de todas las operaciones de procesamiento
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Technical Certifications */}
                    <div
                        className="rounded-lg p-6 border-2"
                        style={{ backgroundColor: cardBg, borderColor }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">📜</span>
                            <div>
                                <h3 className="text-xl font-bold" style={{ color: accentColor }}>
                                    Certificaciones Técnicas
                                </h3>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Infraestructura certificada por organismos internacionales
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div
                                className="p-3 rounded border"
                                style={{
                                    backgroundColor: isLightMode ? '#ffffff' : '#0f172a',
                                    borderColor: isLightMode ? '#d1d5db' : '#334155'
                                }}
                            >
                                <p className="font-semibold text-sm" style={{ color: textColor }}>ISO 27001</p>
                                <p className="text-xs" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Seguridad de la información
                                </p>
                            </div>
                            <div
                                className="p-3 rounded border"
                                style={{
                                    backgroundColor: isLightMode ? '#ffffff' : '#0f172a',
                                    borderColor: isLightMode ? '#d1d5db' : '#334155'
                                }}
                            >
                                <p className="font-semibold text-sm" style={{ color: textColor }}>ISO 27018</p>
                                <p className="text-xs" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Protección de datos en la nube
                                </p>
                            </div>
                            <div
                                className="p-3 rounded border"
                                style={{
                                    backgroundColor: isLightMode ? '#ffffff' : '#0f172a',
                                    borderColor: isLightMode ? '#d1d5db' : '#334155'
                                }}
                            >
                                <p className="font-semibold text-sm" style={{ color: textColor }}>SOC 2 Type II</p>
                                <p className="text-xs" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Controles de seguridad auditados
                                </p>
                            </div>
                            <div
                                className="p-3 rounded border"
                                style={{
                                    backgroundColor: isLightMode ? '#ffffff' : '#0f172a',
                                    borderColor: isLightMode ? '#d1d5db' : '#334155'
                                }}
                            >
                                <p className="font-semibold text-sm" style={{ color: textColor }}>Google Cloud Enterprise</p>
                                <p className="text-xs" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Infraestructura certificada nivel empresarial
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Privacy & Transparency */}
                    <div
                        className="rounded-lg p-6 border-2"
                        style={{ backgroundColor: cardBg, borderColor }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">👁️</span>
                            <div>
                                <h3 className="text-xl font-bold" style={{ color: accentColor }}>
                                    Privacidad y Transparencia
                                </h3>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    Control total sobre tus datos
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Sin cookies de seguimiento</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        No utilizamos cookies de terceros ni analytics invasivos
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Procesamiento transparente</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Puedes ver exactamente qué datos se extraen antes de exportar
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: accentColor }}>✓</span>
                                <div>
                                    <p className="font-semibold" style={{ color: textColor }}>Open source friendly</p>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        Arquitectura auditable y verificable
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Version Info */}
                    <div className="text-center pt-4 border-t-2" style={{ borderColor }}>
                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                            verbadoc pro europa v1.0 • Última actualización: Febrero 2025
                        </p>
                        <p className="text-xs mt-1" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                            Para consultas sobre cumplimiento legal: legal@verbadoc.eu
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
