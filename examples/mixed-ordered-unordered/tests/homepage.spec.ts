// NOT in any sequence — runs in the "ordertest:unordered" project
// with standard Playwright parallelization alongside search.spec.ts.
import { expect, test } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('https://example.com');

  await expect(page).toHaveTitle(/Example Store/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shop' })).toBeVisible();
});

test('navigation menu works', async ({ page }) => {
  await page.goto('https://example.com');

  await page.getByRole('link', { name: 'Shop' }).click();
  await expect(page).toHaveURL('https://example.com/shop');

  await page.goBack();
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL('https://example.com/about');
});
