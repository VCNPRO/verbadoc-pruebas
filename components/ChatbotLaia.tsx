import React, { useState, useRef, useEffect } from 'react';
import { XIcon } from './Icons';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'laia';
    timestamp: Date;
}

interface ChatbotLaiaProps {
    isLightMode?: boolean;
}

// Base de conocimiento de Laia basada en las guías de usuario completas
const LAIA_KNOWLEDGE = {
    greetings: [
        "¡Hola! Soy Laia, tu asistente virtual de verbadoc pro europa. Mi nombre es de origen griego y significa 'mujer que se expresa con facilidad'. ¿En qué puedo ayudarte hoy?",
        "¡Bienvenido! Soy Laia, mi nombre es de origen griego y significa 'mujer que se expresa con facilidad'. Estoy aquí para ayudarte con verbadoc pro europa. ¿Qué necesitas saber?",
    ],
    whatIsVerbadoc: "**verbadoc pro europa** es una herramienta web profesional que convierte automáticamente documentos no estructurados (PDFs, imágenes, facturas, contratos, etc.) en **datos estructurados** para Excel, bases de datos o sistemas empresariales.\n\n✅ 100% Procesamiento en Europa\n✅ Cumplimiento total GDPR\n✅ Asistente de IA integrado\n✅ Multi-documento inteligente\n✅ Aprende de tus correcciones\n✅ Sin almacenamiento persistente",
    quickStart: "**INICIO RÁPIDO:**\n\n1️⃣ Sube tu documento (PDF, JPG, PNG)\n2️⃣ Haz clic en '🔍 Clasificar Documento' (Asistente IA)\n3️⃣ La IA configura automáticamente todo\n4️⃣ Haz clic en '🚀 Ejecutar Extracción'\n5️⃣ Valida con '🔍 Validar Datos'\n6️⃣ Exporta en Excel, CSV o JSON\n\n⏱️ Tiempo total: ~15 segundos",
    aiClassification: "**CLASIFICACIÓN AUTOMÁTICA:**\n\nLa IA analiza visualmente tu documento e identifica el tipo (factura, DNI, contrato, etc.).\n\n✅ Detecta 15+ tipos de documentos\n✅ Configura automáticamente prompt y schema\n✅ Tiempo: 2-5 segundos\n✅ Precisión:\n  • Facturas: 95-98%\n  • DNI/Pasaportes: 90-95%\n  • Contratos: 85-90%\n  • Recetas médicas: 88-92%",
    aiValidation: "**VALIDACIÓN INTELIGENTE:**\n\nRevisa los datos extraídos para detectar errores.\n\n**Validación Básica (instantánea):**\n✅ Campos vacíos\n✅ Formatos (fechas, emails, CIF/NIF)\n✅ Valores fuera de rango\n\n**Validación Avanzada con IA (2-3 seg):**\n✅ Coherencia matemática (Subtotal + IVA = Total)\n✅ Comparación visual con documento\n✅ Detección OCR mal interpretado\n✅ Sugerencias de corrección",
    pdfSegmentation: "**SEGMENTACIÓN DE PDFs:**\n\nDetecta múltiples documentos dentro de un mismo PDF.\n\n📄 Funciona con PDFs de 2-50 páginas\n🔍 Identifica cambios de documento\n📊 Extrae cada documento por separado\n⏱️ Tiempo: 10-30 segundos\n\nEjemplo: PDF con 3 facturas → Extrae 3 documentos independientes",
    templates: "**PLANTILLAS DISPONIBLES:**\n\n📁 **Por Departamento:**\n• Contabilidad: Facturas, gastos, albaranes\n• Finanzas: Informes, estados financieros\n• Marketing: Presupuestos, campañas\n• Legal: Contratos, escrituras\n• RRHH: Nóminas, contratos laborales\n\n✨ **Crear Plantilla Personalizada:**\n1. Panel derecho → 'Mis Modelos'\n2. 'Crear Nueva Plantilla'\n3. Nombre descriptivo\n4. Escribir prompt\n5. Definir campos del schema\n6. Guardar\n\n⚠️ NO uses espacios ni tildes en nombres de campos",
    models: "**MODELOS DE IA DISPONIBLES:**\n\n🇪🇺 **Genérico** (rápido)\n→ Documentos simples, formularios estándar\n→ Ideal para alto volumen\n→ Tiempo: 3-5 segundos\n\n⭐ **Recomendado** (equilibrado)\n→ Facturas, contratos, informes\n→ Seleccionado por defecto\n→ Tiempo: 5-8 segundos\n\n🚀 **Avanzado** (máxima precisión)\n→ Documentos complejos con múltiples tablas\n→ Para documentos críticos\n→ Tiempo: 10-15 segundos\n\n🇪🇺 Todos procesados en Europa (Brussels, Frankfurt, Dublin)",
    security: "**SEGURIDAD Y CUMPLIMIENTO:**\n\n🇪🇺 Procesamiento 100% en Europa\n🔒 Cumplimiento RGPD/GDPR\n🏢 Protección datos empresariales\n🔐 Cifrado TLS 1.3\n📜 Certificaciones:\n  • ISO 27001 (Seguridad)\n  • ISO 27018 (Privacidad)\n  • SOC 2 Type II\n\n✅ Tus documentos NO se almacenan\n✅ Procesamiento temporal en memoria\n✅ Borrado automático tras extracción",
    fieldTypes: "**TIPOS DE CAMPOS:**\n\n• **STRING** - Texto (nombre, dirección, código)\n• **NUMBER** - Números (precio, cantidad, porcentaje)\n• **BOOLEAN** - Verdadero/Falso (sí/no, activo/inactivo)\n• **ARRAY** - Lista simple [\"item1\", \"item2\"]\n• **OBJECT** - Objeto anidado {calle: \"\", ciudad: \"\"}\n• **ARRAY_OF_OBJECTS** - Lista de objetos complejos\n\nEjemplo productos:\n```json\n{\n  \"productos\": [\n    {\"nombre\": \"Laptop\", \"precio\": 899, \"cantidad\": 2},\n    {\"nombre\": \"Mouse\", \"precio\": 25, \"cantidad\": 5}\n  ]\n}\n```",
    batch: "**PROCESAMIENTO EN LOTE:**\n\n1. Sube todos los archivos similares (hasta 50)\n2. Configura schema con el primer documento\n3. Haz clic en 'Procesar Todos' (panel izquierdo)\n4. ¡Todos se procesan automáticamente!\n\n✅ Ahorra tiempo con documentos repetitivos\n✅ Procesa 100 facturas en minutos\n✅ Exporta todo junto a Excel\n\n⏱️ Tiempo: ~5-8 seg por documento",
    export: "**EXPORTAR RESULTADOS:**\n\n📊 **Excel (.xlsx)** - Recomendado\n→ Análisis de datos\n→ Gráficos y tablas dinámicas\n→ Fórmulas automáticas\n\n📄 **CSV** - Compatible\n→ Hojas de cálculo simples\n→ Importar a otros sistemas\n\n🔧 **JSON** - Técnico\n→ APIs e integraciones\n→ Sistemas empresariales\n→ Bases de datos\n\n📄 **PDF** - Informes\n→ Compartir resultados\n→ Archivo visual",
    documentTypes: "**TIPOS DE DOCUMENTOS DETECTADOS:**\n\n✅ Facturas comerciales\n✅ Facturas de proveedor\n✅ Albaranes de entrega\n✅ Contratos laborales\n✅ Contratos de arrendamiento\n✅ DNI/NIE (frontal y completo)\n✅ Pasaportes\n✅ Recetas médicas\n✅ Informes médicos\n✅ Análisis clínicos\n✅ Nóminas\n✅ Certificados empresariales\n✅ Certificados académicos\n✅ Escrituras públicas\n✅ Documentos genéricos",
    tips: "💡 **CONSEJOS ÚTILES:**\n\n✅ Usa SIEMPRE el Asistente IA (Clasificar Documento)\n✅ Valida los datos antes de exportar\n✅ Prueba con 1 doc antes de procesar 100\n✅ Guarda plantillas para reutilizar\n✅ Modelo Recomendado para docs estándar\n✅ Correcciones → El sistema aprende\n\n❌ **EVITA:**\n❌ Mezclar tipos de documentos diferentes\n❌ Prompts vagos tipo 'extrae todo'\n❌ Documentos > 10 MB\n❌ PDFs protegidos con contraseña\n❌ Imágenes muy borrosas",
    learning: "**SISTEMA DE APRENDIZAJE:**\n\nCada vez que corriges un error, verbadoc pro europa aprende:\n\n✅ Guarda tu corrección\n✅ Detecta patrones de error\n✅ Aplica correcciones futuras automáticamente\n\n**Mejora de precisión esperada:**\n• Mes 1: 85-87%\n• Mes 3: 91-94%\n• Mes 6: 94-97%\n• Mes 12: 97-99%",
    pricing: "**GRUPOS DE VOLUMEN:**\n\n📦 Volumen Inicial: Hasta 500 docs/mes\n📦 Volumen Medio: 500-5,000 docs/mes\n📦 Volumen Alto: 5,000+ docs/mes\n📦 Empresarial: Personalizado\n\nContacta al equipo comercial para más información sobre el plan que mejor se adapta a tu organización.",
    troubleshooting: "**PROBLEMAS COMUNES:**\n\n❌ **Error 'Archivo muy grande'**\n→ Reduce el tamaño a < 10 MB\n→ Usa herramientas de compresión PDF\n\n❌ **'No se detecta texto'**\n→ Asegúrate que el PDF no sea escaneado en baja calidad\n→ Aumenta resolución de escaneo a 300 DPI\n\n❌ **'Datos extraídos incorrectos'**\n→ Usa Validación Inteligente\n→ Cambia a modelo Avanzado\n→ Revisa y corrige manualmente\n\n❌ **'La extracción tarda mucho'**\n→ Normal: 5-15 segundos\n→ Si > 30 seg, recarga la página",
    interface: "**INTERFAZ DE verbadoc pro europa:**\n\n📍 **Zona Izquierda:** Subir docs, configurar extracción\n📍 **Zona Central:** Vista previa, editor JSON\n📍 **Zona Derecha:** Asistente IA, Plantillas\n📍 **Zona Superior:** Selector modelo, exportación, ayuda\n\n💬 **Chat con Laia:** Botón flotante (yo!)",
    help: "Puedo ayudarte con:\n\n• ¿Qué es verbadoc pro europa?\n• Inicio rápido paso a paso\n• Clasificación automática de documentos\n• Validación inteligente de datos\n• Segmentación de PDFs multi-documento\n• Crear plantillas personalizadas\n• Modelos de IA disponibles\n• Tipos de documentos detectados\n• Tipos de campos del schema\n• Procesamiento en lote\n• Exportar resultados\n• Seguridad y cumplimiento RGPD\n• Sistema de aprendizaje continuo\n• Solución de problemas\n• Consejos y mejores prácticas\n\n¿Sobre qué quieres saber más?",
};

const findBestResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();

    // Saludos
    if (msg.match(/hola|buenos|buenas|hey|hi|saludos/i)) {
        return LAIA_KNOWLEDGE.greetings[Math.floor(Math.random() * LAIA_KNOWLEDGE.greetings.length)];
    }

    // ¿Qué es verbadoc?
    if (msg.match(/qué es|que es|para qué|para que|funciona|sirve/i) && msg.match(/verbadoc/i)) {
        return LAIA_KNOWLEDGE.whatIsVerbadoc;
    }

    // Interfaz
    if (msg.match(/interfaz|pantalla|zona|panel|dónde|donde|cómo navegar/i)) {
        return LAIA_KNOWLEDGE.interface;
    }

    // Inicio rápido
    if (msg.match(/empezar|comenzar|inicio|rápid|quick|start|primeros pasos/i)) {
        return LAIA_KNOWLEDGE.quickStart;
    }

    // Clasificación automática
    if (msg.match(/clasificar|clasificación|detectar tipo|identificar documento|asistente.*ia/i)) {
        return LAIA_KNOWLEDGE.aiClassification;
    }

    // Validación
    if (msg.match(/validar|validación|revisar datos|comprobar|verificar/i)) {
        return LAIA_KNOWLEDGE.aiValidation;
    }

    // Segmentación PDF
    if (msg.match(/segment|multi.*document|múltiples documentos|varios.*pdf|separar.*pdf/i)) {
        return LAIA_KNOWLEDGE.pdfSegmentation;
    }

    // Tipos de documentos
    if (msg.match(/tipos.*documento|qué.*documentos|documentos.*detect|factura|dni|contrato|receta/i) && !msg.match(/campo/i)) {
        return LAIA_KNOWLEDGE.documentTypes;
    }

    // Plantillas
    if (msg.match(/plantilla|template/i) && msg.match(/crear|nueva|hacer|generar|personalizada/i)) {
        return LAIA_KNOWLEDGE.templates;
    }
    if (msg.match(/plantilla|template/i)) {
        return LAIA_KNOWLEDGE.templates;
    }

    // Modelos de IA
    if (msg.match(/modelo|ia|inteligencia|genérico|recomendado|avanzado|cuál.*modelo/i)) {
        return LAIA_KNOWLEDGE.models;
    }

    // Seguridad
    if (msg.match(/seguridad|rgpd|gdpr|cumplimiento|legal|privacidad|europa|certificación|iso/i)) {
        return LAIA_KNOWLEDGE.security;
    }

    // Sistema de aprendizaje
    if (msg.match(/aprend|mejora|precisión|entrena/i)) {
        return LAIA_KNOWLEDGE.learning;
    }

    // Tipos de campos
    if (msg.match(/campo|tipo.*dato|string|number|boolean|array|object|schema/i)) {
        return LAIA_KNOWLEDGE.fieldTypes;
    }

    // Lote/Batch
    if (msg.match(/lote|batch|múltiple|muchos|varios.*documento|masiv/i)) {
        return LAIA_KNOWLEDGE.batch;
    }

    // Exportar
    if (msg.match(/exportar|descargar|guardar|excel|csv|json|pdf.*result/i)) {
        return LAIA_KNOWLEDGE.export;
    }

    // Precios
    if (msg.match(/precio|cost|volumen|plan|cuánto|cuanto|contrat/i)) {
        return LAIA_KNOWLEDGE.pricing;
    }

    // Problemas
    if (msg.match(/problema|error|fallo|no funciona|ayuda.*error|solucion/i)) {
        return LAIA_KNOWLEDGE.troubleshooting;
    }

    // Consejos
    if (msg.match(/consejo|tip|mejor|práctica|recomendación/i)) {
        return LAIA_KNOWLEDGE.tips;
    }

    // Ayuda general
    if (msg.match(/ayuda|help|qué puedes|qué sabes|menú/i)) {
        return LAIA_KNOWLEDGE.help;
    }

    // Respuesta por defecto
    return "Puedo ayudarte con:\n• ¿Qué es verbadoc enterprises?\n• Inicio rápido\n• Clasificación automática\n• Validación de datos\n• Plantillas y modelos de IA\n• Seguridad RGPD\n• Procesamiento en lote\n• Exportar resultados\n• Solución de problemas\n\n¿Sobre qué quieres saber más específicamente?";};

