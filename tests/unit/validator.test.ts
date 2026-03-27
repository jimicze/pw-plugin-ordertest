/**
 * Comprehensive unit tests for src/config/validator.ts
 *
 * Tests validateConfig, validateManifest, and formatZodErrors against the full
 * Zod schema, covering valid inputs, every invalid input category, and edge cases.
 */

import { expect, test } from '@playwright/test';
import { z } from 'zod';

import { formatZodErrors, validateConfig, validateManifest } from '../../src/config/validator.js';
import { OrderTestValidationError } from '../../src/errors/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid sequence — used as a building block across tests. */
function minimalSequence(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    name: 'my-sequence',
    mode: 'serial',
    files: ['tests/login.spec.ts'],
    ...overrides,
  };
}

/** Asserts that fn() throws OrderTestValidationError and that the message contains needle. */
function expectValidationError(fn: () => unknown, needle: string): void {
  let thrown: unknown;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(OrderTestValidationError);
  if (thrown instanceof OrderTestValidationError) {
    expect(thrown.message).toContain(needle);
  }
}

// ---------------------------------------------------------------------------
// validateConfig — valid configs
// ---------------------------------------------------------------------------

test.describe('validateConfig — valid configs', () => {
  test('empty object passes — all fields are optional', () => {
    const result = validateConfig({});
    expect(result).toBeDefined();
    expect(result.sequences).toBeUndefined();
    expect(result.manifest).toBeUndefined();
    expect(result.logLevel).toBeUndefined();
    expect(result.shardStrategy).toBeUndefined();
    expect(result.debug).toBeUndefined();
  });

  test('config with one serial sequence', () => {
    const result = validateConfig({
      sequences: [
        {
          name: 'checkout-flow',
          mode: 'serial',
          files: ['tests/checkout.spec.ts'],
        },
      ],
    });
    expect(result.sequences).toHaveLength(1);
    const seq = result.sequences?.[0];
    expect(seq?.name).toBe('checkout-flow');
    expect(seq?.mode).toBe('serial');
    expect(seq?.files).toEqual(['tests/checkout.spec.ts']);
  });

  test('config with one parallel sequence', () => {
    const result = validateConfig({
      sequences: [{ name: 'smoke', mode: 'parallel', files: ['a.spec.ts', 'b.spec.ts'] }],
    });
    expect(result.sequences?.[0]?.mode).toBe('parallel');
  });

  test('config with one fullyParallel sequence', () => {
    const result = validateConfig({
      sequences: [{ name: 'regression', mode: 'fullyParallel', files: ['c.spec.ts'] }],
    });
    expect(result.sequences?.[0]?.mode).toBe('fullyParallel');
  });

  test('config with multiple sequences of different modes', () => {
    const result = validateConfig({
      sequences: [
        { name: 'serial-suite', mode: 'serial', files: ['s.spec.ts'] },
        { name: 'parallel-suite', mode: 'parallel', files: ['p1.spec.ts', 'p2.spec.ts'] },
        { name: 'fp-suite', mode: 'fullyParallel', files: ['fp.spec.ts'] },
      ],
    });
    expect(result.sequences).toHaveLength(3);
    expect(result.sequences?.[0]?.mode).toBe('serial');
    expect(result.sequences?.[1]?.mode).toBe('parallel');
    expect(result.sequences?.[2]?.mode).toBe('fullyParallel');
  });

  test('config with all optional top-level fields filled', () => {
    const result = validateConfig({
      sequences: [{ name: 'full', mode: 'serial', files: ['x.spec.ts'] }],
      manifest: './ordertest.config.json',
      logLevel: 'debug',
      logDir: '.logs/ordertest',
      logStdout: true,
      logRotation: { maxSize: '5m', maxFiles: 3 },
      shardStrategy: 'collapse',
      debug: true,
    });
    expect(result.manifest).toBe('./ordertest.config.json');
    expect(result.logLevel).toBe('debug');
    expect(result.logDir).toBe('.logs/ordertest');
    expect(result.logStdout).toBe(true);
    expect(result.logRotation?.maxSize).toBe('5m');
    expect(result.logRotation?.maxFiles).toBe(3);
    expect(result.shardStrategy).toBe('collapse');
    expect(result.debug).toBe(true);
  });

  test('config with all valid logLevel values', () => {
    const levels = ['debug', 'info', 'warn', 'error', 'silent'] as const;
    for (const level of levels) {
      const result = validateConfig({ logLevel: level });
      expect(result.logLevel).toBe(level);
    }
  });

  test('config with all valid shardStrategy values', () => {
    const strategies = ['collapse', 'warn', 'fail'] as const;
    for (const strategy of strategies) {
      const result = validateConfig({ shardStrategy: strategy });
      expect(result.shardStrategy).toBe(strategy);
    }
  });

  test('sequence with all optional per-sequence fields', () => {
    const result = validateConfig({
      sequences: [
        {
          name: 'full-seq',
          mode: 'parallel',
          files: ['a.spec.ts'],
          browser: 'chromium',
          retries: 2,
          timeout: 30000,
          workers: 4,
          tags: ['@smoke', '@regression'],
        },
      ],
    });
    const seq = result.sequences?.[0];
    expect(seq?.browser).toBe('chromium');
    expect(seq?.retries).toBe(2);
    expect(seq?.timeout).toBe(30000);
    expect(seq?.workers).toBe(4);
    expect(seq?.tags).toEqual(['@smoke', '@regression']);
  });

  test('sequence with retries: 0 is valid (boundary)', () => {
    const result = validateConfig({
      sequences: [{ name: 'no-retry', mode: 'serial', files: ['x.spec.ts'], retries: 0 }],
    });
    expect(result.sequences?.[0]?.retries).toBe(0);
  });

  test('sequence with workers: 1 is valid (boundary)', () => {
    const result = validateConfig({
      sequences: [{ name: 'one-worker', mode: 'parallel', files: ['x.spec.ts'], workers: 1 }],
    });
    expect(result.sequences?.[0]?.workers).toBe(1);
  });

  test('file entries as plain strings', () => {
    const result = validateConfig({
      sequences: [
        {
          name: 'string-files',
          mode: 'serial',
          files: ['tests/a.spec.ts', 'tests/b.spec.ts', 'tests/c.spec.ts'],
        },
      ],
    });
    expect(result.sequences?.[0]?.files).toEqual([
      'tests/a.spec.ts',
      'tests/b.spec.ts',
      'tests/c.spec.ts',
    ]);
  });

  test('file entries as FileSpecification objects', () => {
    const result = validateConfig({
      sequences: [
        {
          name: 'object-files',
          mode: 'serial',
          files: [
            { file: 'tests/login.spec.ts', tests: ['should login successfully'] },
            { file: 'tests/checkout.spec.ts', tags: ['@smoke'] },
          ],
        },
      ],
    });
    const files = result.sequences?.[0]?.files;
    expect(files).toHaveLength(2);
    const first = files?.[0];
    expect(typeof first).toBe('object');
    if (typeof first === 'object' && first !== null && 'file' in first) {
      expect(first.file).toBe('tests/login.spec.ts');
      expect((first as { tests?: string[] }).tests).toEqual(['should login successfully']);
    }
  });

  test('file entries as mixed strings and objects', () => {
    const result = validateConfig({
      sequences: [
        {
          name: 'mixed-files',
          mode: 'parallel',
          files: [
            'tests/first.spec.ts',
            { file: 'tests/second.spec.ts', tests: ['specific test'] },
          ],
        },
      ],
    });
    const files = result.sequences?.[0]?.files;
    expect(files).toHaveLength(2);
    expect(typeof files?.[0]).toBe('string');
    expect(typeof files?.[1]).toBe('object');
  });

  test('FileSpecification with tests and tags both present', () => {
    const result = validateConfig({
      sequences: [
        {
          name: 'filter-seq',
          mode: 'serial',
          files: [
            { file: 'tests/api.spec.ts', tests: ['GET /users', 'POST /users'], tags: ['@api'] },
          ],
        },
      ],
    });
    const entry = result.sequences?.[0]?.files?.[0];
    if (typeof entry === 'object' && entry !== null && 'file' in entry) {
      expect((entry as { tests?: string[] }).tests).toEqual(['GET /users', 'POST /users']);
      expect((entry as { tags?: string[] }).tags).toEqual(['@api']);
    }
  });

  test('FileSpecification with neither tests nor tags is valid', () => {
    const result = validateConfig({
      sequences: [
        {
          name: 'bare-spec',
          mode: 'serial',
          files: [{ file: 'tests/bare.spec.ts' }],
        },
      ],
    });
    const entry = result.sequences?.[0]?.files?.[0];
    if (typeof entry === 'object' && entry !== null && 'file' in entry) {
      expect((entry as { tests?: unknown }).tests).toBeUndefined();
      expect((entry as { tags?: unknown }).tags).toBeUndefined();
    }
  });

  test('logRotation with only maxSize is valid', () => {
    const result = validateConfig({ logRotation: { maxSize: '20m' } });
    expect(result.logRotation?.maxSize).toBe('20m');
    expect(result.logRotation?.maxFiles).toBeUndefined();
  });

  test('logRotation with only maxFiles is valid', () => {
    const result = validateConfig({ logRotation: { maxFiles: 7 } });
    expect(result.logRotation?.maxFiles).toBe(7);
    expect(result.logRotation?.maxSize).toBeUndefined();
  });

  test('config with empty sequences array is valid', () => {
    // sequences field is optional and array can be empty — only manifest requires 1+
    const result = validateConfig({ sequences: [] });
    expect(result.sequences).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateConfig — invalid configs
// ---------------------------------------------------------------------------

test.describe('validateConfig — invalid configs', () => {
  test('invalid execution mode throws OrderTestValidationError', () => {
    expectValidationError(
      () =>
        validateConfig({
          sequences: [minimalSequence({ mode: 'random' })],
        }),
      'Invalid plugin config',
    );
  });

  test('invalid execution mode error references the mode field', () => {
    let err: unknown;
    try {
      validateConfig({ sequences: [minimalSequence({ mode: 'step-by-step' })] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(err.message).toContain('mode');
    }
  });

  test('empty sequence name throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ name: '' })] }),
      'Invalid plugin config',
    );
  });

  test('empty sequence name error mentions name constraint', () => {
    let err: unknown;
    try {
      validateConfig({ sequences: [minimalSequence({ name: '' })] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      // The formatted error should include path "sequences.0.name"
      expect(err.message).toContain('name');
    }
  });

  test('empty files array throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ files: [] })] }),
      'Invalid plugin config',
    );
  });

  test('empty files array error mentions files constraint', () => {
    let err: unknown;
    try {
      validateConfig({ sequences: [minimalSequence({ files: [] })] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(err.message).toContain('files');
    }
  });

  test('duplicate sequence names throws OrderTestValidationError', () => {
    expectValidationError(
      () =>
        validateConfig({
          sequences: [
            { name: 'dupe', mode: 'serial', files: ['a.spec.ts'] },
            { name: 'dupe', mode: 'parallel', files: ['b.spec.ts'] },
          ],
        }),
      'Invalid plugin config',
    );
  });

  test('duplicate sequence name error includes the duplicate name', () => {
    let err: unknown;
    try {
      validateConfig({
        sequences: [
          { name: 'login-flow', mode: 'serial', files: ['a.spec.ts'] },
          { name: 'login-flow', mode: 'serial', files: ['b.spec.ts'] },
        ],
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(err.message).toContain('login-flow');
    }
  });

  test('three sequences where third duplicates first throws', () => {
    expectValidationError(
      () =>
        validateConfig({
          sequences: [
            { name: 'alpha', mode: 'serial', files: ['a.spec.ts'] },
            { name: 'beta', mode: 'serial', files: ['b.spec.ts'] },
            { name: 'alpha', mode: 'serial', files: ['c.spec.ts'] },
          ],
        }),
      'Invalid plugin config',
    );
  });

  test('negative retries throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ retries: -1 })] }),
      'Invalid plugin config',
    );
  });

  test('negative retries error message mentions retries', () => {
    let err: unknown;
    try {
      validateConfig({ sequences: [minimalSequence({ retries: -5 })] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(err.message).toContain('retries');
    }
  });

  test('zero timeout throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ timeout: 0 })] }),
      'Invalid plugin config',
    );
  });

  test('negative timeout throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ timeout: -1000 })] }),
      'Invalid plugin config',
    );
  });

  test('timeout error message mentions timeout', () => {
    let err: unknown;
    try {
      validateConfig({ sequences: [minimalSequence({ timeout: 0 })] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(err.message).toContain('timeout');
    }
  });

  test('zero workers throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ workers: 0 })] }),
      'Invalid plugin config',
    );
  });

  test('negative workers throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ workers: -2 })] }),
      'Invalid plugin config',
    );
  });

  test('workers error message mentions workers', () => {
    let err: unknown;
    try {
      validateConfig({ sequences: [minimalSequence({ workers: 0 })] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(err.message).toContain('workers');
    }
  });

  test('invalid logLevel throws OrderTestValidationError', () => {
    expectValidationError(() => validateConfig({ logLevel: 'verbose' }), 'Invalid plugin config');
  });

  test('invalid logLevel error is thrown for every non-member value', () => {
    for (const bad of ['trace', 'fatal', 'all', 'off', '']) {
      let err: unknown;
      try {
        validateConfig({ logLevel: bad });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(OrderTestValidationError);
    }
  });

  test('invalid shardStrategy throws OrderTestValidationError', () => {
    expectValidationError(
      () => validateConfig({ shardStrategy: 'ignore' }),
      'Invalid plugin config',
    );
  });

  test('invalid shardStrategy values all fail', () => {
    for (const bad of ['skip', 'abort', 'continue', '']) {
      let err: unknown;
      try {
        validateConfig({ shardStrategy: bad });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(OrderTestValidationError);
    }
  });

  test('non-object config (string) throws OrderTestValidationError', () => {
    expectValidationError(() => validateConfig('not-an-object'), 'Invalid plugin config');
  });

  test('null config throws OrderTestValidationError', () => {
    expectValidationError(() => validateConfig(null), 'Invalid plugin config');
  });

  test('array config throws OrderTestValidationError', () => {
    expectValidationError(() => validateConfig([]), 'Invalid plugin config');
  });

  test('sequences field as non-array throws', () => {
    expectValidationError(
      () => validateConfig({ sequences: 'not-an-array' }),
      'Invalid plugin config',
    );
  });

  test('file entry as empty string throws', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ files: [''] })] }),
      'Invalid plugin config',
    );
  });

  test('FileSpecification with empty file path throws', () => {
    expectValidationError(
      () =>
        validateConfig({
          sequences: [minimalSequence({ files: [{ file: '' }] })],
        }),
      'Invalid plugin config',
    );
  });

  test('FileSpecification missing file field throws', () => {
    expectValidationError(
      () =>
        validateConfig({
          sequences: [minimalSequence({ files: [{ tests: ['some test'] }] })],
        }),
      'Invalid plugin config',
    );
  });

  test('non-integer retries throws', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ retries: 1.5 })] }),
      'Invalid plugin config',
    );
  });

  test('non-integer workers throws', () => {
    expectValidationError(
      () => validateConfig({ sequences: [minimalSequence({ workers: 2.5 })] }),
      'Invalid plugin config',
    );
  });

  test('maxFiles: 0 in logRotation throws (must be positive)', () => {
    expectValidationError(
      () => validateConfig({ logRotation: { maxFiles: 0 } }),
      'Invalid plugin config',
    );
  });

  test('maxFiles: negative in logRotation throws', () => {
    expectValidationError(
      () => validateConfig({ logRotation: { maxFiles: -1 } }),
      'Invalid plugin config',
    );
  });

  test('thrown error has context.zodErrors array', () => {
    let err: unknown;
    try {
      validateConfig({ sequences: [minimalSequence({ mode: 'bad' })] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(Array.isArray(err.context.zodErrors)).toBe(true);
    }
  });

  test('error name is OrderTestValidationError', () => {
    let err: unknown;
    try {
      validateConfig({ logLevel: 'bad' });
    } catch (e) {
      err = e;
    }
    if (err instanceof Error) {
      expect(err.name).toBe('OrderTestValidationError');
    }
  });
});

