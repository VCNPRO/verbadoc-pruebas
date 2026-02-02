import React, { useState, useRef, useEffect } from 'react';
import type { ExtractionResult } from '../types.ts';

interface DocumentChatProps {
    result: ExtractionResult;
    isLightMode?: boolean;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const DocumentChat: React.FC<DocumentChatProps> = ({ result, isLightMode }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isAsking, setIsAsking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const borderColor = isLightMode ? '#dbeafe' : 'rgba(51, 65, 85, 0.5)';
    const textColor = isLightMode ? '#1e3a8a' : '#f1f5f9';
    const textSecondary = isLightMode ? '#475569' : '#94a3b8';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleAskQuestion = async () => {
        if (!question.trim() || isAsking) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: question.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setQuestion('');
        setIsAsking(true);

        try {
            // Preparar el contexto del documento
            let documentContext = '';
            if (result.type === 'transcription' && result.transcription) {
                documentContext = result.transcription;
            } else if (result.type === 'extraction' && result.extractedData) {
                documentContext = JSON.stringify(result.extractedData, null, 2);
            }

            // Llamar a la API de Vertex AI (usa backend con Service Account)
            const response = await fetch('/api/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        role: 'user',
                        parts: [
                            {
                                text: `Eres un asistente que ayuda a responder preguntas sobre documentos.

CONTEXTO DEL DOCUMENTO (${result.type === 'transcription' ? 'Transcripción completa' : 'Datos extraídos'}):
${documentContext}

PREGUNTA DEL USUARIO:
${userMessage.content}

INSTRUCCIONES:
- Responde ÚNICAMENTE basándote en la información del documento proporcionado
- Si la información no está en el documento, di "No encuentro esa información en el documento"
- Sé conciso y preciso
- Si es una transcripción, cita el fragmento relevante
- Si son datos extraídos, menciona los campos específicos

Responde ahora:`
                            }
                        ]
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status}`);
            }

            const data = await response.json();

            // Extraer la respuesta
            let assistantResponse = 'No pude procesar la respuesta.';
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                assistantResponse = data.candidates[0].content.parts[0].text;
            }

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: assistantResponse,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAsking(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAskQuestion();
        }
    };

    const suggestedQuestions = result.type === 'transcription'
        ? [
            '¿Cuál es el tema principal?',
            'Resume el contenido en 3 puntos',
            '¿Hay fechas importantes mencionadas?'
        ]
        : [
            '¿Qué datos se extrajeron?',
            '¿Cuál es el valor total?',
            'Explica los datos extraídos'
        ];

    return (
        <div
            className="rounded-lg border transition-all"
            style={{
                backgroundColor: isLightMode ? '#f0f9ff' : 'rgba(30, 41, 59, 0.5)',
                borderColor: borderColor
            }}
        >
            {/* Header colapsable */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between hover:opacity-80 transition-all"
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">💬</span>
                    <span className="font-semibold text-sm" style={{ color: textColor }}>
                        Pregúntale al Documento
                    </span>
                    {messages.length > 0 && (
                        <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                                backgroundColor: isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)',
                                color: accentColor
                            }}
                        >
                            {messages.length} {messages.length === 1 ? 'pregunta' : 'preguntas'}
                        </span>
                    )}
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: textSecondary }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Contenido expandible */}
            {isExpanded && (
                <div className="p-3 pt-0 border-t" style={{ borderColor: borderColor }}>
                    {/* Mensajes del chat */}
                    {messages.length > 0 && (
                        <div
                            className="mb-3 p-2 rounded max-h-48 overflow-y-auto space-y-2"
                            style={{
                                backgroundColor: isLightMode ? '#ffffff' : 'rgba(15, 23, 42, 0.5)'
                            }}
                        >
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`p-2 rounded text-sm ${msg.role === 'user' ? 'ml-8' : 'mr-8'}`}
                                    style={{
                                        backgroundColor: msg.role === 'user'
                                            ? (isLightMode ? '#dbeafe' : 'rgba(6, 182, 212, 0.2)')
                                            : (isLightMode ? '#f1f5f9' : 'rgba(51, 65, 85, 0.3)'),
                                        color: textColor
                                    }}
                                >
                                    <div className="font-semibold text-xs mb-1" style={{ color: textSecondary }}>
                                        {msg.role === 'user' ? '👤 Tú' : '🤖 Asistente'}
                                    </div>
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {/* Sugerencias (solo si no hay mensajes) */}
                    {messages.length === 0 && (
                        <div className="mb-3">
                            <p className="text-xs mb-2" style={{ color: textSecondary }}>
                                💡 Ejemplos de preguntas:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {suggestedQuestions.map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setQuestion(q)}
                                        className="text-xs px-2 py-1 rounded hover:opacity-80 transition-all"
                                        style={{
                                            backgroundColor: isLightMode ? '#e0e7ff' : 'rgba(99, 102, 241, 0.2)',
                                            color: textColor
                                        }}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input de pregunta */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Escribe tu pregunta aquí..."
                            disabled={isAsking}
                            className="flex-1 px-3 py-2 rounded text-sm border focus:outline-none focus:ring-2"
                            style={{
                                backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
                                borderColor: borderColor,
                                color: textColor
                            }}
                        />
                        <button
                            onClick={handleAskQuestion}
                            disabled={!question.trim() || isAsking}
                            className="px-4 py-2 rounded text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: accentColor,
                                color: '#ffffff'
                            }}
                        >
                            {isAsking ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                '→'
                            )}
                        </button>
                    </div>

                    {/* Botón limpiar chat */}
                    {messages.length > 0 && (
                        <button
                            onClick={() => setMessages([])}
                            className="mt-2 text-xs hover:opacity-80 transition-all"
                            style={{ color: textSecondary }}
                        >
                            🗑️ Limpiar conversación
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
