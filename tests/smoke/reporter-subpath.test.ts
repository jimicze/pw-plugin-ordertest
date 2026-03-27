/**
 * Smoke test: verify the ./reporter subpath export works from the built dist/.
 *
 * Users import the reporter as:
 *   reporter: [['@playwright-ordertest/core/reporter']]
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
  '../../dist/reporter/orderedHtmlReporter.js',
);

// Skip all smoke tests if dist/ hasn't been built yet
test.skip(!fs.existsSync(REPORTER_PATH), 'dist/ not built — run `pnpm build` first');

// biome-ignore lint/suspicious/noExplicitAny: dynamic import returns unknown shape
let reporterModule: any;

test.beforeAll(async () => {
  reporterModule = await import(REPORTER_PATH);
});

// ---------------------------------------------------------------------------
// Reporter subpath export
// ---------------------------------------------------------------------------

test.describe('reporter subpath — default export', () => {
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
      logLevel: 'silent',
      showSequenceTimeline: true,
      showSequenceInTestTitle: false,
    });
    expect(instance).toBeDefined();
  });
});

test.describe('reporter subpath — Reporter interface methods', () => {
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

test.describe('reporter subpath — named exports', () => {
  test('exports OrderedHtmlReporterOptions type (as a module key)', () => {
    // Named type exports don't appear as runtime values,
    // but the module should at least import without errors
    expect(reporterModule).toBeDefined();
  });
});
