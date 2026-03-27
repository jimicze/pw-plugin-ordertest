import { defineOrderedConfig } from '@playwright-ordertest/core';

export default defineOrderedConfig({
  testDir: './tests',
  orderedTests: {
    sequences: [
      {
        name: 'api-flow',
        mode: 'parallel',
        files: ['setup.spec.ts', 'api-tests.spec.ts', 'teardown.spec.ts'],
      },
    ],
  },
});
