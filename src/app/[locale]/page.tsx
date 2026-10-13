import { notFound } from 'next/navigation';
import { readScaleSummaries } from '@/lib/content';
import { Home } from '@/components/home';
import { isLocale } from '@/i18n/messages';
import { pageMetadata } from '@/lib/site';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(locale, '/');
}
export default function Page() {
  return <Home scales={readScaleSummaries()} />;
}
