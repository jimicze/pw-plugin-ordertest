import { test, expect } from '@playwright/test';

test.describe('checkout', () => {
  // INCLUDED — has @smoke tag, matches the tag filter
  test('fill shipping address @smoke', async ({ page }) => {
    await page.goto('/checkout/shipping');
    await page.getByLabel('Full name').fill('Jane Doe');
    await page.getByLabel('Address line 1').fill('123 Main St');
    await page.getByLabel('City').fill('Springfield');
    await page.getByLabel('Postal code').fill('12345');
    await page.getByRole('combobox', { name: 'Country' }).selectOption('US');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page).toHaveURL('/checkout/payment');
  });

  // INCLUDED — has @smoke tag, matches the tag filter
  test('select payment method @smoke', async ({ page }) => {
    await page.goto('/checkout/payment');
    await page.getByRole('radio', { name: 'Credit card' }).check();
    await page.getByLabel('Card number').fill('4242 4242 4242 4242');
    await page.getByLabel('Expiry').fill('12/26');
    await page.getByLabel('CVC').fill('123');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL('/checkout/confirmation');
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  });

  // EXCLUDED — no @smoke tag
  test('apply promo code', async ({ page }) => {
    await page.goto('/checkout/payment');
    await page.getByRole('button', { name: 'Add promo code' }).click();
    await page.getByLabel('Promo code').fill('SAVE10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('discount-line')).toContainText('-10%');
    await expect(page.getByTestId('order-total')).not.toContainText('$0.00');
  });

  // EXCLUDED — no @smoke tag
  test('gift wrapping option', async ({ page }) => {
    await page.goto('/checkout/shipping');
    await page.getByRole('checkbox', { name: 'Add gift wrapping' }).check();
    await page.getByLabel('Gift message').fill('Happy birthday!');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByTestId('order-summary')).toContainText('Gift wrapping');
  });
});
