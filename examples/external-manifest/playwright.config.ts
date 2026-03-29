import { defineOrderedConfigAsync } from '@jimicze-pw/ordertest-core';

/**
 * External manifest example.
 *
 * Sequences are defined in ordertest.config.json instead of inline.
 * This is useful for:
 * - Separating test ordering from Playwright configuration
 * - Sharing sequence definitions across multiple configs
 * - Generating manifest files from CI pipelines or other tools
 *
 * Uses defineOrderedConfigAsync because manifest loading is async.
 *
 * Demo site: https://www.saucedemo.com
 * Login: standard_user / secret_sauce
 */
export default defineOrderedConfigAsync({
  testDir: './tests',
  use: {
    baseURL: 'https://www.saucedemo.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  orderedTests: {
    manifest: './ordertest.config.json',
  },
});
