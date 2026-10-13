'use client';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import type { Language } from '@/lib/schema';
import { isLocale, localeTags, messages } from '@/i18n/messages';
const Context = createContext<{ lang: Language; setLang: (lang: Language) => void }>({
  lang: 'zh',
  setLang: () => {},
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, updateLang] = useState<Language>('zh');
  useEffect(() => {
    const readLocale = () => {
      const candidate = new URL(window.location.href).searchParams.get('lang');
      updateLang(isLocale(candidate) ? candidate : 'zh');
    };
    readLocale();
    window.addEventListener('popstate', readLocale);
    return () => window.removeEventListener('popstate', readLocale);
  }, []);
  const setLang = (locale: Language) => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', locale);
    window.history.replaceState(window.history.state, '', url);
    updateLang(locale);
  };
  useEffect(() => {
    document.documentElement.lang = localeTags[lang];
  }, [lang]);
  return (
    <Context.Provider value={{ lang, setLang }}>
      <NextIntlClientProvider locale={lang} messages={messages[lang]} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
export function LocaleLink({
  href,
  ...props
}: Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const { lang } = useLanguage();
  const [path, hash] = href.split('#');
  const localized = `${path}${path.includes('?') ? '&' : '?'}lang=${lang}${hash ? `#${hash}` : ''}`;
  return <Link href={localized} {...props} />;
}
export function PageMetadata({ title, description }: { title?: string; description?: string }) {
  const t = useTranslations('site');
  return (
    <>
      <title>{title ? `${title} | ${t('name')}` : t('title')}</title>
      <meta name="description" content={description ?? t('description')} />
    </>
  );
}
export function SkipLink() {
  const t = useTranslations('site');
  return (
    <a className="skip-link" href="#main">
      {t('skip')}
    </a>
  );
}
