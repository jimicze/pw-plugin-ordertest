import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * Basic serial execution example.
 *
 * Tests run in strict file order: auth → cart → checkout.
 * Each file waits for the previous one to complete before starting.
 * All tests run on a single worker (workers: 1).
 */
export default defineOrderedConfig({
  testDir: './tests',
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
