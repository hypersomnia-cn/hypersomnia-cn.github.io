import type { Language } from '@/lib/schema';
import { isScaleId, type ScaleId } from '@/lib/scale-contracts';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export function withoutBasePath(path: string): string {
  return basePath && (path === basePath || path.startsWith(`${basePath}/`))
    ? path.slice(basePath.length) || '/'
    : path;
}
export function localizedPath(locale: Language, path = '/'): string {
  return `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
}
export function publicPath(path: string): string {
  return `${basePath}${path}`;
}
export function scaleFromPath(path: string): ScaleId | null {
  const match = withoutBasePath(path).match(/^\/(?:zh|en)\/scales\/([^/]+)\/?$/);
  return match && isScaleId(match[1]) ? match[1] : null;
}
