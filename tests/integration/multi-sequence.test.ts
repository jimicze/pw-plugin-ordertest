import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

interface TestRecord {
  file: string;
  test: string;
  timestamp: number;
}

function makeTempOutputFile(): string {
  return path.join(
    os.tmpdir(),
    `ordertest-${Date.now().toString()}-${Math.random().toString(36).slice(2)}.ndjson`,
  );
}

function runPlaywright(
  configPath: string,
  outputFile: string,
  extraEnv: Record<string, string> = {},
): void {
  execSync(`npx playwright test --config "${configPath}"`, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ORDERTEST_TEST_OUTPUT_FILE: outputFile, ...extraEnv },
    stdio: 'pipe',
  });
}

function readOutput(outputFile: string): TestRecord[] {
  if (!fs.existsSync(outputFile)) return [];
  const content = fs.readFileSync(outputFile, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').map((line) => JSON.parse(line) as TestRecord);
}

function maxTimestamp(records: TestRecord[]): number {
  return Math.max(...records.map((r) => r.timestamp));
}

function minTimestamp(records: TestRecord[]): number {
  return Math.min(...records.map((r) => r.timestamp));
}

// ---------------------------------------------------------------------------
// Multi-sequence reporter tests
// ---------------------------------------------------------------------------

test.describe('reporter — multi-sequence', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60000);

  const MULTI_CONFIG = path.join(
    PROJECT_ROOT,
    'tests/fixtures/configs/multi-sequence/playwright.config.js',
  );

  let outputFile: string;

  test.beforeEach(() => {
    outputFile = makeTempOutputFile();
  });

  test.afterEach(() => {
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
  });

  test('both checkout-flow and profile-flow sequences run', () => {
    runPlaywright(MULTI_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const files = new Set(records.map((r) => r.file));
    expect(files.has('auth.spec.js')).toBe(true);
    expect(files.has('cart.spec.js')).toBe(true);
    expect(files.has('checkout.spec.js')).toBe(true);
    expect(files.has('profile.spec.js')).toBe(true);
  });

  test('checkout-flow order is preserved (auth → cart → checkout)', () => {
    runPlaywright(MULTI_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const authRecords = records.filter((r) => r.file === 'auth.spec.js');
    const cartRecords = records.filter((r) => r.file === 'cart.spec.js');
    const checkoutRecords = records.filter((r) => r.file === 'checkout.spec.js');

    expect(authRecords.length).toBeGreaterThan(0);
    expect(cartRecords.length).toBeGreaterThan(0);
    expect(checkoutRecords.length).toBeGreaterThan(0);
    expect(maxTimestamp(authRecords)).toBeLessThanOrEqual(minTimestamp(cartRecords));
    expect(maxTimestamp(cartRecords)).toBeLessThanOrEqual(minTimestamp(checkoutRecords));
  });

  test('all 8 tests from both sequences are present', () => {
    runPlaywright(MULTI_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const testNames = records.map((r) => r.test);
    // checkout-flow tests
    expect(testNames).toContain('auth login');
    expect(testNames).toContain('auth logout');
    expect(testNames).toContain('add to cart');
    expect(testNames).toContain('remove from cart');
    expect(testNames).toContain('checkout payment');
    expect(testNames).toContain('checkout confirmation');
    // profile-flow tests
    expect(testNames).toContain('view profile');
    expect(testNames).toContain('edit profile');
  });
});

// ---------------------------------------------------------------------------
// Manifest-flow reporter tests
// ---------------------------------------------------------------------------

test.describe('reporter — manifest-flow', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60000);

  const MANIFEST_CONFIG = path.join(
    PROJECT_ROOT,
    'tests/fixtures/configs/manifest-flow/playwright.config.js',
  );

  let outputFile: string;

  test.beforeEach(() => {
    outputFile = makeTempOutputFile();
  });

  test.afterEach(() => {
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
  });

  test('manifest-flow loads external JSON manifest and runs tests', () => {
    runPlaywright(MANIFEST_CONFIG, outputFile);
    const records = readOutput(outputFile);

    // Manifest defines checkout-flow: auth → cart → checkout
    const ordered = records.filter((r) =>
      ['auth.spec.js', 'cart.spec.js', 'checkout.spec.js'].includes(r.file),
    );
    expect(ordered).toHaveLength(6);
  });

  test('manifest-flow: auth completes before cart starts', () => {
    runPlaywright(MANIFEST_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const authRecords = records.filter((r) => r.file === 'auth.spec.js');
    const cartRecords = records.filter((r) => r.file === 'cart.spec.js');

    expect(authRecords.length).toBeGreaterThan(0);
    expect(cartRecords.length).toBeGreaterThan(0);
    expect(maxTimestamp(authRecords)).toBeLessThanOrEqual(minTimestamp(cartRecords));
  });

  test('manifest-flow: cart completes before checkout starts', () => {
    runPlaywright(MANIFEST_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const cartRecords = records.filter((r) => r.file === 'cart.spec.js');
    const checkoutRecords = records.filter((r) => r.file === 'checkout.spec.js');

    expect(cartRecords.length).toBeGreaterThan(0);
    expect(checkoutRecords.length).toBeGreaterThan(0);
    expect(maxTimestamp(cartRecords)).toBeLessThanOrEqual(minTimestamp(checkoutRecords));
  });

  test('manifest-flow: all expected test names are present', () => {
    runPlaywright(MANIFEST_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const testNames = records.map((r) => r.test);
    expect(testNames).toContain('auth login');
    expect(testNames).toContain('auth logout');
    expect(testNames).toContain('add to cart');
    expect(testNames).toContain('remove from cart');
    expect(testNames).toContain('checkout payment');
    expect(testNames).toContain('checkout confirmation');
  });
});
