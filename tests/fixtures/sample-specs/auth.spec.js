import fs from 'node:fs';
import { test } from '@playwright/test';

function record(testName) {
  const outputFile = process.env.ORDERTEST_TEST_OUTPUT_FILE;
  if (outputFile) {
    const entry = `${JSON.stringify({ file: 'auth.spec.js', test: testName, timestamp: Date.now() })}\n`;
    fs.appendFileSync(outputFile, entry);
  }
}

test('auth login', () => {
  record('auth login');
});

test('auth logout', () => {
  record('auth logout');
});
