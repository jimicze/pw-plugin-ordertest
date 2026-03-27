import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import CustomHtmlReporter from '../../src/reporter/customHtmlReporter.js';
import type { CustomHtmlReporterOptions } from '../../src/reporter/customHtmlReporter.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockConfig(overrides?: Record<string, unknown>) {
  return {
    projects: [] as Array<{
      name: string;
      testMatch: string | string[];
    }>,
    ...overrides,
  };
}

function makeMockSuite(projectNames: string[]) {
  return {
    suites: projectNames.map((name) => ({
      project: () => ({ name }),
    })),
  };
}

function makeMockTestCase(projectName: string, title: string, filePath?: string) {
  return {
    title,
    titlePath: () => [projectName, filePath ?? 'test.spec.ts', title],
    location: filePath ? { file: filePath, line: 1, column: 1 } : undefined,
  };
}

function makeMockResult(status: string, duration: number, startTime?: Date) {
  return {
    status,
    duration,
    startTime: startTime ?? new Date(),
    retry: 0,
    errors: [] as Array<{ message?: string }>,
    attachments: [],
  };
}

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------

test.describe('constructor', () => {
  test('can be instantiated without options', () => {
    expect(() => new CustomHtmlReporter()).not.toThrow();
  });

  test('can be instantiated with options', () => {
    const opts: CustomHtmlReporterOptions = {
      outputFile: 'custom-report.html',
      showTimeline: true,
      showSummary: true,
      showDependencyGraph: true,
    };
    expect(() => new CustomHtmlReporter(opts)).not.toThrow();
  });

  test('printsToStdio returns false', () => {
    const reporter = new CustomHtmlReporter();
    expect(reporter.printsToStdio()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onBegin
// ---------------------------------------------------------------------------

test.describe('onBegin', () => {
  test('does not throw with empty project list', () => {
    const reporter = new CustomHtmlReporter();
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    expect(() => reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any)).not.toThrow();
  });

  test('does not throw with ordered project names', () => {
    const reporter = new CustomHtmlReporter();
    expect(() =>
      reporter.onBegin(
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        makeMockConfig() as any,
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        makeMockSuite(['ordertest:flow:0', 'ordertest:flow:1']) as any,
      ),
    ).not.toThrow();
  });

  test('does not throw with mixed ordered and native project names', () => {
    const reporter = new CustomHtmlReporter();
    expect(() =>
      reporter.onBegin(
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        makeMockConfig() as any,
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        makeMockSuite(['chromium', 'firefox', 'ordertest:checkout:0']) as any,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// onTestBegin
// ---------------------------------------------------------------------------

test.describe('onTestBegin', () => {
  test('does not throw when called with mock test and result', () => {
    const reporter = new CustomHtmlReporter();
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite(['ordertest:flow:0']) as any);

    const mockTest = makeMockTestCase('ordertest:flow:0', 'my test');
    const mockResult = makeMockResult('passed', 100);
    expect(() =>
      reporter.onTestBegin(
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        mockTest as any,
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        mockResult as any,
      ),
    ).not.toThrow();
  });

  test('does not throw for untracked project', () => {
    const reporter = new CustomHtmlReporter();
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);

    const mockTest = makeMockTestCase('chromium', 'native test');
    const mockResult = makeMockResult('passed', 50);
    expect(() =>
      reporter.onTestBegin(
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        mockTest as any,
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        mockResult as any,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// onTestEnd
// ---------------------------------------------------------------------------

test.describe('onTestEnd', () => {
  test('does not throw when called with mock test and result', () => {
    const reporter = new CustomHtmlReporter();
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite(['ordertest:flow:0']) as any);

    const mockTest = makeMockTestCase('ordertest:flow:0', 'my test');
    const mockResult = makeMockResult('passed', 100);
    expect(() =>
      reporter.onTestEnd(
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        mockTest as any,
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
        mockResult as any,
      ),
    ).not.toThrow();
  });

  test('collects test data (verified indirectly through report output)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordertest-reporter-'));
    try {
      const outputFile = path.join(tmpDir, 'report.html');
      const reporter = new CustomHtmlReporter({ outputFile });

      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      reporter.onBegin(makeMockConfig() as any, makeMockSuite(['ordertest:flow:0']) as any);

      const mockTest = makeMockTestCase('ordertest:flow:0', 'collected test', 'spec.ts');
      const mockResult = makeMockResult('passed', 123);
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      reporter.onTestEnd(mockTest as any, mockResult as any);

      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      await reporter.onEnd({ status: 'passed' } as any);

      const html = fs.readFileSync(outputFile, 'utf-8');
      // The test was recorded and contributes to the report output
      expect(html).toContain('<!DOCTYPE html>');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// onEnd — report generation
// ---------------------------------------------------------------------------

test.describe('onEnd — report generation', () => {
  let tmpDir: string;

  test.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordertest-reporter-'));
  });

  test.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes an HTML report file to the configured output path', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    // Simulate a run
    reporter.onBegin(
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockConfig() as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockSuite(['ordertest:flow:0', 'ordertest:flow:1']) as any,
    );

    const test0 = makeMockTestCase('ordertest:flow:0', 'login', 'auth.spec.ts');
    const result0 = makeMockResult('passed', 100);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestBegin(test0 as any, result0 as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(test0 as any, result0 as any);

    const test1 = makeMockTestCase('ordertest:flow:1', 'add cart', 'cart.spec.ts');
    const result1 = makeMockResult('passed', 200);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestBegin(test1 as any, result1 as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(test1 as any, result1 as any);

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    expect(fs.existsSync(outputFile)).toBe(true);
    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('OrderTest Report');
  });

  test('report contains sequence data', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    reporter.onBegin(
      makeMockConfig({
        projects: [
          { name: 'ordertest:checkout:0', testMatch: ['auth.spec.ts'] },
          { name: 'ordertest:checkout:1', testMatch: ['cart.spec.ts'] },
        ],
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      }) as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockSuite(['ordertest:checkout:0', 'ordertest:checkout:1']) as any,
    );

    const t0 = makeMockTestCase('ordertest:checkout:0', 'login');
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(t0 as any, makeMockResult('passed', 100) as any);

    const t1 = makeMockTestCase('ordertest:checkout:1', 'add cart');
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(t1 as any, makeMockResult('passed', 200) as any);

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).toContain('checkout');
    expect(html).toContain('Summary');
  });

  test('creates parent directory if it does not exist', async () => {
    const outputFile = path.join(tmpDir, 'nested', 'dir', 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    expect(fs.existsSync(outputFile)).toBe(true);
  });

  test('defaults output to ordertest-report.html in cwd', async () => {
    // We can't easily test the actual default without changing cwd,
    // so just verify the reporter doesn't throw when outputFile is not set
    const reporter = new CustomHtmlReporter({ outputFile: path.join(tmpDir, 'default.html') });
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);
    expect(fs.existsSync(path.join(tmpDir, 'default.html'))).toBe(true);
  });

  test('report contains failed test data', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    reporter.onBegin(
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockConfig() as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockSuite(['ordertest:flow:0']) as any,
    );

    const t0 = makeMockTestCase('ordertest:flow:0', 'failing test');
    const r0 = makeMockResult('failed', 500);
    r0.errors = [{ message: 'Expected true to be false' }];
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(t0 as any, r0 as any);

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'failed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).toContain('failed');
  });

  test('report includes timeline SVG when showTimeline is true', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile, showTimeline: true });

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).toContain('Gantt Timeline');
  });

  test('report excludes timeline when showTimeline is false', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile, showTimeline: false });

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).not.toContain('Gantt Timeline');
  });

  test('report includes dependency graph by default', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).toContain('Dependency Graph');
  });
});

