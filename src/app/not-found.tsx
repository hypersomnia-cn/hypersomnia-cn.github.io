'use client';
import { useTranslations } from 'next-intl';
import { LocaleLink, PageMetadata } from '@/components/language';
export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <main id="main" className="assessment-main">
      <PageMetadata title={t('title')} description={t('description')} />
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <LocaleLink href="/">{t('home')}</LocaleLink>
    </main>
  );
}
