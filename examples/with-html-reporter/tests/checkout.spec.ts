import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test('fill in shipping details', async ({ page }) => {
    // The HTML report will show this under project "ordertest:checkout-flow:2"
    await page.goto('https://example-shop.test/checkout/shipping');

    await page.getByLabel('Full name').fill('Jane Doe');
    await page.getByLabel('Address line 1').fill('123 Main Street');
    await page.getByLabel('City').fill('Springfield');
    await page.getByLabel('Postal code').fill('12345');
    await page.getByLabel('Country').selectOption('US');

    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page).toHaveURL('/checkout/payment');
    await expect(page.getByText('Shipping to: 123 Main Street')).toBeVisible();
  });

  test('confirm order', async ({ page }) => {
    await page.goto('https://example-shop.test/checkout/payment');

    await page.getByLabel('Card number').fill('4242 4242 4242 4242');
    await page.getByLabel('Expiry date').fill('12/28');
    await page.getByLabel('CVC').fill('123');

    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page).toHaveURL('/checkout/confirmation');
    await expect(page.getByRole('heading', { name: 'Order confirmed!' })).toBeVisible();
    await expect(page.getByTestId('order-number')).toBeVisible();
  });
});
