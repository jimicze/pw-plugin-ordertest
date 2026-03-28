import { test, expect } from '@playwright/test';

// All tests run — no filter applied (simple string entry in the manifest)
test.describe('cart', () => {
  test('add item to cart', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await expect(page.getByRole('status')).toContainText('Item added to cart');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('remove item from cart', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByTestId('cart-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect(page.getByTestId('cart-item')).toHaveCount(0);
    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });

  test('cart persists across page refresh', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await page.reload();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await page.goto('/cart');
    await expect(page.getByTestId('cart-item')).toHaveCount(1);
  });
});
