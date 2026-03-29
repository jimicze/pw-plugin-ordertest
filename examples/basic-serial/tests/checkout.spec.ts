import { expect, test } from '@playwright/test';

test('complete purchase', async ({ page }) => {
  // Runs only after ALL cart.spec.ts tests pass
  // Each spec file re-does the prior steps since tests run in separate projects
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  await page.locator('.shopping_cart_link').click();

  // Proceed to checkout
  await page.locator('[data-test="checkout"]').click();
  await page.locator('[data-test="firstName"]').fill('John');
  await page.locator('[data-test="lastName"]').fill('Doe');
  await page.locator('[data-test="postalCode"]').fill('12345');
  await page.locator('[data-test="continue"]').click();

  // Verify order summary
  await expect(page).toHaveURL(/checkout-step-two/);
  await expect(page.locator('.inventory_item_name')).toHaveText('Sauce Labs Backpack');

  // Finish the order
  await page.locator('[data-test="finish"]').click();
  await expect(page.locator('.complete-header')).toHaveText('Thank you for your order!');
});
