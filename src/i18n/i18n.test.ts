// FND-SET-01 / FR-I18N-05 — locale resolution, fallback, plurals and the
// no-code-change path for adding a language.

import { addLanguage, i18n, initI18n, resolveLocale, t } from './index';
import { en } from './en';

describe('resolveLocale', () => {
  it.each([
    ['en', 'en'],
    ['en-IN', 'en'],
    ['en_GB', 'en'],
    ['EN-us', 'en'],
    ['ta-IN', 'en'], // unsupported → English fallback
    ['fr', 'en'],
    [null, 'en'],
    [undefined, 'en'],
    ['', 'en'],
  ])('%s resolves to %s', (tag, want) => {
    expect(resolveLocale(tag)).toBe(want);
  });
});

describe('bundle', () => {
  beforeAll(() => initI18n('en-IN'));

  it('falls back to English for a regional variant', () => {
    expect(i18n.language).toBe('en');
    expect(t('common.done')).toBe('Done');
  });

  it('pluralises count keys', () => {
    expect(t('conflict.vehicle', { count: 1 })).toBe('1 vehicle');
    expect(t('conflict.vehicle', { count: 4 })).toBe('4 vehicles');
  });

  it('interpolates values', () => {
    expect(t('conflict.body', { vehicles: '2 vehicles', entries: '9 entries' })).toContain('2 vehicles');
  });

  it('adding a language needs no app-code change (NFR-13)', () => {
    addLanguage('ta', { ...en, common: { ...en.common, done: 'முடிந்தது' } });
    void i18n.changeLanguage('ta');
    expect(t('common.done')).toBe('முடிந்தது');
    expect(t('welcome.title')).toBe(en.welcome.title); // untranslated keys fall back
    void i18n.changeLanguage('en');
  });
});
