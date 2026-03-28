import { test, expect } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  await page.goto('/products');

  await page.getByRole('button', { name: 'Add to cart' }).first().click();

  await expect(page.getByRole('status', { name: 'Cart' })).toContainText('1');

  await page.getByRole('link', { name: 'View cart' }).click();
  await expect(page).toHaveURL('/cart');
  await expect(page.getByRole('listitem').first()).toBeVisible();
});
