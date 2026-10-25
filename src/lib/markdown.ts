import fs from 'node:fs';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { markdownParser, markdownText as toString } from './markdown-parser';
export { markdownParser } from './markdown-parser';
import { visit, SKIP } from 'unist-util-visit';
import { parseDocument } from 'yaml';
import type { Root, Definition } from 'mdast';
import type { Node } from 'unist';
import type { Metadata } from 'next';
import {
  contentKinds,
  contentMetadataSchema,
  type ContentKind,
  type ContentMetadata,
} from './markdown-schema';
import { readScales, readScaleIds } from './content';
import { contentPath, contentRoot } from './content-root';
import type { Language } from './schema';
import { locales, messages } from '../i18n/messages';
import { localizedPath, withoutBasePath } from '../i18n/paths';
import { absoluteUrl } from './site';

export type ContentNode = Node & {
  type: string;
  value?: string;
  depth?: number;
  identifier?: string;
  url?: string;
  children?: ContentNode[];
  data?: {
    alias?: string;
    hProperties?: Record<string, unknown>;
    hChildren?: unknown[];
    hName?: string;
  };
};
export type Heading = { title: string; id: string; depth: number };
export type PageTarget = {
  key: string;
  identity: string;
  locale: Language;
  route: string;
  title: string;
  aliases: string[];
  headings: Heading[];
};
export type MarkdownSource = {
  file: string;
  source: string;
  tree: Root;
  target: PageTarget;
  referenceHeading?: Heading;
};
export type ContentDocument = MarkdownSource & { kind: ContentKind; metadata: ContentMetadata };
function isContentDocument(source: MarkdownSource): source is ContentDocument {
  return 'metadata' in source;
}
export type ContentIndex = {
  documents: ContentDocument[];
  pages: PageTarget[];
  translations: Map<string, PageTarget[]>;
  outgoing: Map<string, Set<string>>;
  backlinks: Map<string, PageTarget[]>;
  warnings: string[];
  fragments: Map<string, MarkdownSource>;
};
const normal = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('en');
const noteId = (value: string) => normal(value).replace(/\s+/g, ' ');
function fail(file: string, node: Node | undefined, message: string): never {
  throw new Error(
    `${file}:${node?.position?.start.line ?? 1}:${node?.position?.start.column ?? 1}: ${message}`,
  );
}
function markdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : [];
    })
    .sort();
}
function parseContent(kind: ContentKind, file: string): ContentDocument {
  const source = fs.readFileSync(file, 'utf8');
  const tree = markdownParser().parse(source) as Root;
  const matter = tree.children[0];
  if (matter?.type !== 'yaml') fail(file, matter, 'YAML frontmatter is required');
  const yaml = parseDocument(matter.value, { uniqueKeys: true });
  if (yaml.errors.length) fail(file, matter, yaml.errors.map((error) => error.message).join('; '));
  let input: unknown;
  try {
    input = yaml.toJS({ maxAliasCount: 50 });
  } catch (error) {
    fail(file, matter, String(error));
  }
  const result = contentMetadataSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = String(issue.path[0] ?? '');
    const row = matter.value.split('\n').findIndex((line) => line.startsWith(`${field}:`));
    fail(
      file,
      {
        type: 'yaml',
        position: {
          start: { line: row < 0 ? 1 : row + 2, column: 1 },
          end: { line: row < 0 ? 1 : row + 2, column: 1 },
        },
      },
      result.error.issues
        .map((item) => `${item.path.join('.') || 'metadata'}: ${item.message}`)
        .join('; '),
    );
  }
  const metadata = result.data;
  if (kind === 'blog' && metadata.status === 'published' && !metadata.published)
    fail(file, matter, 'published: Required for published blog');
  tree.children.shift();
  const first = tree.children[0];
  if (first?.type === 'heading' && first.depth === 1 && toString(first) === metadata.title)
    tree.children.shift();
  const headings: Heading[] = [];
  const slugger = new GithubSlugger();
  visit(tree, (raw) => {
    const node = raw as ContentNode;
    if (node.type === 'heading') {
      if (node.depth === 1) fail(file, node, 'Body H1 must be the opening heading and match title');
      const title = toString(raw);
      const id = `heading-${slugger.slug(title)}`;
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      headings.push({ title, id, depth: node.depth! });
    }
    if (node.type === 'embed')
      fail(file, node, 'Wiki embeds are not supported; use standard Markdown images');
  });
  const locale = metadata.language === 'zh-CN' ? 'zh' : 'en';
  const identity = `${kind}:${metadata.id}`;
  const target: PageTarget = {
    key: `${identity}:${locale}`,
    identity,
    locale,
    route: localizedPath(locale, `/${kind}/${metadata.slug}/`),
    title: metadata.title,
    aliases: [...metadata.aliases, ...(metadata.abbreviation ? [metadata.abbreviation] : [])],
    headings,
  };
  const lastHeading = tree.children.findLast((node) => node.type === 'heading');
  const referenceHeading =
    lastHeading?.type === 'heading' &&
    /^(参考文献|参考来源|references|sources)$/i.test(toString(lastHeading))
      ? headings.find((heading) => heading.id === lastHeading.data?.hProperties?.id)
      : undefined;
  return { kind, metadata, file, source, tree, target, referenceHeading };
}

