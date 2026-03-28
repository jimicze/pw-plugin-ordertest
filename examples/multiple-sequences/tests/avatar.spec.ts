import { test, expect } from '@playwright/test';
import path from 'node:path';

test('upload avatar image', async ({ page }) => {
  // Runs only after settings.spec.ts completes (parallel mode preserves file order)
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Upload avatar' }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/avatar.png'));
  await expect(page.getByRole('img', { name: 'User avatar' })).toBeVisible();
});
