import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';
import { getContentIndex } from '@/lib/markdown';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  const index = getContentIndex();
  return index.pages.map((page) => ({
    url: absoluteUrl(page.route),
    alternates: {
      languages: {
        ...Object.fromEntries(
          (index.translations.get(page.identity) ?? []).map((version) => [
            version.locale === 'zh' ? 'zh-CN' : 'en',
            absoluteUrl(version.route),
          ]),
        ),
      },
    },
  }));
}
