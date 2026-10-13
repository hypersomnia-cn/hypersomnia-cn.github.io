import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { locales, localeTags, messages } from '../src/i18n/messages';
import { basePath, localizedPath, publicPath } from '../src/i18n/paths';
import { readScale, readScaleSummaries, readScales } from '../src/lib/content';
import { scaleIds } from '../src/lib/scale-contracts';
import { absoluteUrl, pageMetadata } from '../src/lib/site';
import { getContentIndex, contentPageMetadata } from '../src/lib/markdown';

const contentIndex = getContentIndex();
const validRoutes = new Set(contentIndex.pages.map((page) => page.route));
for (const locale of locales) {
  for (const kind of ['wiki', 'blog'])
    assert(
      !fs.existsSync(path.resolve('out', locale, kind, '__empty__')),
      'Build placeholder must not be published',
    );
}

const root = path.resolve('out');
const decode = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
function tags(html: string, name: string) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key.toLowerCase(),
        decode(value),
      ]),
    ),
  );
}
function checkLinks(html: string) {
  for (const tag of [...tags(html, 'script'), ...tags(html, 'link')]) {
    const url = tag.src ?? tag.href;
    if (
      !url ||
      !url.startsWith('/') ||
      (tag.href && tag.rel !== 'stylesheet' && tag.rel !== 'preload')
    )
      continue;
    assert(url.startsWith(`${basePath}/_next/`), `Incorrect asset base path: ${url}`);
    assert(
      fs.existsSync(path.join(root, url.slice(basePath.length).split('?')[0])),
      `Missing asset: ${url}`,
    );
  }
  for (const { href } of tags(html, 'a')) {
    if (!href?.startsWith('/')) continue;
    assert(href.startsWith(`${basePath}/`), `Incorrect link base path: ${href}`);
    const logical = href.slice(basePath.length).split(/[?#]/)[0];
    assert(logical === '/' || validRoutes.has(logical), `Invalid internal link: ${href}`);
    assert(fs.existsSync(path.join(root, logical, 'index.html')), `Missing linked page: ${href}`);
  }
}
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
assert.equal(
  [...sitemap.matchAll(/<loc>/g)].length,
  contentIndex.pages.length,
  'Sitemap must contain every published page',
);
for (const target of contentIndex.pages.filter(
  (page) =>
    page.identity.startsWith('wiki:') ||
    page.identity.startsWith('blog:') ||
    ['page:wiki', 'page:blog'].includes(page.identity),
)) {
  const html = fs.readFileSync(path.join(root, target.route, 'index.html'), 'utf8');
  const document = contentIndex.documents.find((item) => item.target.key === target.key);
  const expected = contentPageMetadata(target, document?.metadata.description, contentIndex);
  assert.equal(tags(html, 'html')[0]?.lang, localeTags[target.locale], target.route);
  assert.equal(
    decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
    expected.title,
    target.route,
  );
  assert.equal(
    tags(html, 'meta').find((tag) => tag.name === 'description')?.content,
    expected.description,
    target.route,
  );
  assert.equal(
    tags(html, 'link').find((tag) => tag.rel === 'canonical')?.href,
    absoluteUrl(target.route),
    target.route,
  );
  const alternates = tags(html, 'link').filter((tag) => tag.rel === 'alternate');
  const versions = contentIndex.translations.get(target.identity) ?? [];
  assert.equal(
    alternates.length,
    versions.length,
    `${target.route}: unexpected translation alternates`,
  );
  for (const version of versions)
    assert(
      alternates.some(
        (tag) =>
          tag.hreflang === localeTags[version.locale] && tag.href === absoluteUrl(version.route),
      ),
    );
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.equal([...markup.matchAll(/<h1\b/g)].length, 1, `${target.route}: exactly one H1`);
  assert.equal(decode(markup.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''), target.title);
  assert(sitemap.includes(`<loc>${absoluteUrl(target.route)}</loc>`));
  const ids = tags(markup, '[a-z][\\w-]*')
    .map((tag) => tag.id)
    .filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, `${target.route}: duplicate element IDs`);
  for (const { href } of tags(markup, 'a')) {
    if (!href?.includes('#')) continue;
    const [url, fragment] = href.split('#');
    if (url && !url.startsWith('/')) continue;
    const destination = url
      ? fs.readFileSync(
          path.join(root, url.slice(basePath.length).split('?')[0], 'index.html'),
          'utf8',
        )
      : markup;
    assert(
      tags(destination, '[a-z][\\w-]*').some((tag) => tag.id === decodeURIComponent(fragment)),
      `${target.route}: missing anchor ${href}`,
    );
  }
  checkLinks(html);
}
for (const locale of locales) {
  for (const id of [null, ...scaleIds]) {
    const route = localizedPath(locale, id ? `/scales/${id}/` : '/');
    const html = fs.readFileSync(path.join(root, route, 'index.html'), 'utf8');
    const scale = id ? readScale(id) : null;
    const expected = pageMetadata(
      locale,
      id ? `/scales/${id}/` : '/',
      scale?.title[locale],
      scale?.description[locale],
    );
    assert.equal(tags(html, 'html')[0]?.lang, localeTags[locale], route);
    const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)];
    assert.equal(titles.length, 1, `${route}: duplicate title`);
    assert.equal(decode(titles[0][1]), expected.title);
    assert.equal(tags(html, 'meta').filter((tag) => tag.name === 'description').length, 1, route);
    assert.equal(
      tags(html, 'meta').find((tag) => tag.name === 'description')?.content,
      expected.description,
    );
    const links = tags(html, 'link');
    assert.equal(links.filter((tag) => tag.rel === 'canonical').length, 1, route);
    assert.equal(links.find((tag) => tag.rel === 'canonical')?.href, absoluteUrl(route));
    for (const [language, targetLocale] of [
      ['zh-CN', 'zh'],
      ['en', 'en'],
      ['x-default', 'zh'],
    ] as const) {
      assert.equal(
        links.find((tag) => tag.rel === 'alternate' && tag.hreflang === language)?.href,
        absoluteUrl(localizedPath(targetLocale, id ? `/scales/${id}/` : '/')),
        route,
      );
    }
    assert(sitemap.includes(`<loc>${absoluteUrl(route)}</loc>`), `Missing sitemap URL: ${route}`);
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    const h1 = decode(markup.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
    assert.equal(
      h1,
      scale?.title[locale] ?? messages[locale].site.title,
      `${route}: initial heading`,
    );
    if (!id) {
      assert(
        !html.includes('"sections":') &&
          !html.includes('\\"sections\\":') &&
          !html.includes('\\"bands\\":'),
        `${route}: homepage contains full scales`,
      );
    }
    checkLinks(html);
  }
}
assert(!fs.existsSync(path.join(root, 'scales')), 'Legacy scale routes must not be exported');
for (const file of ['index.html', '404.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  checkLinks(html);
  for (const locale of locales)
    assert(
      tags(html, 'a').some((tag) => tag.href === publicPath(`/${locale}/`)),
      `${file}: missing locale link`,
    );
  if (file === '404.html')
    assert(
      tags(html, 'meta').some((tag) => tag.name === 'robots' && tag.content.includes('noindex')),
      '404 must be noindex',
    );
}
console.log(
  `Validated ${contentIndex.pages.length} localized pages, sitemap, entry and 404 for ${basePath || '/'} (${absoluteUrl('/')})`,
);
console.log(
  JSON.stringify({
    fullScaleJsonBytes: Buffer.byteLength(JSON.stringify(readScales())),
    summaryJsonBytes: Buffer.byteLength(JSON.stringify(readScaleSummaries())),
    homeHtmlBytes: fs.statSync(path.join(root, 'zh/index.html')).size,
    homeRscBytes: fs.statSync(path.join(root, 'zh/index.txt')).size,
  }),
);
