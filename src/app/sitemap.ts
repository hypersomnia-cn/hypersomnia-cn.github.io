import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/messages';
import { localizedPath } from '@/i18n/paths';
import { scaleIds } from '@/lib/scale-contracts';
import { absoluteUrl } from '@/lib/site';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', ...scaleIds.map((id) => `/scales/${id}/`)].flatMap((path) =>
    locales.map((locale) => ({
      url: absoluteUrl(localizedPath(locale, path)),
      alternates: {
        languages: {
          'zh-CN': absoluteUrl(localizedPath('zh', path)),
          en: absoluteUrl(localizedPath('en', path)),
        },
      },
    })),
  );
}
