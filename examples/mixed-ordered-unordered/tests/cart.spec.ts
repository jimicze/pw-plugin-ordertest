// Part of the ordered checkout-flow sequence — runs after auth.spec.ts
// Playwright will not start this project until the auth project has passed.
import { expect, test } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  await page.goto('https://example.com/shop');

  await page.getByText('Wireless Headphones').click();
  await expect(page.getByRole('heading', { name: 'Wireless Headphones' })).toBeVisible();

  await page.getByRole('button', { name: 'Add to cart' }).click();

  await expect(page.getByRole('status')).toContainText('Item added to cart');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
