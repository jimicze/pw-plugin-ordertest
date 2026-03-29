import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * Multiple sequences example.
 *
 * Two independent ordered sequences in one config:
 * - checkout-flow: serial (auth → cart → checkout)
 * - inventory-flow: parallel (sort-products → product-details)
 *
 * Each sequence builds its own project dependency chain.
 * The two chains are independent — they don't block each other.
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
        files: ['auth.spec.ts', 'cart.spec.ts', 'checkout.spec.ts'],
      },
      {
        name: 'inventory-flow',
        mode: 'parallel',
        files: ['sort-products.spec.ts', 'product-details.spec.ts'],
      },
    ],
  },
});