export function translationFor(index: ContentIndex, target: PageTarget, locale: Language) {
  return index.translations.get(target.identity)?.find((page) => page.locale === locale);
}

export function resolveReference(
  index: ContentIndex,
  document: MarkdownSource,
  raw: string,
  mode: 'wiki' | 'link' = 'wiki',
): { target?: PageTarget; href: string; foreign: boolean } {
  const hashAt = raw.indexOf('#');
  const head = hashAt < 0 ? raw : raw.slice(0, hashAt);
  const fragment = hashAt < 0 ? '' : decodeURIComponent(raw.slice(hashAt + 1));
  let target: PageTarget | undefined;
  if (mode === 'link' && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) {
    const url = new URL(raw, absoluteUrl('/'));
    if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol))
      throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (url.origin !== new URL(absoluteUrl('/')).origin)
        return { href: url.href, foreign: false };
      return resolveReference(index, document, `${url.pathname}${url.search}${url.hash}`, 'link');
    }
    return { href: url.href, foreign: false };
  }
  let query = '';
  if (mode === 'link') {
    const queryAt = head.indexOf('?');
    const pathname = queryAt < 0 ? head : head.slice(0, queryAt);
    query = queryAt < 0 ? '' : head.slice(queryAt);
    if (!pathname) target = document.target;
    else if (pathname.endsWith('.md')) {
      const file = path.resolve(path.dirname(document.file), decodeURIComponent(pathname));
      target = index.documents.find(
        (item) => item.file === file && item.metadata.status === 'published',
      )?.target;
    } else {
      const route =
        withoutBasePath(
          new URL(pathname, `https://content.invalid${document.target.route}`).pathname,
        ).replace(/^\/zh(?=\/|$)/, '') || '/';
      target = index.pages.find((page) => page.route === `${route.replace(/\/$/, '')}/`);
    }
  } else {
    if (!head) target = document.target;
    else if (/^(wiki|blog|scales|page):/.test(head)) {
      const versions = index.translations.get(head);
      target = versions?.find((page) => page.locale === document.target.locale) ?? versions?.[0];
    } else {
      const candidates = index.pages.filter(
        (page) =>
          page.locale === document.target.locale &&
          [page.title, ...page.aliases].some((name) => normal(name) === normal(head)),
      );
      if (candidates.length > 1)
        throw new Error(
          `Ambiguous reference "${head}"; use ${candidates.map((page) => page.identity).join(' or ')}`,
        );
      target = candidates[0];
    }
  }
  if (!target) throw new Error(`Missing or unpublished target: ${head || raw}`);
  let anchor = '';
  if (fragment) {
    const exact = target.headings.find((heading) => heading.id === fragment);
    const byTitle = target.headings.filter((heading) => normal(heading.title) === normal(fragment));
    if (exact) anchor = exact.id;
    else if (byTitle.length === 1) anchor = byTitle[0].id;
    else throw new Error(`Missing or ambiguous anchor "${fragment}" in ${target.route}`);
  }
  return {
    target,
    href: `${target.route}${query}${anchor ? `#${anchor}` : ''}`,
    foreign: target.locale !== document.target.locale,
  };
}

