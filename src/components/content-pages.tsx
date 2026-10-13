import Link from 'next/link';
import { messages } from '@/i18n/messages';
import type { Language } from '@/lib/schema';
import type { ContentKind } from '@/lib/markdown-schema';
import { contentDocuments, getContentIndex, type ContentDocument } from '@/lib/markdown';
import { renderDocument } from '@/lib/markdown-render';

export function Backlinks({ pageKey, locale }: { pageKey: string; locale: Language }) {
  const links = getContentIndex().backlinks.get(pageKey) ?? [];
  if (!links.length) return null;
  return (
    <aside className="content-backlinks" aria-label={messages[locale].content.backlinks}>
      <h2>{messages[locale].content.backlinks}</h2>
      <ul>
        {links.map((target) => (
          <li key={target.key}>
            <Link href={target.route} prefetch={false}>
              {target.title}
              {target.locale !== locale ? ` (${target.locale === 'zh' ? '中文' : 'English'})` : ''}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function ContentList({ kind, locale }: { kind: ContentKind; locale: Language }) {
  const documents = contentDocuments(kind, locale);
  const t = messages[locale].content;
  return (
    <main id="main" className="content-page">
      <h1>{t[kind]}</h1>
      {!documents.length && <p>{t.empty}</p>}
      <ul className="content-list">
        {documents.map(({ metadata, target }) => (
          <li key={target.key}>
            <h2>
              <Link href={target.route} prefetch={false}>
                {metadata.title}
              </Link>
            </h2>
            <p>{metadata.description}</p>
            <p className="content-meta">
              {kind === 'blog' ? t.published : t.updated}{' '}
              <time dateTime={kind === 'blog' ? metadata.published : metadata.updated}>
                {kind === 'blog' ? metadata.published : metadata.updated}
              </time>
            </p>
            <Tags tags={metadata.tags} />
          </li>
        ))}
      </ul>
      <Backlinks pageKey={`page:${kind}:${locale}`} locale={locale} />
    </main>
  );
}
function Tags({ tags }: { tags: string[] }) {
  return tags.length ? (
    <ul className="content-tags">
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  ) : null;
}
export function ContentArticle({ document }: { document: ContentDocument }) {
  const { metadata, target, kind } = document;
  const t = messages[target.locale].content;
  const headings = target.headings.filter(({ depth }) => depth === 2 || depth === 3);
  return (
    <main id="main" className="content-page">
      <Link href={`/${target.locale}/${kind}/`} prefetch={false}>
        {t[kind]}
      </Link>
      <article>
        <header className="content-title">
          <h1>{metadata.title}</h1>
          {metadata.english_title && (
            <p>
              {metadata.english_title}
              {metadata.abbreviation ? ` (${metadata.abbreviation})` : ''}
            </p>
          )}
          <p>{metadata.description}</p>
          <div className="content-meta">
            {metadata.published && (
              <p>
                {t.published} <time dateTime={metadata.published}>{metadata.published}</time>
              </p>
            )}
            <p>
              {t.updated} <time dateTime={metadata.updated}>{metadata.updated}</time>
            </p>
            {metadata.authors.length > 0 && (
              <p>
                {t.authors}: {metadata.authors.join(', ')}
              </p>
            )}
          </div>
          <Tags tags={metadata.tags} />
          {metadata.primary_reference && (
            <p>
              <a href={metadata.primary_reference}>{t.primaryReference}</a>
            </p>
          )}
        </header>
        {headings.length > 0 && (
          <nav className="content-toc" aria-label={t.toc}>
            <h2>{t.toc}</h2>
            <ul>
              {headings.map((heading) => (
                <li className={`toc-depth-${heading.depth}`} key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="markdown-body">{renderDocument(document)}</div>
      </article>
      <Backlinks pageKey={target.key} locale={target.locale} />
    </main>
  );
}
