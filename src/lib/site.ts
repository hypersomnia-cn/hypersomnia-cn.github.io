import type { Metadata } from 'next';
import type { Language } from './schema';
import { messages } from '@/i18n/messages';
import { localizedPath, publicPath } from '@/i18n/paths';
const originValue = process.env.SITE_ORIGIN || 'http://127.0.0.1:4173';
const parsedOrigin = new URL(originValue);
if (
  !['http:', 'https:'].includes(parsedOrigin.protocol) ||
  parsedOrigin.username ||
  parsedOrigin.password ||
  parsedOrigin.search ||
  parsedOrigin.hash ||
  parsedOrigin.pathname !== '/'
)
  throw new Error('SITE_ORIGIN must be an HTTP(S) origin without a path, query or credentials');
export const siteOrigin = parsedOrigin.origin;
export function absoluteUrl(path: string): string {
  return new URL(publicPath(path), siteOrigin).href;
}
export function pageMetadata(
  locale: Language,
  path: string,
  title?: string,
  description?: string,
): Metadata {
  const site = messages[locale].site;
  return {
    title: title ? `${title} | ${site.name}` : site.title,
    description: description ?? site.description,
    alternates: {
      canonical: absoluteUrl(localizedPath(locale, path)),
      languages: {
        'zh-CN': absoluteUrl(localizedPath('zh', path)),
        en: absoluteUrl(localizedPath('en', path)),
        'x-default': absoluteUrl(localizedPath('zh', path)),
      },
    },
  };
}