// ---------------------------------------------------------------------------
// validateManifest — valid manifests
// ---------------------------------------------------------------------------

test.describe('validateManifest — valid manifests', () => {
  test('manifest with single sequence', () => {
    const result = validateManifest({
      sequences: [{ name: 'login', mode: 'serial', files: ['tests/login.spec.ts'] }],
    });
    expect(result.sequences).toHaveLength(1);
    expect(result.sequences[0]?.name).toBe('login');
  });

  test('manifest with multiple sequences', () => {
    const result = validateManifest({
      sequences: [
        { name: 'login', mode: 'serial', files: ['tests/login.spec.ts'] },
        { name: 'checkout', mode: 'parallel', files: ['tests/cart.spec.ts', 'tests/pay.spec.ts'] },
        { name: 'reporting', mode: 'fullyParallel', files: ['tests/report.spec.ts'] },
      ],
    });
    expect(result.sequences).toHaveLength(3);
    expect(result.sequences[1]?.mode).toBe('parallel');
  });

  test('manifest sequence with all optional fields', () => {
    const result = validateManifest({
      sequences: [
        {
          name: 'full-manifest-seq',
          mode: 'parallel',
          files: ['tests/full.spec.ts'],
          browser: 'firefox',
          retries: 1,
          timeout: 15000,
          workers: 2,
          tags: ['@full'],
        },
      ],
    });
    const seq = result.sequences[0];
    expect(seq?.browser).toBe('firefox');
    expect(seq?.retries).toBe(1);
    expect(seq?.timeout).toBe(15000);
    expect(seq?.workers).toBe(2);
    expect(seq?.tags).toEqual(['@full']);
  });

  test('manifest with FileSpecification objects in files', () => {
    const result = validateManifest({
      sequences: [
        {
          name: 'filtered',
          mode: 'serial',
          files: [
            { file: 'tests/login.spec.ts', tests: ['should log in'] },
            { file: 'tests/logout.spec.ts' },
          ],
        },
      ],
    });
    expect(result.sequences[0]?.files).toHaveLength(2);
  });

  test('manifest sequences are returned in input order', () => {
    const result = validateManifest({
      sequences: [
        { name: 'first', mode: 'serial', files: ['a.spec.ts'] },
        { name: 'second', mode: 'serial', files: ['b.spec.ts'] },
        { name: 'third', mode: 'serial', files: ['c.spec.ts'] },
      ],
    });
    expect(result.sequences[0]?.name).toBe('first');
    expect(result.sequences[1]?.name).toBe('second');
    expect(result.sequences[2]?.name).toBe('third');
  });
});

