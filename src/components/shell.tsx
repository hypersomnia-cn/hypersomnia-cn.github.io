'use client';
import { useTranslations } from 'next-intl';
import { LocaleLink, useLanguage } from './language';
import { Button } from './ui/button';
import Link from 'next/link';
export function Header() {
  const { lang, setLang, translationMissing, otherCollection } = useLanguage();
  const t = useTranslations('site');
  const content = useTranslations('content');
  return (
    <header className="site-header">
      <LocaleLink href="/" className="brand">
        {t('name')}
      </LocaleLink>
      <nav className="header-nav" aria-label={lang === 'zh' ? '网站导航' : 'Site navigation'}>
        <LocaleLink href="/wiki/">{content('wiki')}</LocaleLink>
        <LocaleLink href="/blog/">{content('blog')}</LocaleLink>
      </nav>
      <div className="language-control">
        <Button
          variant="outline"
          className="language-button"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          aria-label={t('switchLanguage')}
          disabled={translationMissing}
        >
          {t('otherLanguage')}
        </Button>
        {translationMissing && (
          <p className="translation-notice">
            {content('missingTranslation')}
            {otherCollection && (
              <>
                {' '}
                ·{' '}
                <Link href={otherCollection} prefetch={false}>
                  {content('otherCollection')}
                </Link>
              </>
            )}
          </p>
        )}
      </div>
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
