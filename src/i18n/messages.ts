import zh from '../../messages/zh.json';
import en from '../../messages/en.json';
import type { Language } from '@/lib/schema';
export const messages = { zh, en };
export const locales: Language[] = ['zh', 'en'];
export const localeTags = { zh: 'zh-CN', en: 'en' };
export function isLocale(value: string | null): value is Language {
  return value === 'zh' || value === 'en';
}
declare module 'next-intl' {
  interface AppConfig {
    Locale: Language;
    Messages: typeof zh;
  }
}
