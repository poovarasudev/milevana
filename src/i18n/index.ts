// i18next scaffolding (FND-SET-01): English-only bundle, device-language
// detection with English fallback (FR-I18N-05), plural forms via i18next's
// built-in `count` handling, and a `t` that is usable both inside and outside
// React (react-i18next re-exports the same `t`).

import i18n, {
  TFunction, changeLanguage, init as initI18next, t as i18nextT, use as registerPlugin,
} from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, EnglishBundle } from './en';

export const SUPPORTED_LOCALES = ['en'] as const;
export const DEFAULT_LOCALE = 'en';

/** Resolve an arbitrary BCP-47 tag to a supported locale (FR-I18N-05). */
export function resolveLocale(tag: string | null | undefined): string {
  if (!tag) return DEFAULT_LOCALE;
  const base = tag.split(/[-_]/)[0]?.toLowerCase() ?? '';
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? base : DEFAULT_LOCALE;
}

/**
 * Best-effort device language. expo-localization is only available in a real
 * runtime, so it is imported lazily; tests inject a language instead.
 */
export function deviceLanguage(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loc = require('expo-localization');
    const tags: string[] = loc?.getLocales?.().map((l: { languageTag?: string }) => l.languageTag) ?? [];
    return resolveLocale(tags[0]);
  } catch {
    return DEFAULT_LOCALE;
  }
}

let initialised = false;

/** Idempotent, synchronous init — safe to call from app bootstrap and tests. */
export function initI18n(language: string = deviceLanguage()): typeof i18n {
  if (!initialised) {
    registerPlugin(initReactI18next);
    void initI18next({
      resources: { en: { translation: en } },
      lng: resolveLocale(language),
      fallbackLng: DEFAULT_LOCALE,
      interpolation: { escapeValue: false },
      returnNull: false,
      compatibilityJSON: 'v4',
    });
    initialised = true;
  } else if (i18n.language !== resolveLocale(language)) {
    void changeLanguage(resolveLocale(language));
  }
  return i18n;
}

/** Register another language at runtime — used by tests and future locales. */
export function addLanguage(code: string, bundle: EnglishBundle): void {
  initI18n();
  i18n.addResourceBundle(code, 'translation', bundle, true, true);
}

/** t() usable outside React; bound to the shared i18next instance. */
export const t = i18nextT as TFunction;

export { i18n };
export { useTranslation } from 'react-i18next';
