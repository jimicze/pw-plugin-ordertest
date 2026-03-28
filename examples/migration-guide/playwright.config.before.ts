/**
 * BEFORE: Standard Playwright config.
 *
 * This config has NO ordering guarantees. Playwright runs test files
 * in alphabetical order and may parallelize across workers.
 *
 * This file is NOT used — it's here to show what the config looked
 * like before migrating to @playwright-ordertest/core.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  retries: 1,
  workers: 4,
  reporter: [['html', { open: 'never' }]],

  // Problem: No way to enforce auth → cart → checkout order.
  // Playwright runs files alphabetically and may split across workers.
});
