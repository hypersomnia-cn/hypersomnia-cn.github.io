import { readScales } from '@/lib/content';
import { Home } from '@/components/home';
export default function Page() {
  return <Home scales={readScales()} />;
}
