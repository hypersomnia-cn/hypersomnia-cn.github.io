import { notFound } from 'next/navigation';
import { LanguageProvider, SkipLink } from '@/components/language';
import { Header, Footer } from '@/components/shell';
import { isLocale, locales, localeTags, messages } from '@/i18n/messages';
import '../globals.css';
import { getContentIndex, translationFor } from '@/lib/markdown';
export const dynamicParams = false;
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const index = getContentIndex();
  const translations = Object.fromEntries(
    index.pages
      .filter((page) => page.locale === locale)
      .map((page) => [
        page.route,
        translationFor(index, page, locale === 'zh' ? 'en' : 'zh')?.route ?? null,
      ]),
  );
  return (
    <html lang={localeTags[locale]}>
      <body>
        <LanguageProvider lang={locale} messages={messages[locale]} translations={translations}>
          <SkipLink />
          <Header />
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
