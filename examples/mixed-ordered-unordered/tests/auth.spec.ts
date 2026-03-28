// Part of the ordered checkout-flow sequence
// This test runs first — cart.spec.ts depends on auth completing successfully.
import { expect, test } from '@playwright/test';

test('user logs in', async ({ page }) => {
  await page.goto('https://example.com/login');

  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('supersecret');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL('https://example.com/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
