import { test, expect } from '@playwright/test';

test('update display name', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Display name').fill('Jane Doe');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('change email address', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Email address').fill('jane.doe@example.com');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
});
