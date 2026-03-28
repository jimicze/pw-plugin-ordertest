import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * HTML Reporter compatibility example.
 *
 * Demonstrates that Playwright's built-in HTML reporter works out of the box
 * with ordered test projects. No custom reporter needed!
 *
 * The generated project names (e.g., "ordertest:checkout-flow:0") appear
 * naturally in the HTML report, giving you full visibility into execution order.
 */
export default defineOrderedConfig({
  testDir: './tests',

  // Standard Playwright HTML reporter — works perfectly with ordered tests
  reporter: [['html', { open: 'never' }]],

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
