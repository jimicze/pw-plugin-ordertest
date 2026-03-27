import fs from 'node:fs';
import { test } from '@playwright/test';

function record(testName) {
  const outputFile = process.env.ORDERTEST_TEST_OUTPUT_FILE;
  if (outputFile) {
    const entry = `${JSON.stringify({ file: 'profile.spec.js', test: testName, timestamp: Date.now() })}\n`;
    fs.appendFileSync(outputFile, entry);
  }
}

test('view profile', () => {
  record('view profile');
});

test('edit profile', () => {
  record('edit profile');
});
