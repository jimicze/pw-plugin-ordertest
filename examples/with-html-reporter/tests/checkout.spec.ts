import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test('fill in shipping details', async ({ page }) => {
    // The HTML report will show this under project "ordertest:checkout-flow:2"
    expect(true).toBe(true);
  });

  test('confirm order', async ({ page }) => {
    expect(true).toBe(true);
  });
});