export function buildContentIndex(
  root: string | undefined = undefined,
  scales = readScales(),
): ContentIndex {
  const directory = root ? path.join(root, 'content') : contentRoot();
  const documents = contentKinds.flatMap((kind) =>
    markdownFiles(path.join(directory, kind)).map((file) => parseContent(kind, file)),
  );
  const seenKeys = new Set<string>();
  const seenRoutes = new Set<string>();
  for (const document of documents) {
    if (seenKeys.has(document.target.key))
      fail(document.file, undefined, `Duplicate ID: ${document.target.key}`);
    if (seenRoutes.has(document.target.route))
      fail(document.file, undefined, `Duplicate route: ${document.target.route}`);
    seenKeys.add(document.target.key);
    seenRoutes.add(document.target.route);
  }
  const pages = documents
    .filter((document) => document.metadata.status === 'published')
    .map((document) => document.target);
  for (const locale of locales) {
    for (const [id, route, title] of [
      ['home', '/', messages[locale].site.title],
      ['scales', '/scales/', messages[locale].site.scales],
      ['wiki', '/wiki/', messages[locale].content.wiki],
      ['blog', '/blog/', messages[locale].content.blog],
    ])
      pages.push({
        key: `page:${id}:${locale}`,
        identity: `page:${id}`,
        locale,
        route: localizedPath(locale, route),
        title,
        aliases: [],
        headings: [],
      });
    for (const scale of scales)
      pages.push({
        key: `scales:${scale.id}:${locale}`,
        identity: `scales:${scale.id}`,
        locale,
        route: localizedPath(locale, `/scales/${scale.id}/`),
        title: scale.title[locale],
        aliases: [scale.abbreviation],
        headings: scale.sections.map((section) => ({
          title: section.title[locale],
          id: `section-${section.id}`,
          depth: 2,
        })),
      });
  }
  const index: ContentIndex = {
    documents,
    pages,
    translations: new Map(),
    outgoing: new Map(),
    backlinks: new Map(),
    warnings: [],
    fragments: new Map(),
  };
  for (const page of pages)
    index.translations.set(page.identity, [...(index.translations.get(page.identity) ?? []), page]);
  for (const locale of locales) {
    for (const scale of scales) {
      const file = contentPath('scales', `${scale.id}.yaml`);
      const source = scale.descriptionMarkdown?.[locale] ?? scale.description[locale];
      for (const key of [`page:scales:${locale}`, `scales:${scale.id}:${locale}`]) {
        const target = pages.find((page) => page.key === key)!;
        const tree = markdownParser().parse(source) as Root;
        if (tree.children.length !== 1 || tree.children[0].type !== 'paragraph')
          fail(file, undefined, `description.${locale}: expected inline Markdown`);
        visit(tree, (node) => {
          const type = (node as ContentNode).type;
          if (type === 'footnoteReference' || type === 'embed')
            fail(file, node, 'Description footnotes and embeds are not supported');
        });
        index.fragments.set(`${key}/${scale.id}`, {
          file: `${file} (description.${locale})`,
          source,
          tree,
          target,
        });
      }
    }
  }
  for (const document of [...documents, ...index.fragments.values()]) {
    const definitions = new Map<string, ContentNode>();
    const linkDefinitions = new Map<string, Definition>();
    const used = new Set<string>();
    visit(document.tree, (raw) => {
      const node = raw as ContentNode;
      if (raw.type === 'definition' && !linkDefinitions.has(raw.identifier))
        linkDefinitions.set(raw.identifier, raw);
      if (node.type === 'footnoteDefinition') {
        const id = noteId(node.identifier!);
        if (definitions.has(id)) fail(document.file, node, `Duplicate footnote: ${id}`);
        definitions.set(id, node);
      }
      if (node.type === 'footnoteReference') used.add(noteId(node.identifier!));
      if (node.type === 'text') {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        const original =
          start !== undefined && end !== undefined
            ? document.source.slice(start, end)
            : (node.value ?? '');
        if (/(?<!\\)\[\^[^\]\n]+\]/.test(original))
          fail(document.file, node, `Undefined footnote in: ${original}`);
      }
    });
    for (const id of used)
      if (!definitions.has(id)) fail(document.file, undefined, `Undefined footnote: ${id}`);
    for (const [id, node] of definitions)
      if (!used.has(id))
        index.warnings.push(`${document.file}:${node.position?.start.line}: unused footnote ${id}`);
    if (isContentDocument(document) && document.metadata.status !== 'published') continue;
    const outgoing = index.outgoing.get(document.target.key) ?? new Set<string>();
    index.outgoing.set(document.target.key, outgoing);
    const record = (node: ContentNode, url: string, mode: 'wiki' | 'link') => {
      try {
        const result = resolveReference(index, document, url, mode);
        if (result.target) {
          outgoing.add(result.target.key);
          node.data = {
            ...node.data,
            hProperties: {
              ...node.data?.hProperties,
              href: result.href,
              ...(result.foreign
                ? { hrefLang: result.target.locale === 'zh' ? 'zh-CN' : 'en' }
                : {}),
            },
          };
          if (result.foreign) {
            const label = ` (${result.target.locale === 'zh' ? '中文' : 'English'})`;
            if (mode === 'wiki')
              node.data.hChildren = [
                { type: 'text', value: `${node.data.alias ?? node.value}${label}` },
              ];
            else node.children?.push({ type: 'text', value: label });
          }
        }
        if (mode === 'link') node.url = result.href;
      } catch (error) {
        fail(document.file, node, error instanceof Error ? error.message : String(error));
      }
    };
    visit(document.tree, (raw) => {
      const node = raw as ContentNode;
      if (node.type === 'footnoteDefinition' && !used.has(noteId(node.identifier!))) return SKIP;
      if (node.type === 'wikiLink') record(node, node.value!, 'wiki');
      if (node.type === 'link') record(node, node.url!, 'link');
      if (node.type === 'linkReference') {
        const definition = linkDefinitions.get(node.identifier!);
        if (definition?.type === 'definition') {
          const result = { ...node, type: 'link', url: definition.url };
          record(result, definition.url, 'link');
          Object.assign(node, result);
        }
      }
    });
  }
  for (const [sourceKey, outgoing] of index.outgoing) {
    const source = pages.find((page) => page.key === sourceKey)!;
    for (const key of outgoing)
      if (key !== sourceKey)
        index.backlinks.set(key, [...(index.backlinks.get(key) ?? []), source]);
  }
  return index;
}

