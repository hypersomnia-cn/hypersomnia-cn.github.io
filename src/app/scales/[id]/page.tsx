import { notFound } from 'next/navigation';
import { readScale, scaleIds } from '@/lib/content';
import { Assessment } from '@/components/assessment';
export const dynamicParams = false;
export function generateStaticParams() {
  return scaleIds.map((id) => ({ id }));
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!scaleIds.includes(id as (typeof scaleIds)[number])) notFound();
  return <Assessment key={id} scale={readScale(id)} />;
}
