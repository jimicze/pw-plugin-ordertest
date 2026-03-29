/**
 * Smoke test: verify `pnpm pack` produces a tarball with the correct files.
 *
 * Ensures the published npm package includes all necessary dist files,
 * type declarations, and metadata — and excludes source code, tests, etc.
 *
 * Prerequisite: `pnpm build` must be run before these tests.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST_INDEX = path.resolve(PROJECT_ROOT, 'dist/index.js');

// Skip all smoke tests if dist/ hasn't been built yet
test.skip(!fs.existsSync(DIST_INDEX), 'dist/ not built — run `pnpm build` first');

let packOutput: string;

test.beforeAll(() => {
  try {
    packOutput = execSync('pnpm pack --dry-run 2>&1', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    });
  } catch (error: unknown) {
    // pnpm pack --dry-run may exit non-zero but still produce useful output
    if (error instanceof Error && 'stdout' in error) {
      packOutput = (error as { stdout: string }).stdout;
    }
    if (!packOutput) {
      throw error;
    }
  }
});

// ---------------------------------------------------------------------------
// ESM entry point files
// ---------------------------------------------------------------------------

test.describe('package contents — ESM entry points', () => {
  test('includes dist/index.js (ESM main)', () => {
    expect(packOutput).toContain('dist/index.js');
  });
});

// ---------------------------------------------------------------------------
// CJS entry point files
// ---------------------------------------------------------------------------

test.describe('package contents — CJS entry points', () => {
  test('includes dist/index.cjs', () => {
    expect(packOutput).toContain('dist/index.cjs');
  });
});

// ---------------------------------------------------------------------------
// TypeScript declarations
// ---------------------------------------------------------------------------

test.describe('package contents — type declarations', () => {
  test('includes dist/index.d.ts (ESM types)', () => {
    expect(packOutput).toContain('dist/index.d.ts');
  });

  test('includes dist/index.d.cts (CJS types)', () => {
    expect(packOutput).toContain('dist/index.d.cts');
  });
});

// ---------------------------------------------------------------------------
// Source maps
// ---------------------------------------------------------------------------

test.describe('package contents — source maps', () => {
  test('includes dist/index.js.map', () => {
    expect(packOutput).toContain('dist/index.js.map');
  });

  test('includes dist/index.cjs.map', () => {
    expect(packOutput).toContain('dist/index.cjs.map');
  });
});

// ---------------------------------------------------------------------------
// Metadata files
// ---------------------------------------------------------------------------

test.describe('package contents — metadata', () => {
  test('includes package.json', () => {
    expect(packOutput).toContain('package.json');
  });

  test('includes README.md', () => {
    expect(packOutput).toContain('README.md');
  });

  test('includes LICENSE', () => {
    expect(packOutput).toContain('LICENSE');
  });
});

// ---------------------------------------------------------------------------
// Excluded files
// ---------------------------------------------------------------------------

test.describe('package contents — exclusions', () => {
  test('does NOT include src/ directory', () => {
    expect(packOutput).not.toMatch(/\bsrc\//);
  });

  test('does NOT include tests/ directory', () => {
    expect(packOutput).not.toMatch(/\btests\//);
  });

  test('does NOT include node_modules/', () => {
    expect(packOutput).not.toContain('node_modules/');
  });

  test('does NOT include tsconfig.json', () => {
    expect(packOutput).not.toContain('tsconfig.json');
  });

  test('does NOT include biome.json', () => {
    expect(packOutput).not.toContain('biome.json');
  });

  test('does NOT include .gitignore', () => {
    expect(packOutput).not.toContain('.gitignore');
  });
});
