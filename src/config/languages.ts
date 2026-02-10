/**
 * Configuración de idiomas soportados
 * src/config/languages.ts
 *
 * Idiomas para:
 * - Interfaz RAG (preguntas y respuestas)
 * - Reconocimiento de voz (STT)
 * - Síntesis de voz (TTS)
 */

export interface LanguageConfig {
  code: string;           // Código para API (es, ca, gl, eu, pt, fr, en, it, de)
  locale: string;         // Código para Web Speech API (es-ES, ca-ES, etc.)
  name: string;           // Nombre en el idioma original
  nameEs: string;         // Nombre en español
  flag: string;           // Emoji bandera
  promptInstruction: string; // Instrucción para el LLM
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'es',
    locale: 'es-ES',
    name: 'Español',
    nameEs: 'Español',
    flag: '🇪🇸',
    promptInstruction: 'Responde en español.'
  },
  {
    code: 'ca',
    locale: 'ca-ES',
    name: 'Català',
    nameEs: 'Catalán',
    flag: 'CA',
    promptInstruction: 'Respon en català.'
  },
  {
    code: 'gl',
    locale: 'gl-ES',
    name: 'Galego',
    nameEs: 'Gallego',
    flag: 'GL',
    promptInstruction: 'Responde en galego.'
  },
  {
    code: 'eu',
    locale: 'eu-ES',
    name: 'Euskara',
    nameEs: 'Euskera',
    flag: 'EU',
    promptInstruction: 'Erantzun euskaraz.'
  },
  {
    code: 'pt',
    locale: 'pt-PT',
    name: 'Português',
    nameEs: 'Portugués',
    flag: '🇵🇹',
    promptInstruction: 'Responda em português.'
  },
  {
    code: 'fr',
    locale: 'fr-FR',
    name: 'Français',
    nameEs: 'Francés',
    flag: '🇫🇷',
    promptInstruction: 'Répondez en français.'
  },
  {
    code: 'en',
    locale: 'en-GB',
    name: 'English',
    nameEs: 'Inglés',
    flag: '🇬🇧',
    promptInstruction: 'Respond in English.'
  },
  {
    code: 'it',
    locale: 'it-IT',
    name: 'Italiano',
    nameEs: 'Italiano',
    flag: '🇮🇹',
    promptInstruction: 'Rispondi in italiano.'
  },
  {
    code: 'de',
    locale: 'de-DE',
    name: 'Deutsch',
    nameEs: 'Alemán',
    flag: '🇩🇪',
    promptInstruction: 'Antworten Sie auf Deutsch.'
  }
];

export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0]; // Español

export function getLanguageByCode(code: string): LanguageConfig {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || DEFAULT_LANGUAGE;
}

export function getLanguageByLocale(locale: string): LanguageConfig {
  return SUPPORTED_LANGUAGES.find(l => l.locale === locale) || DEFAULT_LANGUAGE;
}
