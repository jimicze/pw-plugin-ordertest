import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * CI sharding example.
 *
 * Demonstrates how the shard guard protects ordered sequences when running
 * with Playwright's --shard flag. The "collapse" strategy (default) merges
 * chained projects into a single atomic project so the entire sequence
 * lands on one shard and the declared order is preserved.
 *
 * Ordered tests: auth → cart → checkout (serial checkout flow)
 * Unordered tests: homepage, search (distribute across shards normally)
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
    // Explicitly set 'collapse' to make the shard strategy visible.
    // This is the default — you can omit it and get the same behavior.
    shardStrategy: 'collapse',
    sequences: [
      {
        name: 'checkout-flow',
        mode: 'serial',
        files: ['auth.spec.ts', 'cart.spec.ts', 'checkout.spec.ts'],
      },
    ],
  },
});
