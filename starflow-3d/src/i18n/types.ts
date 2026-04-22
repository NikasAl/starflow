// ============================================================
// Star Flow Command — i18n Types
// ============================================================

export type Locale = 'en' | 'ru' | 'es';

/** Recursive translation map — keys are dot-accessible */
export type TranslationMap = {
  [key: string]: string | TranslationMap;
};

/** Plural form suffix */
export type PluralForm = 'one' | 'few' | 'many' | 'other';
