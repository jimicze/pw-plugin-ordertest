import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * Multiple sequences example.
 *
 * Two independent ordered sequences in one config:
 * - checkout-flow: serial (auth → cart → checkout)
 * - profile-flow: parallel (settings → avatar)
 *
 * Each sequence builds its own project dependency chain.
 * The two chains are independent — they don't block each other.
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
      {
        name: 'profile-flow',
        mode: 'parallel',
        files: ['settings.spec.ts', 'avatar.spec.ts'],
      },
    ],
  },
});
