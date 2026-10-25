import LocalizedPage, {
  generateMetadata as localizedMetadata,
  generateStaticParams as localizedParams,
} from '@/app/[locale]/scales/[id]/page';
export const dynamicParams = false;
export function generateStaticParams() {
  return localizedParams();
}
type Props = { params: Promise<{ id: string }> };
const withLocale = async (params: Props['params']) => ({ ...(await params), locale: 'zh' });
export function generateMetadata({ params }: Props) {
  return localizedMetadata({ params: withLocale(params) });
}
export default function Page({ params }: Props) {
  return LocalizedPage({ params: withLocale(params) });
}
