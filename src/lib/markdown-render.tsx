import { unified } from 'unified';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeReact from 'rehype-react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { ReactNode, ComponentProps } from 'react';
import type { Root, Element, ElementContent } from 'hast';
import { visit } from 'unist-util-visit';
import { publicPath } from '../i18n/paths';
import { messages } from '../i18n/messages';
import type { MarkdownSource } from './markdown';

function ArticleLink({ href, ...props }: ComponentProps<'a'>) {
  return (
    <a
      {...props}
      href={href?.startsWith('/') && !href.startsWith('//') ? publicPath(href) : href}
    />
  );
}
function ArticleImage({ src, ...props }: ComponentProps<'img'>) {
  return (
    <img
      {...props}
      alt={props.alt ?? ''}
      src={
        typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')
          ? publicPath(src)
          : src
      }
      loading="lazy"
    />
  );
}
function ArticleTable(props: ComponentProps<'table'>) {
  return (
    <div className="markdown-table">
      <table {...props} />
    </div>
  );
}

export function renderDocument(document: MarkdownSource, inline = false): ReactNode {
  const copy = structuredClone(document.tree);
  const t = messages[document.target.locale].content;
  const processor = unified()
    .use(remarkRehype, {
      clobberPrefix: 'source-',
      footnoteLabel: t.references,
      footnoteLabelProperties: { className: [] },
      footnoteBackLabel: t.backReference,
    })
    .use(() => (tree: Root) => {
      const section = tree.children.find(
        (node): node is Element =>
          node.type === 'element' &&
          node.tagName === 'section' &&
          Boolean(node.properties.dataFootnotes),
      );
      if (section && document.referenceHeading) {
        const at = tree.children.findIndex(
          (node) => node.type === 'element' && node.properties.id === document.referenceHeading!.id,
        );
        if (at >= 0) {
          const intro = tree.children.splice(at, tree.children.indexOf(section) - at);
          const title = intro.shift();
          if (title?.type === 'element') {
            title.properties.id = 'footnote-label';
            section.children.splice(
              0,
              1,
              title,
              ...intro.filter((node): node is ElementContent => node.type !== 'doctype'),
            );
            const anchor: Element = {
              type: 'element',
              tagName: 'span',
              properties: { id: document.referenceHeading.id },
              children: [],
            };
            section.children.unshift(anchor);
          }
        }
      }
      visit(tree, 'element', (node) => {
        if (
          node.tagName === 'img' &&
          typeof node.properties.src === 'string' &&
          !/^(?:https?:|\/\/|\/)/i.test(node.properties.src)
        ) {
          throw new Error(
            `${document.file}: local images must use a public-root path such as /images/example.png`,
          );
        }
      });
      if (inline)
        tree.children = tree.children.flatMap((node) =>
          node.type === 'element' && node.tagName === 'p' ? node.children : [node],
        );
    })
    .use(rehypeSanitize, {
      ...defaultSchema,
      clobberPrefix: '',
      attributes: {
        ...defaultSchema.attributes,
        '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id'],
        a: [...(defaultSchema.attributes?.a ?? []), 'hrefLang'],
      },
    })
    .use(rehypeReact, {
      Fragment,
      jsx,
      jsxs,
      components: { a: ArticleLink, img: ArticleImage, table: ArticleTable },
    });
  // The AST contains generated prefixed IDs only; raw HTML is never parsed.
  const file = processor.runSync(copy);
  return processor.stringify(file) as ReactNode;
}
