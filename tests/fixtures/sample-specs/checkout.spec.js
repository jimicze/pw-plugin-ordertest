import fs from 'node:fs';
import { test } from '@playwright/test';

function record(testName) {
  const outputFile = process.env.ORDERTEST_TEST_OUTPUT_FILE;
  if (outputFile) {
    const entry = `${JSON.stringify({ file: 'checkout.spec.js', test: testName, timestamp: Date.now() })}\n`;
    fs.appendFileSync(outputFile, entry);
  }
}

test('checkout payment', () => {
  record('checkout payment');
});

test('checkout confirmation', () => {
  record('checkout confirmation');
});
