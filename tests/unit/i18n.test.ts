import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { messages, isLocale } from '../../src/i18n/messages';
import { readScale } from '../../src/lib/content';
import { validateAnswers } from '../../src/lib/scoring';
import { localizedPath, scaleFromPath } from '../../src/i18n/paths';
describe('localization', () => {
  it('uses Chinese at the root and recognizes both current and legacy scale routes', () => {
    expect(localizedPath('zh')).toBe('/');
    expect(localizedPath('zh', '/scales/')).toBe('/scales/');
    expect(localizedPath('en', '/scales/')).toBe('/en/scales/');
    for (const route of ['/scales/ess/', '/zh/scales/ess/', '/en/scales/ess/'])
      expect(scaleFromPath(route)).toBe('ess');
    expect(scaleFromPath('/scales/')).toBeNull();
  });
  it('supports ICU item counts and translated scale titles', () => {
    const en = createTranslator({ locale: 'en', messages: messages.en, namespace: 'site' });
    const zh = createTranslator({ locale: 'zh', messages: messages.zh, namespace: 'site' });
    expect(en('items', { count: 1 })).toBe('1 self-rated item');
    expect(en('items', { count: 8 })).toBe('8 self-rated items');
    expect(zh('scaleTitle', { name: '特发性睡眠增多严重程度量表', abbreviation: 'IHSS' })).toBe(
      '特发性睡眠增多严重程度量表（IHSS）',
    );
  });
  it('keeps validation language independent and translates codes in the UI', () => {
    const code = validateAnswers(readScale('ess'), {}).q1;
    expect(code).toBe('invalid');
    const t = createTranslator({ locale: 'en', messages: messages.en, namespace: 'assessment' });
    expect(t(code)).toBe('Please provide a valid answer.');
  });
  it('accepts only configured locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('zh')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
