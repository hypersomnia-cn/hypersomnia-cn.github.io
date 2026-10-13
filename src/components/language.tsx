'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import type { Language } from '@/lib/schema';
import type { messages } from '@/i18n/messages';
import { localeTags } from '@/i18n/messages';
import { localizedPath, withoutBasePath, scaleFromPath } from '@/i18n/paths';
import { activateAssessmentRoute } from '@/lib/assessment-draft';
const Context = createContext<Language>('zh');
const TranslationContext = createContext<Record<string, string | null>>({});
export function LanguageProvider({
  children,
  lang,
  messages: localeMessages,
  translations = {},
}: {
  children: React.ReactNode;
  lang: Language;
  messages: (typeof messages)[Language];
  translations?: Record<string, string | null>;
}) {
  const pathname = usePathname();
  useEffect(() => {
    activateAssessmentRoute(scaleFromPath(pathname));
    document.documentElement.lang = localeTags[lang];
  }, [pathname, lang]);
  return (
    <Context.Provider value={lang}>
      <TranslationContext.Provider value={translations}>
        <NextIntlClientProvider locale={lang} messages={localeMessages} timeZone="UTC">
          {children}
        </NextIntlClientProvider>
      </TranslationContext.Provider>
    </Context.Provider>
  );
}
export function useLanguage() {
  const lang = useContext(Context);
  const pathname = usePathname();
  const router = useRouter();
  const translations = useContext(TranslationContext);
  const route = `${withoutBasePath(pathname).replace(/\/$/, '')}/`;
  const alternate = translations[route];
  const translationMissing = alternate === null;
  const collection = route.match(/^\/(zh|en)\/(wiki|blog)\//)?.[2];
  const otherCollection = collection
    ? localizedPath(lang === 'zh' ? 'en' : 'zh', `/${collection}/`)
    : null;
  const setLang = (next: Language) => {
    if (translationMissing) return;
    const path = withoutBasePath(pathname).replace(/^\/(zh|en)(?=\/|$)/, '') || '/';
    router.push(alternate ?? localizedPath(next, path), { scroll: false });
  };
  return { lang, setLang, translationMissing, otherCollection };
}
export function LocaleLink({
  href,
  ...props
}: Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const { lang } = useLanguage();
  return <Link href={localizedPath(lang, href)} {...props} prefetch={false} />;
}
export function SkipLink() {
  const t = useTranslations('site');
  return (
    <a className="skip-link" href="#main">
      {t('skip')}
    </a>
  );
}
