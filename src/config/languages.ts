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
    flag: '🏴󠁥󠁳󠁣󠁴󠁿',
    promptInstruction: 'Respon en català.'
  },
  {
    code: 'gl',
    locale: 'gl-ES',
    name: 'Galego',
    nameEs: 'Gallego',
    flag: '🏴󠁥󠁳󠁧󠁡󠁿',
    promptInstruction: 'Responde en galego.'
  },
  {
    code: 'eu',
    locale: 'eu-ES',
    name: 'Euskara',
    nameEs: 'Euskera',
    flag: '🏴',
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

/**
 * Mensajes del sistema traducidos
 */
export const SYSTEM_MESSAGES: Record<string, Record<string, string>> = {
  noDocuments: {
    es: 'No se encontraron documentos relevantes para responder a tu pregunta.',
    ca: 'No s\'han trobat documents rellevants per respondre a la teva pregunta.',
    gl: 'Non se atoparon documentos relevantes para responder á túa pregunta.',
    eu: 'Ez da dokumentu garrantzitsurik aurkitu zure galderari erantzuteko.',
    pt: 'Não foram encontrados documentos relevantes para responder à sua pergunta.',
    fr: 'Aucun document pertinent n\'a été trouvé pour répondre à votre question.',
    en: 'No relevant documents found to answer your question.',
    it: 'Non sono stati trovati documenti rilevanti per rispondere alla tua domanda.',
    de: 'Es wurden keine relevanten Dokumente gefunden, um Ihre Frage zu beantworten.'
  },
  searching: {
    es: 'Buscando...',
    ca: 'Cercant...',
    gl: 'Buscando...',
    eu: 'Bilatzen...',
    pt: 'Pesquisando...',
    fr: 'Recherche...',
    en: 'Searching...',
    it: 'Ricerca...',
    de: 'Suche...'
  },
  search: {
    es: 'Buscar',
    ca: 'Cercar',
    gl: 'Buscar',
    eu: 'Bilatu',
    pt: 'Pesquisar',
    fr: 'Rechercher',
    en: 'Search',
    it: 'Cerca',
    de: 'Suchen'
  },
  placeholder: {
    es: 'Escribe o habla tu pregunta...',
    ca: 'Escriu o parla la teva pregunta...',
    gl: 'Escribe ou fala a túa pregunta...',
    eu: 'Idatzi edo esan zure galdera...',
    pt: 'Escreva ou fale sua pergunta...',
    fr: 'Écrivez ou parlez votre question...',
    en: 'Type or speak your question...',
    it: 'Scrivi o parla la tua domanda...',
    de: 'Schreiben oder sprechen Sie Ihre Frage...'
  },
  listening: {
    es: '🎤 Escuchando... habla ahora',
    ca: '🎤 Escoltant... parla ara',
    gl: '🎤 Escoitando... fala agora',
    eu: '🎤 Entzuten... hitz egin orain',
    pt: '🎤 Ouvindo... fale agora',
    fr: '🎤 Écoute... parlez maintenant',
    en: '🎤 Listening... speak now',
    it: '🎤 Ascolto... parla ora',
    de: '🎤 Zuhören... sprechen Sie jetzt'
  }
};

export function getMessage(key: string, langCode: string): string {
  return SYSTEM_MESSAGES[key]?.[langCode] || SYSTEM_MESSAGES[key]?.['es'] || key;
}
