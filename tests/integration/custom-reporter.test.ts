import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

function makeTempReportPath(): string {
  return path.join(
    os.tmpdir(),
    `ordertest-report-${Date.now().toString()}-${Math.random().toString(36).slice(2)}.html`,
  );
}

function runPlaywright(configPath: string, reportPath: string): void {
  execSync(`npx playwright test --config "${configPath}"`, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      ORDERTEST_CUSTOM_REPORT_PATH: reportPath,
      // The sample specs also write ndjson; suppress it
      ORDERTEST_TEST_OUTPUT_FILE: path.join(os.tmpdir(), `ordertest-ndjson-${Date.now()}.ndjson`),
    },
    stdio: 'pipe',
  });
}

function extractReportData(html: string): Record<string, unknown> {
  // The template uses `var REPORT_DATA = <json>;` — find the assignment and
  // extract everything between the `=` and the next semicolon that is followed
  // by a newline (the JSON is a single-line blob produced by JSON.stringify).
  const marker = 'var REPORT_DATA = ';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error('REPORT_DATA not found in HTML');
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf(';', jsonStart);
  if (jsonEnd === -1) throw new Error('Could not find end of REPORT_DATA assignment');
  const jsonStr = html.slice(jsonStart, jsonEnd);
  return JSON.parse(jsonStr) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Custom HTML reporter integration tests
// ---------------------------------------------------------------------------

test.describe('custom-reporter — HTML output', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60000);

  const CONFIG_PATH = path.join(
    PROJECT_ROOT,
    'tests/fixtures/configs/custom-reporter/playwright.config.js',
  );

  let reportPath: string;

  test.beforeEach(() => {
    reportPath = makeTempReportPath();
  });

  test.afterEach(() => {
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }
  });

  test('generates an HTML report file', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
  });

  test('report is valid HTML starting with <!DOCTYPE html>', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  test('report contains the Summary section', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    expect(html).toContain('Summary');
  });

  test('report contains the Gantt Timeline section', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    expect(html).toContain('Timeline');
    expect(html).toContain('<svg');
  });

  test('report contains the Dependency Graph section', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    expect(html).toContain('Dependency Graph');
  });

  test('report contains sequence names from the config', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    expect(html).toContain('checkout-flow');
    expect(html).toContain('profile-flow');
  });

  test('report contains embedded REPORT_DATA JSON', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    expect(html).toContain('REPORT_DATA');

    // Extract and parse the embedded JSON to verify it's valid
    const data = extractReportData(html);
    expect(data).toHaveProperty('sequences');
    expect(Array.isArray(data.sequences)).toBe(true);
  });

  test('embedded data contains correct sequence count', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    const data = extractReportData(html);
    // Config defines 2 sequences: checkout-flow and profile-flow
    expect((data.sequences as unknown[]).length).toBe(2);
  });

  test('embedded data has test results for checkout-flow', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    const data = extractReportData(html);

    const sequences = data.sequences as Array<{ name: string; mode: string; steps: unknown[] }>;
    const checkoutSeq = sequences.find((s) => s.name === 'checkout-flow');
    expect(checkoutSeq).toBeDefined();
    expect(checkoutSeq?.mode).toBe('serial');
    expect(checkoutSeq?.steps.length).toBe(3); // auth, cart, checkout
  });

  test('embedded data has test results for profile-flow', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    const data = extractReportData(html);

    const sequences = data.sequences as Array<{ name: string; mode: string; steps: unknown[] }>;
    const profileSeq = sequences.find((s) => s.name === 'profile-flow');
    expect(profileSeq).toBeDefined();
    expect(profileSeq?.mode).toBe('parallel');
    expect(profileSeq?.steps.length).toBe(1); // profile
  });

  test('report contains mode badges (serial and parallel)', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    expect(html).toContain('serial');
    expect(html).toContain('parallel');
  });

  test('report is self-contained (no external CSS/JS links)', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const html = fs.readFileSync(reportPath, 'utf-8');
    // Should not contain external stylesheet or script references
    expect(html).not.toMatch(/<link\s+rel=["']stylesheet["']\s+href=["']http/);
    expect(html).not.toMatch(/<script\s+src=["']http/);
    // Should contain inline style and script
    expect(html).toContain('<style>');
    expect(html).toContain('<script>');
  });

  test('report file is non-trivial size (> 5KB)', () => {
    runPlaywright(CONFIG_PATH, reportPath);
    const stats = fs.statSync(reportPath);
    expect(stats.size).toBeGreaterThan(5000);
  });
});
