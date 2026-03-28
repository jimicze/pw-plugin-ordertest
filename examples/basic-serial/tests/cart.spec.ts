import { test, expect } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  // Runs only after ALL auth.spec.ts tests pass
  await page.goto('https://www.example.com/products/wireless-headphones');

  await expect(page).toHaveTitle(/Wireless Headphones/);

  await page.locator('select#quantity').selectOption('1');
  await page.locator('button[data-action="add-to-cart"]').click();

  await expect(page.locator('.cart-notification')).toBeVisible();
  await expect(page.locator('.cart-notification')).toContainText('Item added to your cart');
  await expect(page.locator('.cart-count')).toHaveText('1');
});

test('cart shows correct total', async ({ page }) => {
  await page.goto('https://www.example.com/cart');

  await expect(page).toHaveTitle(/Your Cart/);

  const itemRow = page.locator('.cart-item').filter({ hasText: 'Wireless Headphones' });
  await expect(itemRow).toBeVisible();
  await expect(itemRow.locator('.cart-item-price')).toHaveText('$79.99');

  await expect(page.locator('.cart-subtotal')).toHaveText('$79.99');
  await expect(page.locator('.cart-tax')).toBeVisible();
  await expect(page.locator('.cart-total')).toContainText('$');
});
