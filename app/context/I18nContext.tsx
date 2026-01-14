// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Locale = 'zh-CN' | 'en';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  tArray: (key: string) => string[];
}

export const I18nContext = createContext<I18nContextType | null>(null);

// Nested key getter utility
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let result: unknown = obj;
  for (const key of keys) {
    if (result && typeof result === 'object') {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return result;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-CN');
  const [translations, setTranslations] = useState<Record<string, unknown>>({});

  // Load translations
  useEffect(() => {
    async function loadTranslations() {
      try {
        const response = await fetch(`/locales/${locale}.json`);
        if (response.ok) {
          const data = await response.json();
          setTranslations(data);
        }
      } catch {
        console.error('Failed to load translations:', locale);
      }
    }
    loadTranslations();
  }, [locale]);

  // Initialize language setting
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedLocale = localStorage.getItem('locale') as Locale | null;
    const params = new URLSearchParams(window.location.search);
    const urlLocale = params.get('lang') as Locale | null;

    if (urlLocale && (urlLocale === 'zh-CN' || urlLocale === 'en')) {
      setLocaleState(urlLocale);
    } else if (savedLocale && (savedLocale === 'zh-CN' || savedLocale === 'en')) {
      setLocaleState(savedLocale);
    } else {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('zh')) {
        setLocaleState('zh-CN');
      } else {
        setLocaleState('en');
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    const params = new URLSearchParams(window.location.search);
    params.set('lang', newLocale);
    window.history.replaceState({}, '', `?${params.toString()}`);
  };

  const t = (key: string): string => {
    const value = getNestedValue(translations, key);
    return typeof value === 'string' ? value : key;
  };

  const tArray = (key: string): string[] => {
    const value = getNestedValue(translations, key);
    return Array.isArray(value) ? value : [];
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tArray }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
}
