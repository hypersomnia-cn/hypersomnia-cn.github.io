import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { readScales } from '../../src/lib/content';
import { plainMarkdown } from '../../src/lib/markdown-parser';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildContentIndex,
  contentDocuments,
  contentPageMetadata,
  resolveReference,
  translationFor,
} from '../../src/lib/markdown';
import { renderDocument } from '../../src/lib/markdown-render';

let root: string;
function fixtureIndex() {
  const scales = readScales().map((scale) => ({
    ...scale,
    descriptionMarkdown: { zh: 'Test description', en: 'Test description' },
  }));
  return buildContentIndex(root, scales);
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ih-markdown-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
function write(
  id: string,
  body = '',
  extra: Record<string, unknown> = {},
  kind = 'wiki',
  filename = `${id}.md`,
) {
  const directory = path.join(root, 'content', kind);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, filename),
    `---\n${stringify({ id, title: id, language: 'zh-CN', status: 'published', description: 'Test description', updated: '2026-10-13', ...extra })}---\n${body}`,
  );
}

describe('Markdown content engine', () => {
  it('uses the same reference resolver for YAML descriptions and indexes every displaying page', () => {
    write('alpha');
    const scales = readScales().map((scale) => ({
      ...scale,
      descriptionMarkdown: {
        zh: scale.id === 'ihss' ? '用于评估[[wiki:alpha|相关症状]]。' : 'Test description',
        en: 'Test description',
      },
    }));
    const index = buildContentIndex(root, scales);
    const fragment = index.fragments.get('page:home:zh/ihss')!;
    const html = renderToStaticMarkup(renderDocument(fragment, true));
    expect(html).toContain('/zh/wiki/alpha/');
    expect(html).toContain('相关症状</a>');
    expect(html).not.toContain('<p');
    expect(index.backlinks.get('wiki:alpha:zh')?.map((page) => page.key)).toEqual([
      'page:home:zh',
      'scales:ihss:zh',
    ]);
    expect(plainMarkdown('用于评估[[特发性睡眠增多]]相关症状。')).toBe(
      '用于评估特发性睡眠增多相关症状。',
    );
    expect(plainMarkdown('See [[wiki:alpha|Alpha]].')).toBe('See Alpha.');
    const broken = scales.map((scale) => ({
      ...scale,
      descriptionMarkdown: { zh: '[[wiki:missing]]', en: 'Test description' },
    }));
    expect(() => buildContentIndex(root, broken)).toThrow(
      /description.zh.*Missing or unpublished target/s,
    );
  });
  it('renders the real IH sample, merges references, and preserves every return link', () => {
    const sample = fs.readFileSync(path.resolve('content/wiki/特发性睡眠增多.md'), 'utf8');
    fs.mkdirSync(path.join(root, 'content/wiki'), { recursive: true });
    fs.writeFileSync(path.join(root, 'content/wiki/ih.md'), sample);
    const document = fixtureIndex().documents[0];
    const html = renderToStaticMarkup(renderDocument(document));
    expect(document.target.headings.some((heading) => heading.title === '诊断')).toBe(true);
    expect(html).toContain('id="heading-诊断"');
    expect(html).toContain('<table>');
    expect(html).toContain('并非逐句翻译');
    expect(html.match(/>参考文献<\/h2>/g)).toHaveLength(1);
    expect(html.match(/id="source-fn-(?:wiki|trotti|critical|aasm|fda|cohort)"/g)).toHaveLength(6);
    const calls = [...html.matchAll(/id="(source-fnref-[^"]+)"/g)].map((match) => match[1]);
    expect(calls.length).toBeGreaterThan(6);
    for (const call of calls) expect(html).toContain(`href="#${call}"`);
    expect(html).not.toContain('<h1');
  });

  it('resolves cyclic wiki/blog links, aliases, file links and scale targets in two passes', () => {
    write('alpha', '[[另一个#症状|查看症状]]\n\n[同一页](../blog/beta.md)\n\n[[scales:ess]]');
    write(
      'beta',
      '## 症状\n\n[[wiki:alpha]]\n\n[^one]: [量表](/zh/scales/ess/)\n\n引用[^one]',
      { aliases: ['另一个'], published: '2026-10-12' },
      'blog',
    );
    const index = fixtureIndex();
    const alpha = index.documents.find((item) => item.metadata.id === 'alpha')!;
    const html = renderToStaticMarkup(renderDocument(alpha));
    expect(html).toContain('/zh/blog/beta/#heading-症状');
    expect(index.outgoing.get(alpha.target.key)?.size).toBe(2);
    expect(index.backlinks.get('blog:beta:zh')?.map((page) => page.identity)).toEqual([
      'wiki:alpha',
    ]);
    expect(index.backlinks.get('scales:ess:zh')).toHaveLength(2);
    expect(index.backlinks.get('wiki:alpha:zh')).toHaveLength(1);
  });

  it('maps translated IDs with different slugs and annotates a foreign language fallback', () => {
    write('alpha', '[[wiki:english-only]]', { slug: 'alpha-zh' });
    write(
      'alpha',
      'English',
      { title: 'Alpha', language: 'en', slug: 'alpha-en' },
      'wiki',
      'alpha-en.md',
    );
    write('english-only', '## Details', { language: 'en' });
    const index = fixtureIndex();
    const zh = index.documents.find((item) => item.metadata.slug === 'alpha-zh')!;
    expect(translationFor(index, zh.target, 'en')?.route).toBe('/en/wiki/alpha-en/');
    expect(renderToStaticMarkup(renderDocument(zh))).toContain('hrefLang="en"');
    expect(renderToStaticMarkup(renderDocument(zh))).toContain('(English)');
    const english = index.documents.find((item) => item.metadata.id === 'english-only')!;
    expect(
      contentPageMetadata(english.target, 'description', index).alternates?.languages,
    ).not.toHaveProperty('zh-CN');
  });

  it('resolves named Markdown link definitions and records them as backlinks', () => {
    write('alpha', '[Beta][other]\n\n> [other]: ./beta.md');
    write('beta');
    const index = fixtureIndex();
    expect(index.backlinks.get('wiki:beta:zh')).toHaveLength(1);
    expect(renderToStaticMarkup(renderDocument(index.documents[0]))).toContain('/zh/wiki/beta/');
  });

  it('validates repeated headings and rejects an ambiguous title anchor', () => {
    write('alpha', '## 重复\n\n## 重复');
    const index = fixtureIndex();
    const document = index.documents[0];
    expect(document.target.headings.map((heading) => heading.id)).toEqual([
      'heading-重复',
      'heading-重复-1',
    ]);
    expect(resolveReference(index, document, '#heading-重复-1', 'link').href).toContain(
      '#heading-重复-1',
    );
    expect(() => resolveReference(index, document, '#重复', 'link')).toThrow('ambiguous anchor');
  });

  it.each([
    ['missing target', '[[wiki:missing]]', {}, /Missing or unpublished target/],
    ['missing anchor', '[Section](#missing)', {}, /Missing or ambiguous anchor/],
    ['missing source', 'Text[^missing]', {}, /Undefined footnote/],
    ['duplicate source', 'Text[^one]\n\n[^one]: First\n\n[^one]: Second', {}, /Duplicate footnote/],
    ['invalid date', '', { updated: '2026-02-30' }, /real calendar date/],
    ['date order', '', { published: '2026-10-14' }, /updated precedes published/],
    ['unknown metadata', '', { typo: true }, /Unrecognized key/],
    ['conflicting H1', '# Wrong title', {}, /Body H1/],
    ['extra H1', '# alpha\n\n# alpha', {}, /Body H1/],
    ['unsafe URL', '[Bad](javascript:alert)', {}, /Unsupported URL protocol/],
  ])('rejects %s with a file and line diagnostic', (_, body, metadata, error) => {
    write('alpha', body, metadata);
    expect(() => fixtureIndex()).toThrow(error);
    expect(() => fixtureIndex()).toThrow(/alpha\.md:\d+:\d+:/);
  });

  it('rejects duplicate identities, routes, and ambiguous aliases', () => {
    write('alpha');
    write('alpha', '', {}, 'wiki', 'duplicate.md');
    expect(() => fixtureIndex()).toThrow('Duplicate ID');
    fs.unlinkSync(path.join(root, 'content/wiki/duplicate.md'));
    write('beta', '', { slug: 'alpha' });
    expect(() => fixtureIndex()).toThrow('Duplicate route');
    write('beta', '', { aliases: ['shared'] });
    write('alpha', '[[shared]]', { aliases: ['shared'] });
    expect(() => fixtureIndex()).toThrow('Ambiguous reference');
  });

  it('does not publish drafts and prevents published references to drafts', () => {
    write('alpha', '', { status: 'draft', description: undefined, updated: undefined });
    const index = fixtureIndex();
    expect(index.pages.some((page) => page.identity === 'wiki:alpha')).toBe(false);
    write('beta', '[[wiki:alpha]]');
    expect(() => fixtureIndex()).toThrow('Missing or unpublished');
  });

  it('requires blog publication dates and sorts by date, then ID', () => {
    write('alpha', '', {}, 'blog');
    expect(() => fixtureIndex()).toThrow('Required for published blog');
    write('alpha', '', { published: '2026-10-12' }, 'blog');
    write('beta', '', { published: '2026-10-13' }, 'blog');
    write('charlie', '', { published: '2026-10-13' }, 'blog');
    expect(contentDocuments('blog', 'zh', fixtureIndex()).map((item) => item.metadata.id)).toEqual([
      'beta',
      'charlie',
      'alpha',
    ]);
  });

  it('warns on unused sources, ignores literal syntax in code and escaped text, and drops raw HTML', () => {
    write(
      'alpha',
      '\\[^literal]\n\n`[^code] [[missing]]`\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[^unused]: Not used',
    );
    const index = fixtureIndex();
    expect(index.warnings).toHaveLength(1);
    const html = renderToStaticMarkup(renderDocument(index.documents[0]));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).toContain('[[missing]]');
  });

  it('does not include unused source links in the public citation graph', () => {
    write('alpha', 'Content\n\n[^unused]: [[wiki:beta]]');
    write('beta');
    const index = fixtureIndex();
    expect(index.warnings).toHaveLength(1);
    expect(index.backlinks.get('wiki:beta:zh')).toBeUndefined();
  });
});
