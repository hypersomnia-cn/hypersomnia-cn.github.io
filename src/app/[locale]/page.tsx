import { notFound } from 'next/navigation';
import { readScaleSummaries } from '@/lib/content';
import { Home } from '@/components/home';
import { isLocale } from '@/i18n/messages';
import { pageMetadata } from '@/lib/site';
import { getContentIndex } from '@/lib/markdown';
import { renderDocument } from '@/lib/markdown-render';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(locale, '/');
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const scales = readScaleSummaries();
  const index = getContentIndex();
  const descriptions = Object.fromEntries(
    scales.map((scale) => [
      scale.id,
      renderDocument(index.fragments.get(`page:home:${locale}/${scale.id}`)!, true),
    ]),
  );
  return <Home scales={scales} descriptions={descriptions} />;
}
