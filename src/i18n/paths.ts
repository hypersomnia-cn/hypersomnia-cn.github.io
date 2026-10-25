import type { Language } from '@/lib/schema';
import { scaleIdPattern, type ScaleId } from '@/lib/scale-id';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export function withoutBasePath(path: string): string {
  return basePath && (path === basePath || path.startsWith(`${basePath}/`))
    ? path.slice(basePath.length) || '/'
    : path;
}
export function localizedPath(locale: Language, path = '/'): string {
  const route = path.startsWith('/') ? path : `/${path}`;
  return locale === 'zh' ? route : `/en${route}`;
}
export function publicPath(path: string): string {
  return `${basePath}${path}`;
}
export function scaleFromPath(path: string): ScaleId | null {
  const match = withoutBasePath(path).match(/^\/(?:(?:zh|en)\/)?scales\/([^/]+)\/?$/);
  return match && scaleIdPattern.test(match[1]) ? match[1] : null;
}
