/**
 * AFTER: Migrated to @jimicze-pw/ordertest-core.
 *
 * Changes from the standard config:
 * 1. Import defineOrderedConfig instead of defineConfig
 * 2. Add orderedTests.sequences to define file ordering
 * 3. Everything else (retries, reporter, baseURL, etc.) stays the same!
 *
 * The plugin generates Playwright projects with dependencies to
 * enforce the order. All standard Playwright features still work.
 *
 * Demo site: https://www.saucedemo.com
 * Login: standard_user / secret_sauce
 */
import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

export default defineOrderedConfig({
  testDir: './tests',
  retries: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'https://www.saucedemo.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // This is the only new section — everything else is standard Playwright config
  orderedTests: {
    sequences: [
      {
        name: 'checkout-flow',
        mode: 'serial',
        files: ['auth.spec.ts', 'cart.spec.ts', 'checkout.spec.ts'],
      },
    ],
  },
});
