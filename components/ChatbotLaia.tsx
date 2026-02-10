import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../src/contexts/LanguageContext';
import { getLanguageByCode } from '../src/config/languages';
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

export const ChatbotLaia: React.FC<ChatbotLaiaProps> = ({ isLightMode = false }) => {
    const { t } = useTranslation('chatbot');
    const { currentLanguage } = useLanguage();

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: '',
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

    // Update initial message when language changes
    useEffect(() => {
        setMessages(prev => {
            const updated = [...prev];
            if (updated.length > 0 && updated[0].id === '1') {
                updated[0] = {
                    ...updated[0],
                    text: t('ui.initialMessage')
                };
            }
            return updated;
        });
    }, [currentLanguage, t]);

    const findBestResponse = (userMessage: string): string => {
        const msg = userMessage.toLowerCase();

        // Saludos / Greetings
        if (msg.match(new RegExp(t('patterns.greetings'), 'i'))) {
            const greetings = t('knowledge.greetings', { returnObjects: true }) as string[];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }

        // What is verbadoc?
        if (msg.match(new RegExp(t('patterns.whatIsVerbadoc'), 'i')) && msg.match(new RegExp(t('patterns.verbadoc'), 'i'))) {
            return t('knowledge.whatIsVerbadoc');
        }

        // Interface
        if (msg.match(new RegExp(t('patterns.interface'), 'i'))) {
            return t('knowledge.interface');
        }

        // Quick start
        if (msg.match(new RegExp(t('patterns.quickStart'), 'i'))) {
            return t('knowledge.quickStart');
        }

        // AI Classification
        if (msg.match(new RegExp(t('patterns.aiClassification'), 'i'))) {
            return t('knowledge.aiClassification');
        }

        // Validation
        if (msg.match(new RegExp(t('patterns.validation'), 'i'))) {
            return t('knowledge.aiValidation');
        }

        // PDF Segmentation
        if (msg.match(new RegExp(t('patterns.pdfSegmentation'), 'i'))) {
            return t('knowledge.pdfSegmentation');
        }

        // Document types (but not field types)
        if (msg.match(new RegExp(t('patterns.documentTypes'), 'i')) && !msg.match(new RegExp(t('patterns.fieldTypes'), 'i'))) {
            return t('knowledge.documentTypes');
        }

        // Templates (create)
        if (msg.match(new RegExp(t('patterns.templates'), 'i')) && msg.match(new RegExp(t('patterns.templatesCreate'), 'i'))) {
            return t('knowledge.templates');
        }
        // Templates (general)
        if (msg.match(new RegExp(t('patterns.templates'), 'i'))) {
            return t('knowledge.templates');
        }

        // AI Models
        if (msg.match(new RegExp(t('patterns.models'), 'i'))) {
            return t('knowledge.models');
        }

        // Security
        if (msg.match(new RegExp(t('patterns.security'), 'i'))) {
            return t('knowledge.security');
        }

        // Learning system
        if (msg.match(new RegExp(t('patterns.learning'), 'i'))) {
            return t('knowledge.learning');
        }

        // Field types
        if (msg.match(new RegExp(t('patterns.fieldTypes'), 'i'))) {
            return t('knowledge.fieldTypes');
        }

        // Batch processing
        if (msg.match(new RegExp(t('patterns.batch'), 'i'))) {
            return t('knowledge.batch');
        }

        // Export
        if (msg.match(new RegExp(t('patterns.export'), 'i'))) {
            return t('knowledge.export');
        }

        // RAG / Semantic search
        if (msg.match(new RegExp(t('patterns.rag'), 'i'))) {
            return t('knowledge.rag');
        }

        // Folders / Organization
        if (msg.match(new RegExp(t('patterns.folders'), 'i'))) {
            return t('knowledge.folders');
        }

        // Modules / Permissions
        if (msg.match(new RegExp(t('patterns.modulesPermissions'), 'i'))) {
            return t('knowledge.modules');
        }

        // PDF Viewer
        if (msg.match(new RegExp(t('patterns.pdfViewer'), 'i'))) {
            return t('knowledge.pdfViewer');
        }

        // Pricing
        if (msg.match(new RegExp(t('patterns.pricing'), 'i'))) {
            return t('knowledge.pricing');
        }

        // Troubleshooting
        if (msg.match(new RegExp(t('patterns.troubleshooting'), 'i'))) {
            return t('knowledge.troubleshooting');
        }

        // Tips
        if (msg.match(new RegExp(t('patterns.tips'), 'i'))) {
            return t('knowledge.tips');
        }

        // Help
        if (msg.match(new RegExp(t('patterns.help'), 'i'))) {
            return t('knowledge.help');
        }

        // Default response
        return t('knowledge.defaultResponse');
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load available voices based on current language
    useEffect(() => {
        const loadVoices = () => {
            const langConfig = getLanguageByCode(currentLanguage);
            const voices = speechSynthesis.getVoices();
            const langVoices = voices.filter(v => v.lang.includes(langConfig.locale.split('-')[0]));
            setAvailableVoices(langVoices.length > 0 ? langVoices : voices);

            // Select default voice for the current language
            if (!voiceSettings.voiceName && langVoices.length > 0) {
                setVoiceSettings(prev => ({
                    ...prev,
                    voiceName: langVoices[0].name
                }));
            }
        };

        loadVoices();
        speechSynthesis.onvoiceschanged = loadVoices;
    }, [currentLanguage]);

    // Load saved preferences
    useEffect(() => {
        const saved = localStorage.getItem('laia-voice-settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setVoiceSettings(parsed);
            } catch (e) {
                console.error('Error loading voice preferences:', e);
            }
        }
    }, []);

    // Save preferences when they change
    useEffect(() => {
        localStorage.setItem('laia-voice-settings', JSON.stringify(voiceSettings));
    }, [voiceSettings]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Clean text of emojis and special characters for speech
    const cleanTextForSpeech = (text: string): string => {
        let cleaned = text;

        // Remove emojis and unicode symbols
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]/gu, '');

        // Remove keycap numbers
        cleaned = cleaned.replace(/[\u{0030}\u{0031}\u{0032}\u{0033}\u{0034}\u{0035}\u{0036}\u{0037}\u{0038}\u{0039}][\u{FE0F}]?[\u{20E3}]/gu, '');

        // Remove variation selectors
        cleaned = cleaned.replace(/[\u{FE00}-\u{FE0F}]/gu, '');

        // Remove slashes when part of options
        cleaned = cleaned.replace(/(\w+)\/(\w+)/g, '$1');

        // Remove bullets and special symbols
        cleaned = cleaned.replace(/[•◦▪▫●○■□▶►→⇒←↑↓]/g, '');

        // Remove basic markdown
        cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
        cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
        cleaned = cleaned.replace(/`(.*?)`/g, '$1');
        cleaned = cleaned.replace(/_{2,}/g, '');
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // Convert line breaks to natural pauses
        cleaned = cleaned.replace(/\n\n+/g, '. ');
        cleaned = cleaned.replace(/\n/g, ', ');

        // Clean multiple spaces
        cleaned = cleaned.replace(/\s{2,}/g, ' ');

        // Clean duplicate punctuation
        cleaned = cleaned.replace(/[.,]{2,}/g, '.');

        // Trim
        cleaned = cleaned.trim();

        return cleaned;
    };

    // Speak function using current language locale
    const speak = (text: string) => {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech Synthesis not supported in this browser');
            return;
        }

        if (!voiceSettings.enabled) return;

        // Cancel any speech in progress
        speechSynthesis.cancel();

        // Clean text of emojis and special characters
        const cleanedText = cleanTextForSpeech(text);

        const langConfig = getLanguageByCode(currentLanguage);
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.lang = langConfig.locale;
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;

        // Select voice
        const selectedVoice = availableVoices.find(v => v.name === voiceSettings.voiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        speechSynthesis.speak(utterance);
    };

    // Stop speaking
    const stopSpeaking = () => {
        speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    const handleSend = () => {
        if (!inputValue.trim()) return;

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        // Simulate Laia response with delay
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

            // Speak response if enabled
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
            {/* Floating button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-50 transition-all hover:scale-110"
                    style={{ backgroundColor: accentColor }}
                    title={t('ui.open')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                </button>
            )}

            {/* Chat window */}
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
                                <h3 className="font-bold text-white">{t('ui.title')}</h3>
                                <p className="text-xs text-white/80">{t('ui.subtitle')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Voice Toggle Button */}
                            <button
                                onClick={() => {
                                    if (isSpeaking) {
                                        stopSpeaking();
                                    } else {
                                        setVoiceSettings(prev => ({ ...prev, enabled: !prev.enabled }));
                                    }
                                }}
                                className="p-2 hover:bg-white/20 rounded transition-colors"
                                title={voiceSettings.enabled ? t('ui.stopSpeaking') : t('ui.voiceEnabled')}
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

                            {/* Settings Button */}
                            <button
                                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                                className="p-2 hover:bg-white/20 rounded transition-colors"
                                title={t('ui.voiceSettings')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>

                            {/* Close Button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/20 rounded transition-colors"
                                title={t('ui.close')}
                            >
                                <XIcon className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Voice Settings Menu */}
                    {showVoiceSettings && (
                        <div className="p-4 border-b" style={{ backgroundColor: isLightMode ? '#f9fafb' : '#0f172a', borderColor }}>
                            <h4 className="text-sm font-semibold mb-3" style={{ color: textColor }}>{t('ui.voiceSettings')}</h4>

                            {/* Toggle Enable */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm" style={{ color: textColor }}>{t('ui.voiceEnabled')}</span>
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

                            {/* Voice Selector */}
                            <div className="mb-3">
                                <label className="text-xs mb-1 block" style={{ color: textColor }}>{t('ui.voiceSelect')}:</label>
                                <select
                                    value={voiceSettings.voiceName}
                                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, voiceName: e.target.value }))}
                                    className="w-full px-2 py-1 rounded border text-sm"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    disabled={!voiceSettings.enabled}
                                >
                                    {availableVoices.length > 0 ? (
                                        availableVoices.map(voice => (
                                            <option key={voice.name} value={voice.name}>
                                                {voice.name} ({voice.lang})
                                            </option>
                                        ))
                                    ) : (
                                        <option>{t('ui.noVoices')}</option>
                                    )}
                                </select>
                            </div>

                            {/* Speed Control */}
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: textColor }}>
                                    {t('ui.voiceRate')}: {voiceSettings.rate.toFixed(1)}x
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
                                        {message.timestamp.toLocaleTimeString(getLanguageByCode(currentLanguage).locale, { hour: '2-digit', minute: '2-digit' })}
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
                                placeholder={t('ui.inputPlaceholder')}
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
                                title={t('ui.send')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
