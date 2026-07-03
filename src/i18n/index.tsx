import React, { createContext, useContext, useState, useCallback } from 'react';
import { en, type TranslationKeys } from './en';
import { fi } from './fi';

type Locale = 'en' | 'fi';

interface I18nContextValue {
  locale: Locale;
  t: TranslationKeys;
  setLocale: (locale: Locale) => void;
}

const translations: Record<Locale, TranslationKeys> = { en, fi };

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: en,
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

const localeMap: Record<Locale, string> = { en: 'en-GB', fi: 'fi-FI' };

export function formatDateLocale(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(localeMap[locale], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export { translateExercise } from './exercises';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Try to restore from localStorage on web
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('workout-log-locale');
      if (saved === 'fi' || saved === 'en') return saved;
    }
    return 'en';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('workout-log-locale', newLocale);
    }
  }, []);

  const value: I18nContextValue = {
    locale,
    t: translations[locale],
    setLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