// ---------------------------------------------------------------------------
// validateManifest — invalid manifests
// ---------------------------------------------------------------------------

test.describe('validateManifest — invalid manifests', () => {
  test('empty sequences array throws — must have at least one', () => {
    expectValidationError(() => validateManifest({ sequences: [] }), 'Invalid manifest');
  });

  test('missing sequences field throws', () => {
    expectValidationError(() => validateManifest({}), 'Invalid manifest');
  });

  test('sequences: null throws', () => {
    expectValidationError(() => validateManifest({ sequences: null }), 'Invalid manifest');
  });

  test('sequences: string throws', () => {
    expectValidationError(
      () => validateManifest({ sequences: 'login.spec.ts' }),
      'Invalid manifest',
    );
  });

  test('duplicate sequence names throw OrderTestValidationError', () => {
    expectValidationError(
      () =>
        validateManifest({
          sequences: [
            { name: 'same', mode: 'serial', files: ['a.spec.ts'] },
            { name: 'same', mode: 'serial', files: ['b.spec.ts'] },
          ],
        }),
      'Invalid manifest',
    );
  });

  test('duplicate sequence name error includes the duplicate name', () => {
    let err: unknown;
    try {
      validateManifest({
        sequences: [
          { name: 'dup-manifest', mode: 'serial', files: ['a.spec.ts'] },
          { name: 'dup-manifest', mode: 'parallel', files: ['b.spec.ts'] },
        ],
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(err.message).toContain('dup-manifest');
    }
  });

  test('invalid sequence structure (missing mode) throws', () => {
    expectValidationError(
      () =>
        validateManifest({
          sequences: [{ name: 'no-mode', files: ['a.spec.ts'] }],
        }),
      'Invalid manifest',
    );
  });

  test('invalid sequence structure (missing files) throws', () => {
    expectValidationError(
      () =>
        validateManifest({
          sequences: [{ name: 'no-files', mode: 'serial' }],
        }),
      'Invalid manifest',
    );
  });

  test('invalid mode in manifest sequence throws', () => {
    expectValidationError(
      () =>
        validateManifest({
          sequences: [{ name: 'bad-mode', mode: 'concurrent', files: ['a.spec.ts'] }],
        }),
      'Invalid manifest',
    );
  });

  test('null manifest throws', () => {
    expectValidationError(() => validateManifest(null), 'Invalid manifest');
  });

  test('non-object manifest (string) throws', () => {
    expectValidationError(() => validateManifest('sequences: []'), 'Invalid manifest');
  });

  test('thrown error has zodErrors in context', () => {
    let err: unknown;
    try {
      validateManifest({ sequences: [] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(OrderTestValidationError);
    if (err instanceof OrderTestValidationError) {
      expect(Array.isArray(err.context.zodErrors)).toBe(true);
    }
  });

  test('thrown error name is OrderTestValidationError', () => {
    let err: unknown;
    try {
      validateManifest({});
    } catch (e) {
      err = e;
    }
    if (err instanceof Error) {
      expect(err.name).toBe('OrderTestValidationError');
    }
  });

  test('single invalid sequence among valid ones fails whole manifest', () => {
    expectValidationError(
      () =>
        validateManifest({
          sequences: [
            { name: 'valid', mode: 'serial', files: ['a.spec.ts'] },
            { name: 'invalid', mode: 'bad-mode', files: ['b.spec.ts'] },
          ],
        }),
      'Invalid manifest',
    );
  });
});

// ---------------------------------------------------------------------------
// formatZodErrors
// ---------------------------------------------------------------------------

test.describe('formatZodErrors', () => {
  test('returns string starting with newline', () => {
    const err = new z.ZodError([
      { code: 'custom', path: ['field'], message: 'something went wrong' },
    ]);
    const result = formatZodErrors(err);
    expect(result.startsWith('\n')).toBe(true);
  });

  test('formats a single issue with path and message', () => {
    const err = new z.ZodError([
      { code: 'custom', path: ['sequences', 0, 'mode'], message: 'Invalid enum value' },
    ]);
    const result = formatZodErrors(err);
    expect(result).toContain('sequences.0.mode');
    expect(result).toContain('Invalid enum value');
  });

  test('formats root-level issue (no path) as (root)', () => {
    const err = new z.ZodError([{ code: 'custom', path: [], message: 'Must be an object' }]);
    const result = formatZodErrors(err);
    expect(result).toContain('(root)');
    expect(result).toContain('Must be an object');
  });

  test('formats multiple issues — each on its own line', () => {
    const err = new z.ZodError([
      { code: 'custom', path: ['name'], message: 'Name is required' },
      { code: 'custom', path: ['mode'], message: 'Invalid mode' },
      { code: 'custom', path: ['files'], message: 'Files must not be empty' },
    ]);
    const result = formatZodErrors(err);
    const lines = result.split('\n').filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(3);
  });

  test('each issue is prefixed with "  - "', () => {
    const err = new z.ZodError([
      { code: 'custom', path: ['a'], message: 'msg' },
      { code: 'custom', path: ['b'], message: 'msg2' },
    ]);
    const result = formatZodErrors(err);
    const lines = result.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      expect(line.startsWith('  - ')).toBe(true);
    }
  });

  test('nested path is joined with dots', () => {
    const err = new z.ZodError([
      { code: 'custom', path: ['logRotation', 'maxFiles'], message: 'must be positive' },
    ]);
    const result = formatZodErrors(err);
    expect(result).toContain('logRotation.maxFiles');
  });

  test('numeric path segments are included', () => {
    const err = new z.ZodError([
      { code: 'custom', path: ['sequences', 2, 'name'], message: 'not unique' },
    ]);
    const result = formatZodErrors(err);
    expect(result).toContain('sequences.2.name');
  });

  test('single issue produces exactly one bullet line', () => {
    const err = new z.ZodError([{ code: 'custom', path: ['x'], message: 'bad' }]);
    const result = formatZodErrors(err);
    const bullets = result.split('\n').filter((l) => l.includes('  - '));
    expect(bullets).toHaveLength(1);
  });

  test('real ZodError from schema parse contains expected path', () => {
    const schema = z.object({ name: z.string().min(1) });
    let zodErr: z.ZodError | undefined;
    try {
      schema.parse({ name: '' });
    } catch (e) {
      if (e instanceof z.ZodError) {
        zodErr = e;
      }
    }
    expect(zodErr).toBeDefined();
    if (zodErr !== undefined) {
      const result = formatZodErrors(zodErr);
      expect(result).toContain('name');
    }
  });
});
