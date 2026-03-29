import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

/**
 * Test-level filtering example.
 *
 * Instead of running ALL tests in a file, you can select specific tests
 * by name or filter by tags using FileSpecification objects.
 *
 * This uses grep patterns under the hood — test names are matched
 * against the `test()` title.
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
        name: 'critical-path',
        mode: 'serial',
        files: [
          // Run only specific tests from auth.spec.ts by exact name
          {
            file: 'auth.spec.ts',
            tests: ['login with valid credentials', 'verify inventory page loads'],
          },
          // Run all tests in cart.spec.ts (simple string = all tests)
          'cart.spec.ts',
          // Run only @smoke-tagged tests from checkout.spec.ts
          {
            file: 'checkout.spec.ts',
            tags: ['@smoke'],
          },
        ],
      },
    ],
  },
});
