import { defineOrderedConfigAsync } from '@playwright-ordertest/core';

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
 */
export default defineOrderedConfigAsync({
  testDir: './tests',
  orderedTests: {
    manifest: './ordertest.config.json',
  },
});
