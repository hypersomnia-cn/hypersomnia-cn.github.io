import LocalizedPage, { generateMetadata as localizedMetadata } from '@/app/[locale]/blog/page';
const params = Promise.resolve({ locale: 'zh' });
export function generateMetadata() {
  return localizedMetadata({ params });
}
export default function Page() {
  return LocalizedPage({ params });
}
