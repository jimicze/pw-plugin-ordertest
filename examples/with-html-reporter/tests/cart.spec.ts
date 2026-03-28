import { test, expect } from '@playwright/test';

test.describe('Shopping Cart', () => {
  test('add product to cart', async ({ page }) => {
    // The HTML report will show this under project "ordertest:checkout-flow:1"
    await page.goto('https://example-shop.test/products/running-shoes');

    await expect(page.getByRole('heading', { name: 'Running Shoes' })).toBeVisible();
    await page.getByLabel('Size').selectOption('42');
    await page.getByRole('button', { name: 'Add to cart' }).click();

    await expect(page.getByRole('status')).toHaveText('Item added to your cart');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('update cart quantity', async ({ page }) => {
    await page.goto('https://example-shop.test/cart');

    // Verify the item is in the cart
    await expect(page.getByRole('row', { name: /Running Shoes/ })).toBeVisible();

    // Increase quantity to 2
    const quantityInput = page.getByRole('row', { name: /Running Shoes/ }).getByRole('spinbutton');
    await quantityInput.fill('2');
    await quantityInput.press('Tab');

    await expect(page.getByTestId('cart-subtotal')).toContainText('$');
    await expect(page.getByTestId('cart-count')).toHaveText('2');
  });
});
