import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user logs in with valid credentials', async ({ page }) => {
    // The HTML report will show this under project "ordertest:checkout-flow:0"
    await page.goto('https://example-shop.test/login');

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('correct-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('login session persists', async ({ page }) => {
    await page.goto('https://example-shop.test/login');

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('correct-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/dashboard');

    // Navigate away and return — session cookie should keep the user logged in
    await page.goto('https://example-shop.test/products');
    await page.goto('https://example-shop.test/dashboard');

    await expect(page.getByTestId('user-avatar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
