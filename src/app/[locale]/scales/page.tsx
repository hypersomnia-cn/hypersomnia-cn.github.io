import { notFound } from 'next/navigation';
import { readScaleSummaries } from '@/lib/content';
import { ScaleHome } from '@/components/home';
import { isLocale, messages } from '@/i18n/messages';
import { pageMetadata } from '@/lib/site';
import { getContentIndex } from '@/lib/markdown';
import { renderDocument } from '@/lib/markdown-render';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(
    locale,
    '/scales/',
    messages[locale].site.scales,
    messages[locale].site.scalesDescription,
  );
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const scales = readScaleSummaries();
  const index = getContentIndex();
  const descriptions = Object.fromEntries(
    scales.map((scale) => [
      scale.id,
      renderDocument(index.fragments.get(`page:scales:${locale}/${scale.id}`)!, true),
    ]),
  );
  return <ScaleHome scales={scales} descriptions={descriptions} />;
}