let cached: { signature: string; index: ContentIndex } | undefined;
export function getContentIndex() {
  if (cached && process.env.NODE_ENV === 'production') return cached.index;
  const files = [
    ...contentKinds.flatMap((kind) => markdownFiles(contentPath(kind))),
    contentPath('scales', 'index.yaml'),
    ...readScaleIds().map((id) => contentPath('scales', `${id}.yaml`)),
  ];
  const signature =
    contentRoot() + files.map((file) => `${file}:${fs.readFileSync(file, 'utf8')}`).join('\0');
  if (!cached || cached.signature !== signature) cached = { signature, index: buildContentIndex() };
  return cached.index;
}
export function contentDocuments(kind: ContentKind, locale: Language, index = getContentIndex()) {
  return index.documents
    .filter(
      (document) =>
        document.kind === kind &&
        document.target.locale === locale &&
        document.metadata.status === 'published',
    )
    .sort((a, b) =>
      kind === 'blog'
        ? b.metadata.published!.localeCompare(a.metadata.published!) ||
          a.metadata.id.localeCompare(b.metadata.id)
        : a.metadata.title.localeCompare(b.metadata.title, locale === 'zh' ? 'zh-CN' : 'en') ||
          a.metadata.id.localeCompare(b.metadata.id),
    );
}
export function contentPageMetadata(
  target: PageTarget,
  description?: string,
  index = getContentIndex(),
): Metadata {
  const versions = index.translations.get(target.identity) ?? [];
  const languages = Object.fromEntries(
    versions.map((page) => [page.locale === 'zh' ? 'zh-CN' : 'en', absoluteUrl(page.route)]),
  );
  return {
    title: `${target.title} | ${messages[target.locale].site.name}`,
    description: description ?? messages[target.locale].site.description,
    alternates: { canonical: absoluteUrl(target.route), languages },
  };
}
