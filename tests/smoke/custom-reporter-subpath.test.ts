/**
 * Smoke test: verify the ./custom-reporter subpath export works from the built dist/.
 *
 * Users import the reporter as:
 *   reporter: [['@playwright-ordertest/core/custom-reporter']]
 *
 * This test verifies that the dist output for that subpath is correct.
 *
 * Prerequisite: `pnpm build` must be run before these tests.
 */

import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const REPORTER_PATH = path.resolve(
  import.meta.dirname,
  '../../dist/reporter/customHtmlReporter.js',
);

// Skip all smoke tests if dist/ hasn't been built yet
test.skip(!fs.existsSync(REPORTER_PATH), 'dist/ not built — run `pnpm build` first');

// biome-ignore lint/suspicious/noExplicitAny: dynamic import returns unknown shape
let reporterModule: any;

test.beforeAll(async () => {
  reporterModule = await import(REPORTER_PATH);
});

// ---------------------------------------------------------------------------
// Custom reporter subpath export
// ---------------------------------------------------------------------------

test.describe('custom-reporter subpath — default export', () => {
  test('module has a default export', () => {
    expect(reporterModule.default).toBeDefined();
  });

  test('default export is a constructor function (class)', () => {
    expect(typeof reporterModule.default).toBe('function');
  });

  test('reporter can be instantiated without arguments', () => {
    const Reporter = reporterModule.default;
    const instance = new Reporter();
    expect(instance).toBeDefined();
  });

  test('reporter can be instantiated with options', () => {
    const Reporter = reporterModule.default;
    const instance = new Reporter({
      outputFile: 'custom-report.html',
      showTimeline: true,
      showSummary: true,
      showDependencyGraph: true,
      showShardDistribution: false,
      logLevel: 'silent',
    });
    expect(instance).toBeDefined();
  });
});

test.describe('custom-reporter subpath — Reporter interface methods', () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic import
  let instance: any;

  test.beforeAll(() => {
    const Reporter = reporterModule.default;
    instance = new Reporter({ logLevel: 'silent' });
  });

  test('has onBegin method', () => {
    expect(typeof instance.onBegin).toBe('function');
  });

  test('has onTestBegin method', () => {
    expect(typeof instance.onTestBegin).toBe('function');
  });

  test('has onTestEnd method', () => {
    expect(typeof instance.onTestEnd).toBe('function');
  });

  test('has onEnd method', () => {
    expect(typeof instance.onEnd).toBe('function');
  });

  test('has printsToStdio method', () => {
    expect(typeof instance.printsToStdio).toBe('function');
  });

  test('printsToStdio returns false', () => {
    expect(instance.printsToStdio()).toBe(false);
  });
});

test.describe('custom-reporter subpath — dist file presence', () => {
  test('ESM entry exists: dist/reporter/customHtmlReporter.js', () => {
    expect(fs.existsSync(REPORTER_PATH)).toBe(true);
  });

  test('CJS entry exists: dist/reporter/customHtmlReporter.cjs', () => {
    const cjsPath = REPORTER_PATH.replace('.js', '.cjs');
    expect(fs.existsSync(cjsPath)).toBe(true);
  });

  test('ESM types exist: dist/reporter/customHtmlReporter.d.ts', () => {
    const dtsPath = REPORTER_PATH.replace('.js', '.d.ts');
    expect(fs.existsSync(dtsPath)).toBe(true);
  });

  test('CJS types exist: dist/reporter/customHtmlReporter.d.cts', () => {
    const dctsPath = REPORTER_PATH.replace('.js', '.d.cts');
    expect(fs.existsSync(dctsPath)).toBe(true);
  });
});
