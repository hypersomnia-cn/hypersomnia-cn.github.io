import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { readScale } from '../../src/lib/content';
const messages = {
  zh: JSON.parse(fs.readFileSync('messages/zh.json', 'utf8')),
  en: JSON.parse(fs.readFileSync('messages/en.json', 'utf8')),
};
const localeTags = { zh: 'zh-CN', en: 'en' };
const absoluteUrl = (route: string) =>
  new URL(
    `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${route}`,
    process.env.SITE_ORIGIN || 'http://127.0.0.1:4173',
  ).href;
const failures = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  failures.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && /\.(?:js|css|txt)(?:\?|$)/.test(response.url()))
      errors.push(`Missing static resource: ${response.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|Minified React error/i.test(message.text()))
      errors.push(message.text());
  });
});
test.afterEach(({ page }) => expect(failures.get(page)).toEqual([]));

test('partial answers and errors survive locale navigation and browser history', async ({
  page,
}) => {
  const documents: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documents.push(request.url());
  });
  await page.goto('./scales/ess/');
  await page.locator('#field-q1 input').first().check();
  await page.getByRole('button', { name: '查看结果' }).click();
  await expect(page.locator('#error-q2')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/\/en\/scales\/ess\/$/);
  await expect(page.locator('#field-q1 input').first()).toBeChecked();
  await expect(page.locator('#error-q2')).toHaveText('Please provide a valid answer.');
  await page.goBack();
  await expect(page.locator('#field-q1 input').first()).toBeChecked();
  await expect(page.locator('#error-q2')).toHaveText('请完成此题并输入有效答案。');
  await page.goForward();
  await expect(page.locator('#field-q1 input').first()).toBeChecked();
  expect(documents).toHaveLength(1);
  await page.getByRole('link', { name: 'All questionnaires' }).click();
  await expect(page).toHaveURL(/\/en\/scales\/$/);
  await expect(page.locator('input:checked')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('input:checked')).toHaveCount(0);
  await expect(page.locator('.error-summary')).toHaveCount(0);
  await page.getByRole('link', { name: 'All questionnaires' }).click();
  await page.locator('.card-fss .card-link').click();
  await expect(page.locator('input:checked')).toHaveCount(0);
});

test('PSQI free text remains in memory and never enters requests or storage', async ({ page }) => {
  const marker = 'private-draft-6f80c273';
  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.url()} ${request.postData() ?? ''}`));
  await page.goto('./scales/psqi/');
  await page.locator('#field-q5j_text textarea').fill(marker);
  await page.locator('#field-q1 input').fill('23:45');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('#field-q5j_text textarea')).toHaveValue(marker);
  await expect(page.locator('#field-q1 input')).toHaveValue('23:45');
  expect(requests.some((value) => value.includes(marker) || value.includes('23%3A45'))).toBe(false);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookie: '' });
  await page.reload();
  await expect(page.locator('#field-q5j_text textarea')).toHaveValue('');
  await expect(page.locator('#field-q1 input')).toHaveValue('');
});

test('fresh results survive locale changes but are cleared after leaving and returning', async ({
  page,
}) => {
  await page.goto('./en/scales/fss/');
  for (const field of await page.locator('fieldset').all())
    await field.locator('input').first().check();
  await page.getByRole('button', { name: 'View results' }).click();
  await expect(page.getByTestId('score')).toHaveText('1.00');
  await expect(page.locator('.result-panel')).toBeFocused();
  await page.getByRole('button', { name: '切换为中文' }).click();
  await expect(page.getByTestId('score')).toHaveText('1.00');
  await expect(page.locator('.result-panel')).toBeFocused();
  await page.getByRole('link', { name: '全部量表' }).click();
  await expect(page).toHaveURL(/\/scales\/$/);
  await page.goBack();
  await expect(page.getByTestId('score')).toHaveCount(0);
  await expect(page.locator('input:checked')).toHaveCount(0);
});

test('invalid and removed paths return actual 404 without query locale overrides', async ({
  page,
}) => {
  for (const route of ['./scales/unknown/', './fr/', './en/scales/unknown/', './scales/missing/']) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/\/en\/$/);
  }
  await page.goto('./en/?lang=zh');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test.describe('initial static HTML', () => {
  test.use({ javaScriptEnabled: false });
  test('all ten pages have the correct locale and SEO without JavaScript', async ({ page }) => {
    for (const locale of ['zh', 'en'] as const) {
      for (const id of [null, 'ess', 'ihss', 'fss', 'psqi'] as const) {
        const route = `${locale === 'zh' ? '/' : '/en/'}${id ? `scales/${id}/` : ''}`;
        const response = await page.goto(`.${route}`);
        expect(response?.status()).toBe(200);
        const scale = id ? readScale(id) : null;
        await expect(page.locator('html')).toHaveAttribute('lang', localeTags[locale]);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          scale?.title[locale] ?? messages[locale].site.title,
        );
        await expect(page).toHaveTitle(
          scale
            ? `${scale.title[locale]} | ${messages[locale].site.name}`
            : messages[locale].site.title,
        );
        await expect(page.locator('meta[name=description]')).toHaveAttribute(
          'content',
          scale?.description[locale] ?? messages[locale].site.description,
        );
        await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
          'href',
          absoluteUrl(route),
        );
        await expect(page.locator('link[rel=alternate][hreflang=en]')).toHaveAttribute(
          'href',
          absoluteUrl(`/en/${id ? `scales/${id}/` : ''}`),
        );
        await page.reload();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
    }
  });
  test('root and static 404 provide working language links', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.zh.site.title);
    await page.getByRole('link', { name: '量表', exact: true }).last().click();
    await expect(page).toHaveURL(/\/scales\/$/);
    expect((await page.goto('./does-not-exist/'))?.status()).toBe(404);
    await page.getByRole('link', { name: '返回首页' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
