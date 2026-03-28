import { test, expect } from '@playwright/test';

test('user can log in', async ({ page }) => {
  await page.goto('https://www.example.com/login');

  await expect(page).toHaveTitle(/Sign In/);

  await page.locator('#email').fill('testuser@example.com');
  await page.locator('#password').fill('SecurePass123!');
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL('https://www.example.com/dashboard');
  await expect(page.locator('.welcome-message')).toContainText('Welcome back');
});

test('user session is active after login', async ({ page }) => {
  await page.goto('https://www.example.com/account');

  await expect(page).toHaveURL('https://www.example.com/account');
  await expect(page).toHaveTitle(/My Account/);

  await expect(page.locator('.account-email')).toHaveText('testuser@example.com');
  await expect(page.locator('.session-status')).toHaveAttribute('data-active', 'true');
});
