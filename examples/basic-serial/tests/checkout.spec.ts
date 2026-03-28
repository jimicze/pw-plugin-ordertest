import { test, expect } from '@playwright/test';

test('enter shipping address', async ({ page }) => {
  // Runs only after ALL cart.spec.ts tests pass
  await page.goto('https://www.example.com/checkout/shipping');

  await expect(page).toHaveTitle(/Shipping Address/);

  await page.locator('#first-name').fill('Jane');
  await page.locator('#last-name').fill('Doe');
  await page.locator('#address-line-1').fill('123 Main Street');
  await page.locator('#city').fill('Springfield');
  await page.locator('#state').selectOption('IL');
  await page.locator('#zip').fill('62701');
  await page.locator('#country').selectOption('US');

  await page.locator('button[data-action="continue-to-payment"]').click();

  await expect(page).toHaveURL('https://www.example.com/checkout/payment');
  await expect(page.locator('.shipping-summary-address')).toContainText('123 Main Street');
});

test('complete purchase', async ({ page }) => {
  await page.goto('https://www.example.com/checkout/payment');

  await expect(page).toHaveTitle(/Payment/);

  await page.locator('#card-number').fill('4111 1111 1111 1111');
  await page.locator('#card-expiry').fill('12/28');
  await page.locator('#card-cvc').fill('123');
  await page.locator('#name-on-card').fill('Jane Doe');

  await page.locator('button[data-action="place-order"]').click();

  await expect(page).toHaveURL(/\/order-confirmation\//);
  await expect(page).toHaveTitle(/Order Confirmed/);
  await expect(page.locator('.confirmation-heading')).toContainText('Thank you for your order');
  await expect(page.locator('.order-number')).toBeVisible();
});
