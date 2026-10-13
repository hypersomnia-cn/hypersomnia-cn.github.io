import { LanguageProvider, SkipLink } from '@/components/language';
import { Header, Footer } from '@/components/shell';
import './globals.css';
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <LanguageProvider>
          <SkipLink />
          <Header />
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
