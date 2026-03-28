import { defineOrderedConfig } from '@playwright-ordertest/core';

/**
 * Mixed ordered + unordered tests example.
 *
 * Some test files are ordered (the checkout flow), while others
 * run independently in the "ordertest:unordered" project.
 *
 * Any .spec.ts file NOT listed in a sequence automatically goes
 * into the unordered project with standard Playwright behavior.
 */
export default defineOrderedConfig({
  testDir: './tests',
  orderedTests: {
    sequences: [
      {
        name: 'checkout-flow',
        mode: 'serial',
        files: ['auth.spec.ts', 'cart.spec.ts'],
      },
    ],
  },
});
