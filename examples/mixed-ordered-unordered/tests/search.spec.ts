// Also unordered — runs independently, possibly in parallel with homepage.spec.ts.
// This file is not part of any defineOrderedConfig sequence.
import { expect, test } from '@playwright/test';

test('search returns results', async ({ page }) => {
  await page.goto('https://example.com/search');

  await page.getByRole('searchbox', { name: 'Search' }).fill('headphones');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.getByTestId('search-results')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(5);
});

test('search handles empty query', async ({ page }) => {
  await page.goto('https://example.com/search');

  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.getByTestId('search-results')).not.toBeVisible();
  await expect(page.getByText('Please enter a search term')).toBeVisible();
});
