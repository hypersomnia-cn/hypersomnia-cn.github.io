import { test, expect } from '@playwright/test';
test('ESS independent flow, missing answers, bilingual results, reset and privacy', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url());
  });
  await page.goto('./zh/');
  await expect(page.locator('.scale-card')).toHaveCount(4);
  await page.locator('.card-ess .card-link').click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  await page.getByRole('button', { name: '查看结果' }).click();
  await expect(page.locator('.error-summary')).toBeVisible();
  await expect(page.getByTestId('score')).toHaveCount(0);
  for (const field of await page.locator('fieldset').all())
    await field.locator('input[type=radio]').first().check();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('input[type=radio]:checked')).toHaveCount(8);
  await page.getByRole('button', { name: 'View results' }).click();
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(
    page.getByRole('heading', { name: 'Lower normal daytime sleepiness' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '切换为中文' }).click();
  await expect(page.getByTestId('score')).toHaveText('0');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.getByRole('button', { name: 'Edit answers' }).click();
  await page.locator('fieldset').first().locator('input[type=radio]').last().check();
  await page.getByRole('button', { name: 'View results' }).click();
  await expect(page.getByTestId('score')).toHaveText('3');
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(page.locator('input:checked')).toHaveCount(0);
  await page.locator('fieldset').first().locator('input[type=radio]').first().check();
  await page.reload();
  await expect(page.locator('input:checked')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  expect(writes).toEqual([]);
  await page.getByRole('link', { name: 'All questionnaires' }).click();
  await page.locator('.card-fss .card-link').click();
  await expect(page.locator('input:checked')).toHaveCount(0);
  await page.locator('fieldset').first().locator('input').first().check();
  await page.getByRole('link', { name: 'All questionnaires' }).click();
  await page.locator('.card-fss .card-link').click();
  await expect(page.locator('input:checked')).toHaveCount(0);
});
test('PSQI zeros and contradictory schedule', async ({ page }) => {
  await page.goto('./zh/scales/psqi/');
  await page.locator('#field-q1 input').fill('23:00');
  await page.locator('#field-q2 input').fill('10');
  await page.locator('#field-q3 input').fill('23:00');
  await page.locator('#field-q4 input').fill('8');
  for (const field of await page.locator('fieldset:has(input[type=radio])').all()) {
    const id = await field.getAttribute('id');
    if (id !== 'field-q5j' && !id?.startsWith('field-q10'))
      await field.locator('input').first().check();
  }
  await page.getByRole('button', { name: '查看结果' }).click();
  await expect(page.locator('#error-q3')).toBeVisible();
  await page.locator('#field-q3 input').fill('07:00');
  await page.getByRole('button', { name: '查看结果' }).click();
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.locator('.component')).toHaveCount(7);
});
test('static routes and responsive layout', async ({ page }) => {
  for (const url of [
    './',
    ...['zh', 'en'].flatMap((lang) => [
      `./${lang}/`,
      ...['ess', 'ihss', 'fss', 'psqi'].map((id) => `./${lang}/scales/${id}/`),
    ]),
  ]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await page.locator('body').evaluate((el) => {
    el.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('keyboard can choose and submit ESS', async ({ page }) => {
  await page.goto('./zh/scales/ess/');
  for (const field of await page.locator('fieldset').all()) {
    await field.locator('input').first().focus();
    await page.keyboard.press('Space');
  }
  await page.getByRole('button', { name: '查看结果' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('score')).toHaveText('0');
});
test('FSS mean and IHSS maximum', async ({ page }) => {
  await page.goto('./zh/scales/fss/');
  for (const field of await page.locator('fieldset').all())
    await field.locator('input').first().check();
  await page.locator('fieldset').first().locator('input').nth(1).check();
  await page.getByRole('button', { name: '查看结果' }).click();
  await expect(page.getByTestId('score')).toHaveText('1.11');
  await page.goto('./zh/scales/ihss/');
  for (const field of await page.locator('fieldset').all())
    await field.locator('input').last().check();
  await page.getByRole('button', { name: '查看结果' }).click();
  await expect(page.getByTestId('score')).toHaveText('50');
});
test('capture homepage and result for visual review', async ({ page }, testInfo) => {
  await page.goto('./zh/');
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.goto('./zh/scales/ess/');
  for (const field of await page.locator('fieldset').all())
    await field.locator('input').first().check();
  await page.getByRole('button', { name: '查看结果' }).click();
  await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true });
});
test('plain homepage and complete locale lifecycle', async ({ page }) => {
  await page.goto('./en/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Adult Sleepiness Questionnaires',
  );
  await expect(page).toHaveTitle('Adult Sleepiness Questionnaires');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.locator('.hero,.home-notes,.card-icon,.card-index,.scale-abbreviation'),
  ).toHaveCount(0);
  await expect(page.getByText('Complete questionnaire', { exact: true })).toHaveCount(0);
  await page.locator('.card-ess').click();
  await expect(page).toHaveURL(/\/en\/scales\/ess\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Epworth Sleepiness Scale');
  await expect(page.locator('.assessment-meta')).toContainText('Estimated completion time:');
  await expect(page.locator('.assessment-meta')).toContainText('Assessment period:');
  await page.getByRole('button', { name: 'View results' }).click();
  await expect(page.locator('#error-q1')).toHaveText('Please provide a valid answer.');
  await page.getByRole('button', { name: '切换为中文' }).click();
  await expect(page.locator('#error-q1')).toHaveText('请完成此题并输入有效答案。');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('.assessment-meta')).toContainText('预估填写时间：');
  await expect(page.locator('.assessment-meta')).toContainText('评估时间范围：');
  await expect(page).toHaveURL(/\/zh\/scales\/ess\//);
  await page.getByRole('link', { name: '全部量表' }).click();
  await expect(
    page.getByRole('heading', { name: '特发性睡眠增多严重程度量表（IHSS）' }),
  ).toBeVisible();
  await expect(page.locator('.site-footer')).toContainText('参考声明');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Adult Sleepiness Questionnaires',
  );
  const response = await page.goto('./en/missing/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('页面未找到');
  await expect(page).toHaveTitle('页面未找到 | Page not found');
});
