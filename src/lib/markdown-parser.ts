import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkWikiLink from '@flowershow/remark-wiki-link';
import type { Node } from 'unist';
import { toString } from 'mdast-util-to-string';

export function markdownParser() {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkWikiLink, { format: 'regular' });
}

export function markdownText(node: Node): string {
  const item = node as Node & {
    value?: string;
    children?: Node[];
    data?: { alias?: string };
  };
  if (item.type === 'wikiLink') return item.data?.alias ?? item.value ?? '';
  if (item.type === 'html' || item.type === 'yaml' || item.type === 'definition') return '';
  return item.children?.map(markdownText).join('') ?? toString(node, { includeHtml: false });
}

export function plainMarkdown(source: string): string {
  return markdownText(markdownParser().parse(source));
}
