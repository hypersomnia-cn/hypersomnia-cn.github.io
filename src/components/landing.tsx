import Link from 'next/link';
import type { Language } from '@/lib/schema';
import { messages } from '@/i18n/messages';
import { localizedPath } from '@/i18n/paths';
import { contentDocuments } from '@/lib/markdown';

export function Landing({ locale }: { locale: Language }) {
  const { site, content } = messages[locale];
  const sections = [
    { id: 'scales', title: site.scales, description: site.scalesDescription },
    { id: 'blog', title: content.blog, description: site.blogDescription },
    { id: 'wiki', title: content.wiki, description: site.wikiDescription },
  ] as const;
  return (
    <main id="main" className="home-main">
      <section className="home-heading">
        <h1>{site.title}</h1>
        <p>{site.description}</p>
      </section>
      <div className="collection-grid">
        {sections.map(({ id, title, description }) => {
          const count = id === 'scales' ? null : contentDocuments(id, locale).length;
          return (
            <section className="scale-card collection-card" key={id}>
              <h2>
                <Link
                  className="card-link"
                  href={localizedPath(locale, `/${id}/`)}
                  prefetch={false}
                >
                  {title}
                </Link>
              </h2>
              <p className="card-description">{description}</p>
              {count !== null && (
                <p className="collection-status">
                  {count === 0
                    ? content.empty
                    : locale === 'zh'
                      ? `已发布 ${count} 篇文章`
                      : `${count} published ${count === 1 ? 'article' : 'articles'}`}
                </p>
              )}
              <span className="collection-action" aria-hidden="true">
                {site.browse} →
              </span>
            </section>
          );
        })}
      </div>
    </main>
  );
}
