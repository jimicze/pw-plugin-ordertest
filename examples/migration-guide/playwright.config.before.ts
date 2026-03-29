/**
 * BEFORE: Standard Playwright config.
 *
 * This config has NO ordering guarantees. Playwright runs test files
 * in alphabetical order and may parallelize across workers.
 *
 * This file is NOT used — it's here to show what the config looked
 * like before migrating to @jimicze-pw/ordertest-core.
 *
 * Problem: auth.spec.ts, cart.spec.ts, and checkout.spec.ts each
 * need to run in sequence against https://www.saucedemo.com, but
 * without ordering, Playwright may run them in any order or in
 * parallel — causing failures when checkout runs before auth.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  retries: 1,
  workers: 4,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'https://www.saucedemo.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Problem: No way to enforce auth → cart → checkout order.
  // Playwright runs files alphabetically and may split across workers.
});
