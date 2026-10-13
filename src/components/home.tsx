'use client';
import { useTranslations } from 'next-intl';
import { LocaleLink, useLanguage } from './language';
import type { ScaleSummary } from '@/lib/schema';
import type { ReactNode } from 'react';
export function Home({
  scales,
  descriptions,
}: {
  scales: ScaleSummary[];
  descriptions: Record<string, ReactNode>;
}) {
  const { lang } = useLanguage();
  const t = useTranslations('site');
  return (
    <main id="main" className="home-main">
      <section className="home-heading">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </section>
      <section id="scales" className="scale-section" aria-label={t('title')}>
        <div className="scale-grid">
          {scales.map((s) => (
            <article className={`scale-card card-${s.id}`} key={s.id}>
              <h2>
                <LocaleLink className="card-link" href={`/scales/${s.id}/`}>
                  {t('scaleTitle', { name: s.title[lang], abbreviation: s.abbreviation })}
                </LocaleLink>
              </h2>
              <p className="card-description">{descriptions[s.id] ?? s.description[lang]}</p>
              <div className="card-meta">
                <span>{t('estimatedTime', { value: s.duration[lang] })}</span>
                <span>{t('items', { count: s.itemCount })}</span>
              </div>
              <a className="card-source" href={s.source.url} target="_blank" rel="noreferrer">
                {t('referenceSource')}
                <span aria-hidden="true"> ↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
