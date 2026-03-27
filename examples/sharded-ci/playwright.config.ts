import { defineOrderedConfig } from '@playwright-ordertest/core';

export default defineOrderedConfig({
  testDir: './tests',
  orderedTests: {
    // 'collapse' (default) merges the ordered chain into a single atomic project
    // when sharding is detected — this ensures the sequence lands on one shard.
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
