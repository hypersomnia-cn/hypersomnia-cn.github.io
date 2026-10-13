import Link from 'next/link';
import { messages } from '@/i18n/messages';
import { absoluteUrl } from '@/lib/site';
export const metadata = {
  title: `${messages.zh.site.title} | ${messages.en.site.title}`,
  alternates: { canonical: absoluteUrl('/') },
};
export default function Page() {
  return (
    <main id="main" className="home-main">
      <section className="home-heading">
        <h1>{messages.zh.site.title}</h1>
        <p lang="en">{messages.en.site.title}</p>
      </section>
      <nav className="result-actions" aria-label="语言 / Language">
        <Link href="/zh/" className="button button-primary" lang="zh-CN" prefetch={false}>
          中文
        </Link>
        <Link href="/en/" className="button button-outline" lang="en" prefetch={false}>
          English
        </Link>
      </nav>
    </main>
  );
}
