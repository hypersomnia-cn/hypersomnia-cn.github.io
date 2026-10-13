import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/messages';
import { ContentList } from '@/components/content-pages';
import { contentPageMetadata, getContentIndex } from '@/lib/markdown';
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return contentPageMetadata(
    getContentIndex().pages.find((page) => page.key === `page:blog:${locale}`)!,
  );
}
export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ContentList kind="blog" locale={locale} />;
}
