import { test, expect } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByRole('status', { name: 'Cart' })).toContainText('1');
});

test('remove item from cart', async ({ page }) => {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();
});
