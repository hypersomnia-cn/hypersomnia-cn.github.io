import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/messages';
import { pageMetadata } from '@/lib/site';
import { Landing } from '@/components/landing';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(locale, '/');
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Landing locale={locale} />;
}
