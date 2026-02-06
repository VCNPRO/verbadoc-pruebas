/**
 * useVoice Hook - Speech-to-Text y Text-to-Speech
 *
 * Funcionalidad de voz reutilizable para toda la app.
 * Usa Web Speech API (gratis, funciona en Chrome/Edge/Safari)
 *
 * Uso:
 *   const { startListening, speak, transcript, isListening, isSpeaking } = useVoice();
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Tipos para Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface VoiceSettings {
  language: string;
  voiceName: string;
  rate: number;
  pitch: number;
  autoSpeak: boolean;
}

export interface UseVoiceReturn {
  // Speech-to-Text (Micrófono)
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  clearTranscript: () => void;

  // Text-to-Speech (Leer)
  speak: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;

  // Configuración
  settings: VoiceSettings;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  availableVoices: SpeechSynthesisVoice[];

  // Estado
  isSupported: boolean;
  isSttSupported: boolean;
  isTtsSupported: boolean;
  error: string | null;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  language: 'es-ES',
  voiceName: '',
  rate: 1.0,
  pitch: 1.0,
  autoSpeak: false,
};

export function useVoice(): UseVoiceReturn {
  // Estado STT (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  // Estado TTS (Text-to-Speech)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Estado general
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);

  // Referencias
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Detectar soporte
  const isSttSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const isTtsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isSupported = isSttSupported || isTtsSupported;

  // Cargar configuración guardada
  useEffect(() => {
    const saved = localStorage.getItem('verbadoc-voice-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.warn('Error cargando configuración de voz:', e);
      }
    }
  }, []);

  // Guardar configuración cuando cambia
  useEffect(() => {
    localStorage.setItem('verbadoc-voice-settings', JSON.stringify(settings));
  }, [settings]);

  // Cargar voces disponibles para TTS
  useEffect(() => {
    if (!isTtsSupported) return;

    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      // Priorizar voces en español
      const sortedVoices = voices.sort((a, b) => {
        const aEs = a.lang.startsWith('es') ? 0 : 1;
        const bEs = b.lang.startsWith('es') ? 0 : 1;
        return aEs - bEs;
      });
      setAvailableVoices(sortedVoices);

      // Seleccionar voz por defecto si no hay una configurada
      if (!settings.voiceName && sortedVoices.length > 0) {
        const spanishVoice = sortedVoices.find(v => v.lang.startsWith('es'));
        if (spanishVoice) {
          setSettings(prev => ({ ...prev, voiceName: spanishVoice.name }));
        }
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [isTtsSupported]);

  // Inicializar reconocimiento de voz
  useEffect(() => {
    if (!isSttSupported) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      switch (event.error) {
        case 'no-speech':
          setError('No se detectó voz. Intenta de nuevo.');
          break;
        case 'audio-capture':
          setError('No se encontró micrófono. Verifica los permisos.');
          break;
        case 'not-allowed':
          setError('Permiso de micrófono denegado. Actívalo en la configuración del navegador.');
          break;
        case 'network':
          setError('Error de red. Verifica tu conexión.');
          break;
        default:
          setError(`Error: ${event.error}`);
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSttSupported, settings.language]);

  // Actualizar idioma cuando cambia
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = settings.language;
    }
  }, [settings.language]);

  // Funciones STT
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    setError(null);
    setTranscript('');
    setInterimTranscript('');

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
      setError('Error al iniciar el reconocimiento de voz');
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
  }, [isListening]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Funciones TTS
  const speak = useCallback((text: string) => {
    if (!isTtsSupported || !text.trim()) return;

    // Cancelar cualquier síntesis en progreso
    speechSynthesis.cancel();

    // Limpiar texto de emojis y caracteres especiales
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/\*\*/g, '')                    // Markdown bold
      .replace(/\*/g, '')                      // Markdown italic
      .replace(/#{1,6}\s/g, '')               // Markdown headers
      .replace(/`/g, '')                       // Code blocks
      .replace(/\n+/g, '. ')                  // Newlines to pauses
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = settings.language;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;

    // Seleccionar voz configurada
    const selectedVoice = availableVoices.find(v => v.name === settings.voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesis.speak(utterance);
  }, [isTtsSupported, settings, availableVoices]);

  const stopSpeaking = useCallback(() => {
    if (!isTtsSupported) return;
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isTtsSupported]);

  // Actualizar configuración
  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return {
    // STT
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    isListening,
    clearTranscript,

    // TTS
    speak,
    stopSpeaking,
    isSpeaking,

    // Config
    settings,
    updateSettings,
    availableVoices,

    // Estado
    isSupported,
    isSttSupported,
    isTtsSupported,
    error,
  };
}

export default useVoice;
