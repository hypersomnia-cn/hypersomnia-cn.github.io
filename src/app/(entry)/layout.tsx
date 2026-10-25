import LocalizedLayout from '../[locale]/layout';
export default function Layout({ children }: { children: React.ReactNode }) {
  return LocalizedLayout({ children, params: Promise.resolve({ locale: 'zh' }) });
}
