import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * Mixed ordered + unordered tests example.
 *
 * Some test files are ordered (the checkout flow), while others
 * run independently in the "ordertest:unordered" project.
 *
 * Any .spec.ts file NOT listed in a sequence automatically goes
 * into the unordered project with standard Playwright behavior.
 *
 * Ordered tests: auth.spec.ts → cart.spec.ts (login + add to cart on saucedemo)
 * Unordered tests: homepage.spec.ts (product listing) and search.spec.ts (product sorting)
 *   run independently, in no guaranteed order.
 *
 * Demo site: https://www.saucedemo.com
 * Login: standard_user / secret_sauce
 */
export default defineOrderedConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://www.saucedemo.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
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
