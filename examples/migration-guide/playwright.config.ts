/**
 * AFTER: Migrated to @playwright-ordertest/core.
 *
 * Changes from the standard config:
 * 1. Import defineOrderedConfig instead of defineConfig
 * 2. Add orderedTests.sequences to define file ordering
 * 3. Everything else (retries, reporter, etc.) stays the same!
 *
 * The plugin generates Playwright projects with dependencies to
 * enforce the order. All standard Playwright features still work.
 */
import { defineOrderedConfig } from '@playwright-ordertest/core';

export default defineOrderedConfig({
  testDir: './tests',
  retries: 1,
  reporter: [['html', { open: 'never' }]],

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
