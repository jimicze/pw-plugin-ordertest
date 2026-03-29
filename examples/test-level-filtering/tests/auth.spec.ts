import { expect, test } from '@playwright/test';

test.describe('auth', () => {
  // INCLUDED — matches tests[] filter: 'login with valid credentials'
  test('login with valid credentials', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/inventory/);
  });

  // INCLUDED — matches tests[] filter: 'verify inventory page loads'
  test('verify inventory page loads', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page.locator('.title')).toHaveText('Products');
    await expect(page.locator('.inventory_item')).toHaveCount(6);
  });

  // EXCLUDED — not listed in tests[] filter
  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="username"]').fill('locked_out_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page.locator('[data-test="error"]')).toBeVisible();
  });

  // EXCLUDED — not listed in tests[] filter
  test('username field is required', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="login-button"]').click();
    await expect(page.locator('[data-test="error"]')).toContainText('Username is required');
  });
});
