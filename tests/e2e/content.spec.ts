import { test, expect } from '@playwright/test';

const article = './zh/wiki/idiopathic-hypersomnia/';
test('YAML Wiki references render on home and scale pages and create backlinks', async ({
  page,
}) => {
  await page.goto('./zh/');
  await page
    .locator('.card-ihss .card-description')
    .getByRole('link', { name: '特发性睡眠增多', exact: true })
    .click();
  await expect(page).toHaveURL(/\/zh\/wiki\/idiopathic-hypersomnia\/$/);
  await expect(page.locator('.content-backlinks a[href$="/zh/"]')).toHaveCount(1);
  const scaleLink = page.locator('.content-backlinks a[href$="/zh/scales/ihss/"]');
  await expect(scaleLink).toHaveCount(1);
  await scaleLink.click();
  await expect(page.locator('meta[name=description]')).not.toHaveAttribute('content', /\[\[/);
  await page
    .locator('.scale-description')
    .getByRole('link', { name: '特发性睡眠增多', exact: true })
    .click();
  await expect(page).toHaveURL(/\/zh\/wiki\/idiopathic-hypersomnia\/$/);
});
test('wiki navigation, missing translation, sources and narrow-screen tables', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./zh/');
  await page.getByRole('link', { name: '知识库', exact: true }).click();
  await page.getByRole('link', { name: '特发性睡眠增多（特发性嗜睡）', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/wiki\/idiopathic-hypersomnia\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('特发性睡眠增多（特发性嗜睡）');
  await expect(page.getByRole('button', { name: 'Switch to English' })).toBeDisabled();
  await expect(page.getByText('本文暂无英文版本', { exact: false })).toBeVisible();
  await page
    .getByRole('navigation', { name: '文章目录' })
    .getByRole('link', { name: '诊断', exact: true })
    .click();
  await expect(page).toHaveURL(/#heading-/);
  await page.locator('[data-footnote-ref]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#source-fn-wiki$/);
  await page.locator('#source-fn-wiki [data-footnote-backref]').first().click();
  await expect(page).toHaveURL(/#source-fnref-wiki$/);
  await expect(page.locator('[data-footnotes] li')).toHaveCount(6);
  await expect(page.locator('[data-footnotes] ol')).toHaveCSS('list-style-type', 'decimal');
  await expect(page.getByRole('heading', { name: '参考文献', exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: '查看英文栏目' }).click();
  await expect(page).toHaveURL(/\/en\/wiki\/$/);
  await expect(page.getByText('No published content yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Blog', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blog');
  expect(errors).toEqual([]);
});

test('capture the wiki article for visual review', async ({ page }, testInfo) => {
  await page.goto(article);
  await page.screenshot({ path: testInfo.outputPath('wiki.png'), fullPage: true });
  await page.screenshot({ path: testInfo.outputPath('wiki-top.png') });
  await page.locator('.markdown-table').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('wiki-table.png') });
});

test('unpublished and absent language routes remain actual 404s', async ({ page }) => {
  for (const route of [
    './en/wiki/idiopathic-hypersomnia/',
    './en/wiki/__empty__/',
    './zh/blog/__empty__/',
    './zh/blog/missing/',
  ]) {
    expect((await page.goto(route))?.status()).toBe(404);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  }
});

test.describe('Markdown without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('static article contains readable content, TOC, sources and truthful SEO', async ({
    page,
  }) => {
    expect((await page.goto(article))?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.markdown-table table')).toBeVisible();
    await expect(page.locator('[data-footnotes] li')).toHaveCount(6);
    await expect(page.locator('link[rel=alternate][hreflang=en]')).toHaveCount(0);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      /\/zh\/wiki\/idiopathic-hypersomnia\/$/,
    );
    await page
      .getByRole('navigation', { name: '文章目录' })
      .getByRole('link', { name: '症状与表现' })
      .click();
    await expect(page).toHaveURL(/#heading-/);
    await page.locator('[data-footnote-ref]').first().click();
    await expect(page).toHaveURL(/#source-fn-wiki$/);
    await page.locator('#source-fn-wiki [data-footnote-backref]').first().click();
    await expect(page).toHaveURL(/#source-fnref-wiki$/);
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeDisabled();
  });
});
