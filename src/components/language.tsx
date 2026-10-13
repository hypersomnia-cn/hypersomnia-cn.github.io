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
export function LanguageProvider({
  children,
  lang,
  messages: localeMessages,
}: {
  children: React.ReactNode;
  lang: Language;
  messages: (typeof messages)[Language];
}) {
  const pathname = usePathname();
  useEffect(() => {
    activateAssessmentRoute(scaleFromPath(pathname));
    document.documentElement.lang = localeTags[lang];
  }, [pathname, lang]);
  return (
    <Context.Provider value={lang}>
      <NextIntlClientProvider locale={lang} messages={localeMessages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </Context.Provider>
  );
}
export function useLanguage() {
  const lang = useContext(Context);
  const pathname = usePathname();
  const router = useRouter();
  const setLang = (next: Language) => {
    const path = withoutBasePath(pathname).replace(/^\/(zh|en)(?=\/|$)/, '') || '/';
    router.push(localizedPath(next, path), { scroll: false });
  };
  return { lang, setLang };
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
