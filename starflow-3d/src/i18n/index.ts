// ============================================================
// Star Flow Command — Lightweight i18n System
// ============================================================

import { type Locale, type TranslationMap, type PluralForm } from './types';

// Import all locale dictionaries statically (Vite bundles them)
import enDict from './locales/en.json';
import ruDict from './locales/ru.json';
import esDict from './locales/es.json';

const dictionaries: Record<Locale, TranslationMap> = {
  en: enDict as TranslationMap,
  ru: ruDict as TranslationMap,
  es: esDict as TranslationMap,
};

/** All supported locales */
export const SUPPORTED_LOCALES: Locale[] = ['en', 'ru', 'es'];

/** Display names for language selector UI */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
  es: 'Espa\u00f1ol',
};

/** localStorage key for persisting language choice */
const STORAGE_KEY = 'starflow-locale';

// ============================================================
// Resolve a dot-notation key from a nested object
// ============================================================

function resolve(obj: TranslationMap | string | undefined, key: string): string | undefined {
  if (typeof obj === 'string') return undefined;
  if (!obj) return undefined;
  const parts = key.split('.');
  let current: string | TranslationMap | undefined = obj;
  for (const part of parts) {
    if (typeof current === 'string' || !current) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

// ============================================================
// Plural forms
// ============================================================

/** Get plural form suffix for a given locale and count */
function getPluralForm(locale: Locale, count: number): PluralForm {
  const abs = Math.abs(count);
  const lastDigit = abs % 10;
  const lastTwo = abs % 100;

  switch (locale) {
    case 'ru':
      // Russian: 1 = one, 2-4 (not 12-14) = few, else = many
      if (lastTwo > 10 && lastTwo < 20) return 'many';
      if (lastDigit > 1 && lastDigit < 5) return 'few';
      if (lastDigit === 1) return 'one';
      return 'many';

    case 'es':
      // Spanish: same as English
      return abs === 1 ? 'one' : 'other';

    case 'en':
    default:
      return abs === 1 ? 'one' : 'other';
  }
}

// ============================================================
// I18n class
// ============================================================

class I18n {
  private _locale: Locale = 'en';
  private listeners: Array<() => void> = [];

  constructor() {
    this._locale = this.detectLocale();
  }

  /** Detect locale from localStorage or navigator */
  private detectLocale(): Locale {
    // 1. Check localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && this.isValidLocale(stored)) {
        return stored as Locale;
      }
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }

    // 2. Check navigator.language
    try {
      const nav = navigator.language || '';
      const code = nav.split('-')[0].toLowerCase();
      if (this.isValidLocale(code)) return code as Locale;
    } catch {
      // navigator unavailable
    }

    // 3. Fallback
    return 'en';
  }

  private isValidLocale(code: string): boolean {
    return (SUPPORTED_LOCALES as string[]).includes(code);
  }

  /** Get current locale */
  getLocale(): Locale {
    return this._locale;
  }

  /** Set locale, persist, and notify listeners */
  setLocale(locale: Locale): void {
    if (!this.isValidLocale(locale)) return;
    this._locale = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore
    }
    this.listeners.forEach(fn => fn());
  }

  /**
   * Translate a key with optional interpolation.
   * @param key - Dot-notation key, e.g. 'hud.victory'
   * @param params - Variables to interpolate, e.g. { level: 3, name: 'Mars' }
   * @returns Translated string, or the key itself if not found
   */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = dictionaries[this._locale];
    let text = resolve(dict, key);

    // Fallback to English if translation missing
    if (text === undefined && this._locale !== 'en') {
      text = resolve(dictionaries.en, key);
    }

    // Last resort: return key
    if (text === undefined) return key;

    // Interpolate {variable} placeholders
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return text;
  }

  /**
   * Translate with plural form support.
   * Looks for key + '_' + pluralForm (e.g. 'hud.stars_many').
   * Falls back to key + '_other', then plain key.
   *
   * @param key - Base key, e.g. 'hud.stars'
   * @param count - Number determining plural form
   * @param params - Additional interpolation variables
   */
  tp(key: string, count: number, params?: Record<string, string | number>): string {
    const form = getPluralForm(this._locale, count);
    const mergedParams = { count, ...params };

    // Try exact plural form first
    let text = resolve(dictionaries[this._locale], `${key}_${form}`);

    // Fallback to English plural form
    if (text === undefined && this._locale !== 'en') {
      text = resolve(dictionaries.en, `${key}_${form}`);
    }

    // Fallback to _other
    if (text === undefined) {
      text = resolve(dictionaries[this._locale], `${key}_other`);
      if (text === undefined && this._locale !== 'en') {
        text = resolve(dictionaries.en, `${key}_other`);
      }
    }

    // Fallback to plain key
    if (text === undefined) {
      text = resolve(dictionaries[this._locale], key);
      if (text === undefined && this._locale !== 'en') {
        text = resolve(dictionaries.en, key);
      }
    }

    // Last resort
    if (text === undefined) return key;

    // Interpolate
    for (const [k, v] of Object.entries(mergedParams)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }

    return text;
  }

  /** Subscribe to locale changes. Returns unsubscribe function. */
  onChange(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
}

/** Global i18n instance */
export const i18n = new I18n();
