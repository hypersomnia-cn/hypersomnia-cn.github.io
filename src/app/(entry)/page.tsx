import { Landing } from '@/components/landing';
import { pageMetadata } from '@/lib/site';
export const metadata = pageMetadata('zh', '/');
export default function Page() {
  return <Landing locale="zh" />;
}
