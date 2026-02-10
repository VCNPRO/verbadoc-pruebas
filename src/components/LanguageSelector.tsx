import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getLanguageByCode } from '../config/languages';

export const LanguageSelector = ({ isLightMode = false }: { isLightMode?: boolean }) => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = getLanguageByCode(currentLanguage);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 border rounded-md text-base transition-all duration-500 shadow hover:shadow-md hover:scale-105"
        style={{
          backgroundColor: isLightMode ? '#f59e0b' : '#d97706',
          borderColor: isLightMode ? '#d97706' : '#f59e0b',
          color: '#ffffff',
        }}
        title={currentLang.name}
      >
        <span className="text-sm leading-none">{currentLang.flag}</span>
      </button>
      {isOpen && (
        <div
          className="absolute right-0 top-10 w-48 rounded-lg shadow-xl border z-50 overflow-hidden"
          style={{
            backgroundColor: isLightMode ? '#ffffff' : '#1e293b',
            borderColor: isLightMode ? '#e2e8f0' : '#334155',
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                changeLanguage(lang.code);
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors hover:bg-opacity-10"
              style={{
                backgroundColor: lang.code === currentLanguage
                  ? (isLightMode ? '#eff6ff' : '#334155')
                  : 'transparent',
                color: isLightMode ? '#1e293b' : '#e2e8f0',
              }}
              onMouseEnter={(e) => {
                if (lang.code !== currentLanguage) {
                  e.currentTarget.style.backgroundColor = isLightMode ? '#f8fafc' : '#293548';
                }
              }}
              onMouseLeave={(e) => {
                if (lang.code !== currentLanguage) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="flex-1">{lang.name}</span>
              {lang.code === currentLanguage && (
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
