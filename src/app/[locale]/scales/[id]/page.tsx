import { notFound } from 'next/navigation';
import { readScale } from '@/lib/content';
import { scaleIds, isScaleId } from '@/lib/scale-contracts';
import { isLocale } from '@/i18n/messages';
import { pageMetadata } from '@/lib/site';
import { Assessment } from '@/components/assessment';
import { getContentIndex } from '@/lib/markdown';
import { renderDocument } from '@/lib/markdown-render';
export const dynamicParams = false;
export function generateStaticParams() {
  return scaleIds.map((id) => ({ id }));
}
type Props = { params: Promise<{ locale: string; id: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !isScaleId(id)) notFound();
  const scale = readScale(id);
  return pageMetadata(locale, `/scales/${id}/`, scale.title[locale], scale.description[locale]);
}
export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !isScaleId(id)) notFound();
  const index = getContentIndex();
  const backlinks = index.backlinks.get(`scales:${id}:${locale}`) ?? [];
  return (
    <Assessment
      key={id}
      scale={readScale(id)}
      description={renderDocument(index.fragments.get(`scales:${id}:${locale}/${id}`)!, true)}
      backlinks={backlinks.map(({ key, title, route, locale }) => ({ key, title, route, locale }))}
    />
  );
}
