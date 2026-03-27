import fs from 'node:fs';
import { test } from '@playwright/test';

function record(testName) {
  const outputFile = process.env.ORDERTEST_TEST_OUTPUT_FILE;
  if (outputFile) {
    const entry = `${JSON.stringify({ file: 'cart.spec.js', test: testName, timestamp: Date.now() })}\n`;
    fs.appendFileSync(outputFile, entry);
  }
}

test('add to cart', () => {
  record('add to cart');
});

test('remove from cart', () => {
  record('remove from cart');
});
