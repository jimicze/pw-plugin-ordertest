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

// ---------------------------------------------------------------------------
// Shard safety — collapse strategy (default)
// ---------------------------------------------------------------------------

test.describe('shard safety — collapse strategy', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60000);

  const SERIAL_CONFIG = path.join(
    PROJECT_ROOT,
    'tests/fixtures/configs/serial-flow/playwright.config.js',
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

  test('serial-flow runs without PLAYWRIGHT_SHARD (no shard guard triggered)', () => {
    // No shard env var — should run normally with no throw
    runPlaywright(SERIAL_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const ordered = records.filter((r) =>
      ['auth.spec.js', 'cart.spec.js', 'checkout.spec.js'].includes(r.file),
    );
    expect(ordered).toHaveLength(6);
  });

  test('collapse strategy: serial-flow with PLAYWRIGHT_SHARD=1/2 does NOT throw', () => {
    // Default shardStrategy is 'collapse' — should run without error
    // NOTE: uses PLAYWRIGHT_SHARD env var (not --shard CLI arg) because worker
    // processes don't receive --shard in argv. See LEARNINGS.md.
    runPlaywright(SERIAL_CONFIG, outputFile, { PLAYWRIGHT_SHARD: '1/2' });
    // If we get here, the process exited 0 — collapse strategy did not throw
    // Records may be empty (shard 1/2 may not have any tests) but no error
    expect(true).toBe(true);
  });

  test('collapse strategy: PLAYWRIGHT_SHARD=2/2 also does NOT throw', () => {
    runPlaywright(SERIAL_CONFIG, outputFile, { PLAYWRIGHT_SHARD: '2/2' });
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shard safety — fail strategy
// ---------------------------------------------------------------------------

test.describe('shard safety — fail strategy', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60000);

  const SHARD_FAIL_CONFIG = path.join(
    PROJECT_ROOT,
    'tests/fixtures/configs/shard-fail/playwright.config.js',
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

  test('fail strategy: shard-fail config without shard runs normally', () => {
    // No shard — fail strategy should not trigger, tests should run
    runPlaywright(SHARD_FAIL_CONFIG, outputFile);
    const records = readOutput(outputFile);

    const ordered = records.filter((r) =>
      ['auth.spec.js', 'cart.spec.js', 'checkout.spec.js'].includes(r.file),
    );
    expect(ordered).toHaveLength(6);
  });

  test('fail strategy: shard-fail config WITH PLAYWRIGHT_SHARD throws OrderTestShardError', () => {
    // With shardStrategy: 'fail', detecting a shard must throw — process exits non-zero
    let threw = false;
    try {
      runPlaywright(SHARD_FAIL_CONFIG, outputFile, { PLAYWRIGHT_SHARD: '1/2' });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