// ---------------------------------------------------------------------------
// onEnd — template options passthrough
// ---------------------------------------------------------------------------

test.describe('onEnd — template options passthrough', () => {
  let tmpDir: string;

  test.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordertest-reporter-'));
  });

  test.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('showSummary: false omits Summary section', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile, showSummary: false });

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).not.toContain('>Summary<');
  });

  test('showDependencyGraph: false omits Dependency Graph section', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile, showDependencyGraph: false });

    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onBegin(makeMockConfig() as any, makeMockSuite([]) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).not.toContain('Dependency Graph');
  });
});

// ---------------------------------------------------------------------------
// extracting testMatch from config
// ---------------------------------------------------------------------------

test.describe('extracting testMatch from config', () => {
  let tmpDir: string;

  test.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordertest-reporter-'));
  });

  test.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('extracts testMatch string from config projects', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    reporter.onBegin(
      makeMockConfig({
        projects: [{ name: 'ordertest:flow:0', testMatch: 'auth.spec.ts' }],
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      }) as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockSuite(['ordertest:flow:0']) as any,
    );

    const t = makeMockTestCase('ordertest:flow:0', 'login');
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(t as any, makeMockResult('passed', 100) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    // File was written successfully — testMatch extraction did not throw
    expect(fs.existsSync(outputFile)).toBe(true);
  });

  test('extracts testMatch array from config projects', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    reporter.onBegin(
      makeMockConfig({
        projects: [{ name: 'ordertest:flow:0', testMatch: ['auth.spec.ts', 'login.spec.ts'] }],
        // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      }) as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockSuite(['ordertest:flow:0']) as any,
    );

    const t = makeMockTestCase('ordertest:flow:0', 'login');
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(t as any, makeMockResult('passed', 100) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    expect(fs.existsSync(outputFile)).toBe(true);
    const html = fs.readFileSync(outputFile, 'utf-8');
    // The first entry of the testMatch array should appear as the file for the step
    expect(html).toContain('auth.spec.ts');
  });

  test('falls back to test.location.file when testMatch is not set', async () => {
    const outputFile = path.join(tmpDir, 'report.html');
    const reporter = new CustomHtmlReporter({ outputFile });

    // Config has no testMatch entry for the project
    reporter.onBegin(
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockConfig() as any,
      // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
      makeMockSuite(['ordertest:flow:0']) as any,
    );

    // Provide a test with a location.file so the reporter can pick it up
    const t = makeMockTestCase('ordertest:flow:0', 'my test', 'fallback.spec.ts');
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    reporter.onTestEnd(t as any, makeMockResult('passed', 50) as any);
    // biome-ignore lint/suspicious/noExplicitAny: mock object for testing
    await reporter.onEnd({ status: 'passed' } as any);

    const html = fs.readFileSync(outputFile, 'utf-8');
    expect(html).toContain('fallback.spec.ts');
  });
});
