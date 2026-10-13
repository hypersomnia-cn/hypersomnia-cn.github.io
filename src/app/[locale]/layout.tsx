import { notFound } from 'next/navigation';
import { LanguageProvider, SkipLink } from '@/components/language';
import { Header, Footer } from '@/components/shell';
import { isLocale, locales, localeTags, messages } from '@/i18n/messages';
import '../globals.css';
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
  return (
    <html lang={localeTags[locale]}>
      <body>
        <LanguageProvider lang={locale} messages={messages[locale]}>
          <SkipLink />
          <Header />
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
