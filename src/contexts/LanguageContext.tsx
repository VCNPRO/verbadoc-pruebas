import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { SUPPORTED_LANGUAGES, getLanguageByCode, type LanguageConfig } from '../config/languages';

interface LanguageContextType {
  currentLanguage: string;
  changeLanguage: (code: string) => Promise<void>;
  languages: LanguageConfig[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const getInitialLanguage = (): string => {
    if (user?.preferred_language) return user.preferred_language;
    const stored = localStorage.getItem('verbadoc-ui-language');
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) return stored;
    return 'es';
  };

  const [currentLanguage, setCurrentLanguage] = useState<string>(getInitialLanguage);

  // Sync when user data loads
  useEffect(() => {
    if (user?.preferred_language && user.preferred_language !== currentLanguage) {
      setCurrentLanguage(user.preferred_language);
      i18n.changeLanguage(user.preferred_language);
      document.documentElement.lang = user.preferred_language;
    }
  }, [user?.preferred_language]);

  // Set initial language on mount
  useEffect(() => {
    const lang = getInitialLanguage();
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    document.documentElement.lang = lang;
  }, []);

  const changeLanguage = useCallback(async (code: string) => {
    if (!SUPPORTED_LANGUAGES.some(l => l.code === code)) return;

    await i18n.changeLanguage(code);
    setCurrentLanguage(code);
    localStorage.setItem('verbadoc-ui-language', code);
    localStorage.setItem('verbadoc-rag-language', code);
    document.documentElement.lang = code;

    // Persist to DB if authenticated (fire-and-forget)
    if (isAuthenticated) {
      fetch('/api/user/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: code }),
      }).catch(() => {});
    }
  }, [i18n, isAuthenticated]);

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
