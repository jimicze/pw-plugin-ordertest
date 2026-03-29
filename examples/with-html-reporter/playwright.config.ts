import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * HTML Reporter compatibility example.
 *
 * Demonstrates that Playwright's built-in HTML reporter works out of the box
 * with ordered test projects. No custom reporter needed!
 *
 * The generated project names (e.g., "ordertest:checkout-flow:0") appear
 * naturally in the HTML report, giving you full visibility into execution order.
 *
 * Demo site: https://www.saucedemo.com
 * Login: standard_user / secret_sauce
 */
export default defineOrderedConfig({
  testDir: './tests',

  // Standard Playwright HTML reporter — works perfectly with ordered tests
  reporter: [['html', { open: 'never' }]],

  use: {
    baseURL: 'https://www.saucedemo.com',
    // trace and screenshot must be inside `use` — they are Playwright use options,
    // not root-level config fields. Placing them at root level has no effect.
    trace: 'on',
    screenshot: 'on',
  },

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
