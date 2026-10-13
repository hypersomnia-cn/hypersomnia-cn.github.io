import { messages } from '@/i18n/messages';
import { publicPath } from '@/i18n/paths';
import './globals.css';
export const metadata = {
  title: `${messages.zh.notFound.title} | ${messages.en.notFound.title}`,
};
export default function NotFound() {
  return (
    <html lang="zh-CN">
      <body>
        <main id="main" className="assessment-main">
          <h1>{messages.zh.notFound.title}</h1>
          <p>{messages.zh.notFound.description}</p>
          <section lang="en">
            <h2>{messages.en.notFound.title}</h2>
            <p>{messages.en.notFound.description}</p>
          </section>
          <nav className="result-actions" aria-label="首页 / Home">
            <a href={publicPath('/zh/')} className="button button-primary">
              {messages.zh.notFound.home}
            </a>
            <a href={publicPath('/en/')} className="button button-outline" lang="en">
              {messages.en.notFound.home}
            </a>
          </nav>
        </main>
      </body>
    </html>
  );
}
