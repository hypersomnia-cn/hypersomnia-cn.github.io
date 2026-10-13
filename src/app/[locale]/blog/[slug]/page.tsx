import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/messages';
import { ContentArticle } from '@/components/content-pages';
import { contentDocuments, contentPageMetadata } from '@/lib/markdown';
export const dynamicParams = false;
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const entries = isLocale(params.locale)
    ? contentDocuments('blog', params.locale).map(({ metadata }) => ({ slug: metadata.slug }))
    : [];
  return entries.length ? entries : [{ slug: '__empty__' }];
}
type Props = { params: Promise<{ locale: string; slug: string }> };
async function findDocument(params: Props['params']) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const document = contentDocuments('blog', locale).find(({ metadata }) => metadata.slug === slug);
  if (!document) notFound();
  return document;
}
export async function generateMetadata({ params }: Props) {
  const document = await findDocument(params);
  return contentPageMetadata(document.target, document.metadata.description);
}
export default async function Page({ params }: Props) {
  return <ContentArticle document={await findDocument(params)} />;
}
