/**
 * Smoke test: verify all public API exports from the built dist/ output.
 *
 * These tests import from the compiled dist/ directory (not source TS) to ensure
 * the package works correctly when consumed by end users via npm.
 *
 * Prerequisite: `pnpm build` must be run before these tests.
 */

import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const DIST_INDEX = path.resolve(import.meta.dirname, '../../dist/index.js');

// Skip all smoke tests if dist/ hasn't been built yet
test.skip(!fs.existsSync(DIST_INDEX), 'dist/ not built — run `pnpm build` first');

// biome-ignore lint/suspicious/noExplicitAny: dynamic import returns unknown shape
let mod: any;

test.beforeAll(async () => {
  mod = await import(DIST_INDEX);
});

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

test.describe('exports — main API', () => {
  test('defineOrderedConfig is an exported function', () => {
    expect(typeof mod.defineOrderedConfig).toBe('function');
  });

  test('defineOrderedConfigAsync is an exported function', () => {
    expect(typeof mod.defineOrderedConfigAsync).toBe('function');
  });

  test('defineOrderedConfig returns an object with projects array when given sequences', () => {
    const result = mod.defineOrderedConfig({
      orderedTests: {
        logLevel: 'silent',
        sequences: [
          {
            name: 'smoke-seq',
            mode: 'serial',
            files: ['a.spec.ts', 'b.spec.ts'],
          },
        ],
      },
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(Array.isArray(result.projects)).toBe(true);
    expect(result.projects.length).toBeGreaterThan(0);
  });

  test('defineOrderedConfig passthrough mode returns config as-is when no sequences', () => {
    const result = mod.defineOrderedConfig({
      testDir: './tests',
    });
    expect(result).toBeDefined();
    expect(result.testDir).toBe('./tests');
  });
});

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

test.describe('exports — error classes', () => {
  test('OrderTestError is exported and constructible', () => {
    expect(typeof mod.OrderTestError).toBe('function');
    const err = new mod.OrderTestError('test');
    expect(err).toBeInstanceOf(Error);
  });

  test('OrderTestConfigError is exported and constructible', () => {
    expect(typeof mod.OrderTestConfigError).toBe('function');
    const err = new mod.OrderTestConfigError('test');
    expect(err).toBeInstanceOf(Error);
  });

  test('OrderTestValidationError is exported and constructible', () => {
    expect(typeof mod.OrderTestValidationError).toBe('function');
    const err = new mod.OrderTestValidationError('test');
    expect(err).toBeInstanceOf(Error);
  });

  test('OrderTestShardError is exported and constructible', () => {
    expect(typeof mod.OrderTestShardError).toBe('function');
    const err = new mod.OrderTestShardError('test');
    expect(err).toBeInstanceOf(Error);
  });

  test('OrderTestManifestError is exported and constructible', () => {
    expect(typeof mod.OrderTestManifestError).toBe('function');
    const err = new mod.OrderTestManifestError('test');
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

test.describe('exports — logger', () => {
  test('createLogger is an exported function', () => {
    expect(typeof mod.createLogger).toBe('function');
  });

  test('createSilentLogger is an exported function', () => {
    expect(typeof mod.createSilentLogger).toBe('function');
  });

  test('debugConsole is an exported function', () => {
    expect(typeof mod.debugConsole).toBe('function');
  });

  test('isDebugEnabled is an exported function', () => {
    expect(typeof mod.isDebugEnabled).toBe('function');
  });

  test('createSilentLogger returns a logger with standard pino methods', () => {
    const logger = mod.createSilentLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test.describe('exports — validation', () => {
  test('validateConfig is an exported function', () => {
    expect(typeof mod.validateConfig).toBe('function');
  });

  test('validateManifest is an exported function', () => {
    expect(typeof mod.validateManifest).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------

test.describe('exports — manifest loader', () => {
  test('loadManifest is an exported function', () => {
    expect(typeof mod.loadManifest).toBe('function');
  });

  test('discoverManifest is an exported function', () => {
    expect(typeof mod.discoverManifest).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Engine (advanced)
// ---------------------------------------------------------------------------

test.describe('exports — engine', () => {
  test('generateProjects is an exported function', () => {
    expect(typeof mod.generateProjects).toBe('function');
  });

  test('collectOrderedFiles is an exported function', () => {
    expect(typeof mod.collectOrderedFiles).toBe('function');
  });

  test('generateUnorderedProject is an exported function', () => {
    expect(typeof mod.generateUnorderedProject).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Shard guard
// ---------------------------------------------------------------------------

test.describe('exports — shard guard', () => {
  test('detectShardConfig is an exported function', () => {
    expect(typeof mod.detectShardConfig).toBe('function');
  });

  test('resolveShardStrategy is an exported function', () => {
    expect(typeof mod.resolveShardStrategy).toBe('function');
  });

  test('applyShardGuard is an exported function', () => {
    expect(typeof mod.applyShardGuard).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Test filter
// ---------------------------------------------------------------------------

test.describe('exports — test filter', () => {
  test('buildGrepPattern is an exported function', () => {
    expect(typeof mod.buildGrepPattern).toBe('function');
  });

  test('escapeRegex is an exported function', () => {
    expect(typeof mod.escapeRegex).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test.describe('exports — constants', () => {
  test('PROJECT_NAME_PREFIX is an exported string', () => {
    expect(typeof mod.PROJECT_NAME_PREFIX).toBe('string');
    expect(mod.PROJECT_NAME_PREFIX.length).toBeGreaterThan(0);
  });

  test('UNORDERED_PROJECT_NAME is an exported string', () => {
    expect(typeof mod.UNORDERED_PROJECT_NAME).toBe('string');
    expect(mod.UNORDERED_PROJECT_NAME.length).toBeGreaterThan(0);
  });

  test('DEFAULT_LOG_DIR is an exported string', () => {
    expect(typeof mod.DEFAULT_LOG_DIR).toBe('string');
  });

  test('DEFAULT_LOG_FILE is an exported string', () => {
    expect(typeof mod.DEFAULT_LOG_FILE).toBe('string');
  });

  test('DEFAULT_LOG_LEVEL is an exported string', () => {
    expect(typeof mod.DEFAULT_LOG_LEVEL).toBe('string');
  });

  test('DEFAULT_SHARD_STRATEGY is an exported string', () => {
    expect(typeof mod.DEFAULT_SHARD_STRATEGY).toBe('string');
  });

  test('DEBUG_PREFIX is an exported string', () => {
    expect(typeof mod.DEBUG_PREFIX).toBe('string');
  });

  test('DEFAULT_LOG_MAX_SIZE is an exported string', () => {
    expect(typeof mod.DEFAULT_LOG_MAX_SIZE).toBe('string');
  });

  test('DEFAULT_LOG_MAX_FILES is an exported number', () => {
    expect(typeof mod.DEFAULT_LOG_MAX_FILES).toBe('number');
  });
});