export const ChatbotLaia: React.FC<ChatbotLaiaProps> = ({ isLightMode = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: '¡Hola! Soy Laia, tu asistente de verbadoc enterprises 🇪🇺\n\nMi nombre es de origen griego y significa "mujer que se expresa con facilidad".\n\nPuedo ayudarte con:\n✨ Inicio rápido\n🤖 Asistente de IA\n📋 Plantillas y modelos\n🔒 Seguridad RGPD\n📊 Exportar resultados\n🛠️ Solución de problemas\n\n¿En qué puedo ayudarte hoy?',
            sender: 'laia',
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [voiceSettings, setVoiceSettings] = useState({
        enabled: false,
        voiceName: '',
        rate: 0.9,
        pitch: 1.0
    });
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Cargar voces disponibles
    useEffect(() => {
        const loadVoices = () => {
            const voices = speechSynthesis.getVoices();
            const spanishVoices = voices.filter(v => v.lang.includes('es'));
            setAvailableVoices(spanishVoices.length > 0 ? spanishVoices : voices);

            // Seleccionar voz por defecto en español
            if (!voiceSettings.voiceName && spanishVoices.length > 0) {
                setVoiceSettings(prev => ({
                    ...prev,
                    voiceName: spanishVoices[0].name
                }));
            }
        };

        loadVoices();
        speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    // Cargar preferencias guardadas
    useEffect(() => {
        const saved = localStorage.getItem('laia-voice-settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setVoiceSettings(parsed);
            } catch (e) {
                console.error('Error cargando preferencias de voz:', e);
            }
        }
    }, []);

    // Guardar preferencias cuando cambian
    useEffect(() => {
        localStorage.setItem('laia-voice-settings', JSON.stringify(voiceSettings));
    }, [voiceSettings]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Función para limpiar texto de emojis y caracteres especiales
    const cleanTextForSpeech = (text: string): string => {
        let cleaned = text;

        // Eliminar emojis y símbolos unicode
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]/gu, '');

        // Eliminar números con keycaps (1️⃣, 2️⃣, etc.)
        cleaned = cleaned.replace(/[\u{0030}\u{0031}\u{0032}\u{0033}\u{0034}\u{0035}\u{0036}\u{0037}\u{0038}\u{0039}][\u{FE0F}]?[\u{20E3}]/gu, '');

        // Eliminar variation selectors
        cleaned = cleaned.replace(/[\u{FE00}-\u{FE0F}]/gu, '');

        // Eliminar barras "/" cuando son parte de opciones (a/o, Bienvenido/a, etc.)
        cleaned = cleaned.replace(/(\w+)\/(\w+)/g, '$1');

        // Eliminar bullets y otros símbolos especiales
        cleaned = cleaned.replace(/[•◦▪▫●○■□▶►→⇒←↑↓]/g, '');

        // Eliminar markdown básico
        cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // **bold**
        cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');     // *italic*
        cleaned = cleaned.replace(/`(.*?)`/g, '$1');       // `code`
        cleaned = cleaned.replace(/_{2,}/g, '');           // ___
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url)

        // Convertir saltos de línea en pausas naturales
        // Doble salto de línea → pausa más larga (. )
        cleaned = cleaned.replace(/\n\n+/g, '. ');
        // Salto de línea simple → pausa corta (, )
        cleaned = cleaned.replace(/\n/g, ', ');

        // Limpiar múltiples espacios
        cleaned = cleaned.replace(/\s{2,}/g, ' ');

        // Limpiar puntuación duplicada
        cleaned = cleaned.replace(/[.,]{2,}/g, '.');

        // Limpiar espacios al inicio y final
        cleaned = cleaned.trim();

        return cleaned;
    };

    // Función para hablar
    const speak = (text: string) => {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech Synthesis no soportado en este navegador');
            return;
        }

        if (!voiceSettings.enabled) return;

        // Cancelar cualquier speech en progreso
        speechSynthesis.cancel();

        // Limpiar el texto de emojis y caracteres especiales
        const cleanedText = cleanTextForSpeech(text);

        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.lang = 'es-ES';
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;

        // Seleccionar voz
        const selectedVoice = availableVoices.find(v => v.name === voiceSettings.voiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        speechSynthesis.speak(utterance);
    };

    // Función para detener el habla
    const stopSpeaking = () => {
        speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    const handleSend = () => {
        if (!inputValue.trim()) return;

        // Agregar mensaje del usuario
        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        // Simular respuesta de Laia con delay
        setTimeout(() => {
            const response = findBestResponse(inputValue);
            const laiaMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: response,
                sender: 'laia',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, laiaMessage]);
            setIsTyping(false);

            // Hablar la respuesta si está activado
            speak(response);
        }, 800);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const bgColor = isLightMode ? '#ffffff' : '#1e293b';
    const textColor = isLightMode ? '#1f2937' : '#f1f5f9';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';
    const bubbleUserBg = isLightMode ? '#2563eb' : '#0891b2';
    const bubbleLaiaBg = isLightMode ? '#f0f9ff' : '#0f172a';
    const borderColor = isLightMode ? '#d1d5db' : '#475569';

    return (
        <>
            {/* Botón flotante */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-50 transition-all hover:scale-110"
                    style={{ backgroundColor: accentColor }}
                    title="Chat con Laia"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                </button>
            )}

            {/* Ventana de chat */}
            {isOpen && (
                <div
                    className="fixed bottom-6 right-6 w-96 h-[600px] rounded-2xl shadow-2xl flex flex-col z-50 border-2"
                    style={{ backgroundColor: bgColor, borderColor }}
                >
                    {/* Header */}
                    <div
                        className="p-4 rounded-t-2xl flex items-center justify-between border-b-2"
                        style={{ backgroundColor: accentColor, borderColor }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-lg" style={{ color: accentColor }}>
                                L
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Laia</h3>
                                <p className="text-xs text-white/80">Asistente Virtual</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Botón Toggle Voz */}
                            <button
                                onClick={() => {
                                    if (isSpeaking) {
                                        stopSpeaking();
                                    } else {
                                        setVoiceSettings(prev => ({ ...prev, enabled: !prev.enabled }));
                                    }
                                }}
                                className="p-2 hover:bg-white/20 rounded transition-colors"
                                title={voiceSettings.enabled ? 'Desactivar voz' : 'Activar voz'}
                            >
                                {isSpeaking ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                ) : voiceSettings.enabled ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                    </svg>
                                )}
                            </button>

                            {/* Botón Configuración */}
                            <button
                                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                                className="p-2 hover:bg-white/20 rounded transition-colors"
                                title="Configuración de voz"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>

                            {/* Botón Cerrar */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/20 rounded transition-colors"
                            >
                                <XIcon className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Menú de Configuración de Voz */}
                    {showVoiceSettings && (
                        <div className="p-4 border-b" style={{ backgroundColor: isLightMode ? '#f9fafb' : '#0f172a', borderColor }}>
                            <h4 className="text-sm font-semibold mb-3" style={{ color: textColor }}>⚙️ Configuración de Voz</h4>

                            {/* Toggle Activar */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm" style={{ color: textColor }}>Activar voz</span>
                                <button
                                    onClick={() => setVoiceSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                                    className="relative w-12 h-6 rounded-full transition-colors"
                                    style={{ backgroundColor: voiceSettings.enabled ? accentColor : '#94a3b8' }}
                                >
                                    <div
                                        className="absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform"
                                        style={{ left: voiceSettings.enabled ? '24px' : '2px' }}
                                    />
                                </button>
                            </div>

                            {/* Selector de Voz */}
                            <div className="mb-3">
                                <label className="text-xs mb-1 block" style={{ color: textColor }}>Voz:</label>
                                <select
                                    value={voiceSettings.voiceName}
                                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, voiceName: e.target.value }))}
                                    className="w-full px-2 py-1 rounded border text-sm"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    disabled={!voiceSettings.enabled}
                                >
                                    {availableVoices.map(voice => (
                                        <option key={voice.name} value={voice.name}>
                                            {voice.name} {voice.lang.includes('es') ? '🇪🇸' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Control de Velocidad */}
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: textColor }}>
                                    Velocidad: {voiceSettings.rate.toFixed(1)}x
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={voiceSettings.rate}
                                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                                    className="w-full"
                                    disabled={!voiceSettings.enabled}
                                />
                                <div className="flex justify-between text-xs mt-1" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    <span>Lento</span>
                                    <span>Normal</span>
                                    <span>Rápido</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                        message.sender === 'user' ? 'rounded-br-none' : 'rounded-bl-none'
                                    }`}
                                    style={{
                                        backgroundColor: message.sender === 'user' ? bubbleUserBg : bubbleLaiaBg,
                                        color: message.sender === 'user' ? '#ffffff' : textColor,
                                        border: message.sender === 'laia' ? `1px solid ${borderColor}` : 'none'
                                    }}
                                >
                                    <p className="text-sm whitespace-pre-line">{message.text}</p>
                                    <p className="text-xs mt-1 opacity-70">
                                        {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div
                                    className="rounded-2xl rounded-bl-none px-4 py-3 border"
                                    style={{
                                        backgroundColor: bubbleLaiaBg,
                                        borderColor
                                    }}
                                >
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t-2" style={{ borderColor }}>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Escribe tu pregunta..."
                                className="flex-1 px-4 py-2 rounded-full border-2 focus:outline-none transition-colors"
                                style={{
                                    backgroundColor: isLightMode ? '#f9fafb' : '#0f172a',
                                    borderColor,
                                    color: textColor
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: accentColor }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs mt-2 text-center" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                            Laia está aquí para ayudarte 🇪🇺
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};
