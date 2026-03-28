import { test, expect } from '@playwright/test';

test('complete purchase', async ({ page }) => {
  await page.goto('/cart');

  await page.getByRole('button', { name: 'Proceed to checkout' }).click();

  await expect(page).toHaveURL('/checkout');

  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.getByLabel('Expiry').fill('12/28');
  await page.getByLabel('CVC').fill('123');
  await page.getByLabel('Name on card').fill('Jane Doe');

  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page).toHaveURL(/\/order-confirmation/);
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await expect(page.getByText('confirmation email')).toBeVisible();
});
