'use client';
import { useTranslations } from 'next-intl';
import { LocaleLink, useLanguage } from './language';
import { Button } from './ui/button';
export function Header() {
  const { lang, setLang } = useLanguage();
  const t = useTranslations('site');
  return (
    <header className="site-header">
      <LocaleLink href="/" className="brand">
        {t('name')}
      </LocaleLink>
      <Button
        variant="outline"
        className="language-button"
        onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        aria-label={t('switchLanguage')}
      >
        {t('otherLanguage')}
      </Button>
    </header>
  );
}
export function Footer() {
  const t = useTranslations('site');
  return (
    <footer className="site-footer">
      <p>{t('referenceStatement')}</p>
      <h2>{t('relatedLinks')}</h2>
      <a href="https://www.hypersomniafoundation.org/" target="_blank" rel="noreferrer">
        {t('sourceOrganization')}
      </a>
    </footer>
  );
}
