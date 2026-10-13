// Keep the root shared across locales so changing language does not reload the document.
// The locale and entry layouts provide the statically rendered html/body elements.
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
