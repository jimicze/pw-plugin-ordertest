/**
 * Unit tests for file existence validation in defineOrderedConfig.
 *
 * Tests the `validateFileExistence` function (called internally by `transformConfig`
 * via `defineOrderedConfig`) which checks that all files referenced in sequences
 * actually exist on disk before generating projects.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { defineOrderedConfig } from '../../src/config/defineOrderedConfig.js';
import { OrderTestConfigError } from '../../src/errors/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal defineOrderedConfig call that points sequences at `testDir`.
 * testDir is passed through projects[0].testDir, which is how the internal
 * transformConfig function resolves it.
 */
function callWithMissingFile(
  testDir: string,
  fileName: string,
  sequenceName = 'my-seq',
): () => unknown {
  return () =>
    defineOrderedConfig({
      projects: [{ testDir }],
      orderedTests: {
        logLevel: 'silent',
        sequences: [{ name: sequenceName, mode: 'serial', files: [fileName] }],
      },
    });
}

// ---------------------------------------------------------------------------
// defineOrderedConfig — file existence validation
// ---------------------------------------------------------------------------

test.describe('defineOrderedConfig — file existence validation', () => {
  let tmpDir: string;

  test.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordertest-fev-'));
  });

  test.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Test 1: throws OrderTestConfigError when a file does not exist
  // -------------------------------------------------------------------------

  test('throws OrderTestConfigError when a file does not exist', () => {
    let thrown: unknown;
    try {
      callWithMissingFile(tmpDir, 'nonexistent.spec.ts')();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(OrderTestConfigError);
  });

  // -------------------------------------------------------------------------
  // Test 2: error message includes the file path
  // -------------------------------------------------------------------------

  test('error message includes the file path', () => {
    let thrown: unknown;
    try {
      callWithMissingFile(tmpDir, 'nonexistent.spec.ts')();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(OrderTestConfigError);
    if (thrown instanceof OrderTestConfigError) {
      expect(thrown.message).toContain('nonexistent.spec.ts');
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: error message includes the sequence name
  // -------------------------------------------------------------------------

  test('error message includes the sequence name', () => {
    let thrown: unknown;
    try {
      callWithMissingFile(tmpDir, 'nonexistent.spec.ts', 'checkout-flow')();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(OrderTestConfigError);
    if (thrown instanceof OrderTestConfigError) {
      expect(thrown.message).toContain('checkout-flow');
    }
  });

  // -------------------------------------------------------------------------
  // Test 4: error message includes the testDir
  // -------------------------------------------------------------------------

  test('error message includes the testDir', () => {
    let thrown: unknown;
    try {
      callWithMissingFile(tmpDir, 'nonexistent.spec.ts')();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(OrderTestConfigError);
    if (thrown instanceof OrderTestConfigError) {
      expect(thrown.message).toContain(tmpDir);
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: error context has all expected fields
  // -------------------------------------------------------------------------

  test('error context has the expected fields', () => {
    let thrown: unknown;
    try {
      callWithMissingFile(tmpDir, 'nonexistent.spec.ts', 'ctx-seq')();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(OrderTestConfigError);
    if (thrown instanceof OrderTestConfigError) {
      expect(thrown.context).toHaveProperty('filePath');
      expect(thrown.context).toHaveProperty('sequenceName');
      expect(thrown.context).toHaveProperty('testDir');
      expect(thrown.context).toHaveProperty('absolutePath');
      expect(thrown.context.filePath).toBe('nonexistent.spec.ts');
      expect(thrown.context.sequenceName).toBe('ctx-seq');
      expect(thrown.context.testDir).toBe(tmpDir);
      expect(thrown.context.absolutePath).toBe(path.resolve(tmpDir, 'nonexistent.spec.ts'));
    }
  });

  // -------------------------------------------------------------------------
  // Test 6: works with FileSpecification objects (not just strings)
  // -------------------------------------------------------------------------

  test('throws OrderTestConfigError for FileSpecification object with missing file', () => {
    let thrown: unknown;
    try {
      defineOrderedConfig({
        projects: [{ testDir: tmpDir }],
        orderedTests: {
          logLevel: 'silent',
          sequences: [
            {
              name: 'spec-obj-seq',
              mode: 'serial',
              files: [{ file: 'missing.spec.ts', tests: ['test1'] }],
            },
          ],
        },
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(OrderTestConfigError);
    if (thrown instanceof OrderTestConfigError) {
      expect(thrown.message).toContain('missing.spec.ts');
    }
  });

  // -------------------------------------------------------------------------
  // Test 7: passes when all files exist
  // -------------------------------------------------------------------------

  test('does not throw when all referenced files exist', () => {
    const fileA = path.join(tmpDir, 'a.spec.ts');
    const fileB = path.join(tmpDir, 'b.spec.ts');
    fs.writeFileSync(fileA, '// stub\n');
    fs.writeFileSync(fileB, '// stub\n');

    expect(() =>
      defineOrderedConfig({
        projects: [{ testDir: tmpDir }],
        orderedTests: {
          logLevel: 'silent',
          sequences: [
            {
              name: 'existing-files-seq',
              mode: 'serial',
              files: ['a.spec.ts', 'b.spec.ts'],
            },
          ],
        },
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// defineOrderedConfig — use passthrough
// ---------------------------------------------------------------------------

test.describe('defineOrderedConfig — use passthrough', () => {
  let tmpDir: string;

  test.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordertest-use-'));
    fs.writeFileSync(path.join(tmpDir, 'a.spec.ts'), '// stub\n');
    fs.writeFileSync(path.join(tmpDir, 'b.spec.ts'), '// stub\n');
  });

  test.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('top-level use config is preserved in the output', () => {
    const result = defineOrderedConfig({
      use: { baseURL: 'http://localhost:3000', trace: 'on' },
      projects: [{ testDir: tmpDir }],
      orderedTests: {
        logLevel: 'silent',
        sequences: [{ name: 'seq', mode: 'serial', files: ['a.spec.ts'] }],
      },
    });

    expect(result.use).toEqual({ baseURL: 'http://localhost:3000', trace: 'on' });
  });

  test('sequence.browser produces use.browserName on generated projects', () => {
    const result = defineOrderedConfig({
      projects: [{ testDir: tmpDir }],
      orderedTests: {
        logLevel: 'silent',
        sequences: [{ name: 'ff-seq', mode: 'serial', files: ['a.spec.ts'], browser: 'firefox' }],
      },
    });

    const projects = result.projects as Record<string, unknown>[];
    // First project should be the ordered one (ordertest:ff-seq:0)
    const orderedProject = projects?.find(
      (p) => typeof p.name === 'string' && p.name.startsWith('ordertest:ff-seq:'),
    );
    expect(orderedProject).toBeDefined();
    expect(orderedProject?.use).toEqual({ browserName: 'firefox' });
  });

  test('generated projects without browser have no use field', () => {
    const result = defineOrderedConfig({
      projects: [{ testDir: tmpDir }],
      orderedTests: {
        logLevel: 'silent',
        sequences: [{ name: 'no-browser', mode: 'serial', files: ['a.spec.ts'] }],
      },
    });

    const projects = result.projects as Record<string, unknown>[];
    const orderedProject = projects?.find(
      (p) => typeof p.name === 'string' && p.name.startsWith('ordertest:no-browser:'),
    );
    expect(orderedProject).toBeDefined();
    expect(orderedProject?.use).toBeUndefined();
  });

  test('browser propagates to all projects in a multi-file sequence', () => {
    const result = defineOrderedConfig({
      projects: [{ testDir: tmpDir }],
      orderedTests: {
        logLevel: 'silent',
        sequences: [
          {
            name: 'multi-browser',
            mode: 'serial',
            files: ['a.spec.ts', 'b.spec.ts'],
            browser: 'webkit',
          },
        ],
      },
    });

    const projects = result.projects as Record<string, unknown>[];
    const orderedProjects = projects?.filter(
      (p) => typeof p.name === 'string' && p.name.startsWith('ordertest:multi-browser:'),
    );
    expect(orderedProjects).toHaveLength(2);
    for (const project of orderedProjects ?? []) {
      expect(project.use).toEqual({ browserName: 'webkit' });
    }
  });
});
