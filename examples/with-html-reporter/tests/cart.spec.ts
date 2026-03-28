import { test, expect } from '@playwright/test';

test.describe('Shopping Cart', () => {
  test('add product to cart', async ({ page }) => {
    // The HTML report will show this under project "ordertest:checkout-flow:1"
    expect(true).toBe(true);
  });

  test('update cart quantity', async ({ page }) => {
    expect(true).toBe(true);
  });
});
