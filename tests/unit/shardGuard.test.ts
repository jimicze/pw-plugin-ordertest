import { expect, test } from '@playwright/test';
import {
  applyShardGuard,
  detectShardConfig,
  resolveShardStrategy,
} from '../../src/config/shardGuard.js';
import { DEFAULT_SHARD_STRATEGY } from '../../src/config/types.js';
import type { ShardInfo } from '../../src/config/types.js';
import type { GeneratedProject } from '../../src/engine/serialStrategy.js';
import { OrderTestShardError } from '../../src/errors/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal GeneratedProject with metadata belonging to a named sequence.
 */
function makeOrderedProject(
  sequenceName: string,
  stepIndex: number,
  totalSteps: number,
  file: string,
  deps: string[] = [],
): GeneratedProject {
  return {
    name: `ordertest:${sequenceName}:${stepIndex}`,
    testMatch: file,
    dependencies: deps,
    workers: 1,
    fullyParallel: false,
    metadata: {
      sequenceName,
      stepIndex,
      totalSteps,
      mode: 'serial',
      isCollapsed: false,
    },
  };
}

/**
 * Build a GeneratedProject that has NO metadata (unordered pass-through).
 */
function makeUnorderedProject(name: string, files: string[]): GeneratedProject {
  return {
    name,
    testMatch: files,
  };
}

/** Minimal ShardInfo for tests that need one. */
const SHARD_INFO_2_OF_5: ShardInfo = { current: 2, total: 5, source: 'config' };

// ---------------------------------------------------------------------------
// detectShardConfig
// ---------------------------------------------------------------------------

test.describe('detectShardConfig', () => {
  // Save and restore env + argv around each test that might pollute them.
  let savedArgv: string[];
  let savedPlaywrightShard: string | undefined;

  test.beforeEach(() => {
    savedArgv = process.argv.slice();
    savedPlaywrightShard = process.env.PLAYWRIGHT_SHARD;
  });

  test.afterEach(() => {
    process.argv.length = 0;
    for (const arg of savedArgv) {
      process.argv.push(arg);
    }
    if (savedPlaywrightShard === undefined) {
      process.env.PLAYWRIGHT_SHARD = undefined;
    } else {
      process.env.PLAYWRIGHT_SHARD = savedPlaywrightShard;
    }
  });

  // -------------------------------------------------------------------------
  // No shard config
  // -------------------------------------------------------------------------

  test('returns undefined when no shard config is present anywhere', () => {
    // Clear env and argv of any shard flags
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig(undefined);

    expect(result).toBeUndefined();
  });

  test('returns undefined when called with no arguments and env/argv are clean', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig();

    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Config shard (source='config')
  // -------------------------------------------------------------------------

  test('returns ShardInfo with source="config" when playwrightConfigShard is valid', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig({ current: 2, total: 5 });

    expect(result).not.toBeUndefined();
    expect(result?.current).toBe(2);
    expect(result?.total).toBe(5);
    expect(result?.source).toBe('config');
  });

  test('config shard with current=1 and total=1 is valid', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig({ current: 1, total: 1 });

    expect(result).not.toBeUndefined();
    expect(result?.current).toBe(1);
    expect(result?.total).toBe(1);
    expect(result?.source).toBe('config');
  });

  test('config shard with current=5 and total=5 is valid', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig({ current: 5, total: 5 });

    expect(result).not.toBeUndefined();
    expect(result?.current).toBe(5);
    expect(result?.total).toBe(5);
    expect(result?.source).toBe('config');
  });

  test('config shard takes priority over argv shard', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright', '--shard=3/10'];

    const result = detectShardConfig({ current: 1, total: 4 });

    // Config wins; should reflect config values
    expect(result?.source).toBe('config');
    expect(result?.current).toBe(1);
    expect(result?.total).toBe(4);
  });

  test('config shard takes priority over env shard', () => {
    process.env.PLAYWRIGHT_SHARD = '4/8';
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig({ current: 2, total: 3 });

    expect(result?.source).toBe('config');
    expect(result?.current).toBe(2);
    expect(result?.total).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Invalid config shard — falls through to argv / env
  // -------------------------------------------------------------------------

  test('config shard with current=0 is invalid — falls through to argv', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright', '--shard=3/5'];

    const result = detectShardConfig({ current: 0, total: 5 });

    // current=0 is out of range (must be >= 1), so config is skipped
    // The argv '--shard=3/5' should be picked up instead
    expect(result).not.toBeUndefined();
    expect(result?.source).toBe('argv');
    expect(result?.current).toBe(3);
    expect(result?.total).toBe(5);
  });

  test('config shard with total=0 is invalid — falls through to env', () => {
    process.env.PLAYWRIGHT_SHARD = '1/2';
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig({ current: 1, total: 0 });

    // total=0 is out of range (must be >= 1), config is skipped
    expect(result?.source).toBe('env');
    expect(result?.current).toBe(1);
    expect(result?.total).toBe(2);
  });

  test('config shard with current > total is accepted as-is (no cross-check in config path)', () => {
    // The config path only validates current >= 1 && total >= 1.
    // The current > total guard exists only in parseShardString (argv / env).
    // Playwright itself validates shard semantics when it consumes the config.
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright', '--shard=2/4'];

    const result = detectShardConfig({ current: 6, total: 5 });

    // Config path: current=6 >= 1, total=5 >= 1 → accepted, source='config'
    expect(result?.source).toBe('config');
    expect(result?.current).toBe(6);
    expect(result?.total).toBe(5);
  });

  // -------------------------------------------------------------------------
  // Argv shard (source='argv')
  // -------------------------------------------------------------------------

  test('detects shard from --shard=N/M argv style', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright', '--shard=3/5'];

    const result = detectShardConfig(undefined);

    expect(result).not.toBeUndefined();
    expect(result?.current).toBe(3);
    expect(result?.total).toBe(5);
    expect(result?.source).toBe('argv');
  });

  test('detects shard from --shard N/M argv style (space-separated)', () => {
    process.env.PLAYWRIGHT_SHARD = undefined;
    process.argv = ['node', 'playwright', '--shard', '2/4'];

    const result = detectShardConfig(undefined);

    expect(result).not.toBeUndefined();
    expect(result?.current).toBe(2);
    expect(result?.total).toBe(4);
    expect(result?.source).toBe('argv');
  });

  // -------------------------------------------------------------------------
  // Env shard (source='env')
  // -------------------------------------------------------------------------

  test('detects shard from PLAYWRIGHT_SHARD env var', () => {
    process.env.PLAYWRIGHT_SHARD = '1/3';
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig(undefined);

    expect(result).not.toBeUndefined();
    expect(result?.current).toBe(1);
    expect(result?.total).toBe(3);
    expect(result?.source).toBe('env');
  });

  test('env shard is used when config is undefined and argv has no shard', () => {
    process.env.PLAYWRIGHT_SHARD = '5/5';
    process.argv = ['node', 'playwright'];

    const result = detectShardConfig();

    expect(result?.source).toBe('env');
    expect(result?.current).toBe(5);
    expect(result?.total).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// resolveShardStrategy
// ---------------------------------------------------------------------------

test.describe('resolveShardStrategy', () => {
  let originalEnvValue: string | undefined;

  test.beforeEach(() => {
    originalEnvValue = process.env.ORDERTEST_SHARD_STRATEGY;
  });

  test.afterEach(() => {
    if (originalEnvValue === undefined) {
      process.env.ORDERTEST_SHARD_STRATEGY = undefined;
    } else {
      process.env.ORDERTEST_SHARD_STRATEGY = originalEnvValue;
    }
  });

  // -------------------------------------------------------------------------
  // Default fallback
  // -------------------------------------------------------------------------

  test('returns DEFAULT_SHARD_STRATEGY when called with no arguments and no env var', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = undefined;

    const result = resolveShardStrategy();

    expect(result).toBe(DEFAULT_SHARD_STRATEGY);
    expect(result).toBe('collapse');
  });

  test('returns DEFAULT_SHARD_STRATEGY when configStrategy is undefined and no env var', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = undefined;

    const result = resolveShardStrategy(undefined);

    expect(result).toBe(DEFAULT_SHARD_STRATEGY);
  });

  // -------------------------------------------------------------------------
  // Config strategy
  // -------------------------------------------------------------------------

  test('returns "collapse" when configStrategy is "collapse" and no env var', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = undefined;

    const result = resolveShardStrategy('collapse');

    expect(result).toBe('collapse');
  });

  test('returns "warn" when configStrategy is "warn" and no env var', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = undefined;

    const result = resolveShardStrategy('warn');

    expect(result).toBe('warn');
  });

  test('returns "fail" when configStrategy is "fail" and no env var', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = undefined;

    const result = resolveShardStrategy('fail');

    expect(result).toBe('fail');
  });

  // -------------------------------------------------------------------------
  // Env override (highest priority)
  // -------------------------------------------------------------------------

  test('ORDERTEST_SHARD_STRATEGY env var overrides undefined configStrategy', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = 'warn';

    const result = resolveShardStrategy(undefined);

    expect(result).toBe('warn');
  });

  test('ORDERTEST_SHARD_STRATEGY env var overrides "collapse" configStrategy', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = 'fail';

    const result = resolveShardStrategy('collapse');

    expect(result).toBe('fail');
  });

  test('ORDERTEST_SHARD_STRATEGY="collapse" env var overrides "fail" configStrategy', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = 'collapse';

    const result = resolveShardStrategy('fail');

    expect(result).toBe('collapse');
  });

  test('ORDERTEST_SHARD_STRATEGY="warn" env var overrides "fail" configStrategy', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = 'warn';

    const result = resolveShardStrategy('fail');

    expect(result).toBe('warn');
  });

  // -------------------------------------------------------------------------
  // Invalid env value — falls back to configStrategy / default
  // -------------------------------------------------------------------------

  test('invalid env value falls back to configStrategy', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = 'invalid-value';

    const result = resolveShardStrategy('warn');

    // env is invalid, falls back to config
    expect(result).toBe('warn');
  });

  test('invalid env value falls back to DEFAULT_SHARD_STRATEGY when no configStrategy', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = 'COLLAPSE'; // wrong case — invalid

    const result = resolveShardStrategy(undefined);

    expect(result).toBe(DEFAULT_SHARD_STRATEGY);
  });

  test('empty string env value falls back to configStrategy', () => {
    process.env.ORDERTEST_SHARD_STRATEGY = '';

    const result = resolveShardStrategy('fail');

    expect(result).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// applyShardGuard — strategy='fail'
// ---------------------------------------------------------------------------

test.describe('applyShardGuard — strategy="fail"', () => {
  test('throws OrderTestShardError immediately', () => {
    const projects: GeneratedProject[] = [makeOrderedProject('checkout', 0, 2, 'a.spec.ts')];

    expect(() => {
      applyShardGuard({ projects, shardInfo: SHARD_INFO_2_OF_5, strategy: 'fail' });
    }).toThrow(OrderTestShardError);
  });

  test('error message mentions the shard values', () => {
    const projects: GeneratedProject[] = [makeOrderedProject('checkout', 0, 1, 'a.spec.ts')];

    let caughtError: OrderTestShardError | undefined;
    try {
      applyShardGuard({ projects, shardInfo: SHARD_INFO_2_OF_5, strategy: 'fail' });
    } catch (err) {
      if (err instanceof OrderTestShardError) {
        caughtError = err;
      }
    }

    expect(caughtError).toBeInstanceOf(OrderTestShardError);
    // Message should reference the shard ratio
    expect(caughtError?.message).toContain('2/5');
  });

  test('throws even when projects array is empty', () => {
    expect(() => {
      applyShardGuard({ projects: [], shardInfo: SHARD_INFO_2_OF_5, strategy: 'fail' });
    }).toThrow(OrderTestShardError);
  });

  test('error has the correct name', () => {
    let caughtError: Error | undefined;
    try {
      applyShardGuard({ projects: [], shardInfo: SHARD_INFO_2_OF_5, strategy: 'fail' });
    } catch (err) {
      if (err instanceof Error) caughtError = err;
    }
    expect(caughtError?.name).toBe('OrderTestShardError');
  });

  test('thrown error carries shardInfo in context', () => {
    let caughtError: OrderTestShardError | undefined;
    try {
      applyShardGuard({ projects: [], shardInfo: SHARD_INFO_2_OF_5, strategy: 'fail' });
    } catch (err) {
      if (err instanceof OrderTestShardError) caughtError = err;
    }
    expect(caughtError?.context).toBeDefined();
    const ctx = caughtError?.context as Record<string, unknown>;
    expect(ctx.shardInfo).toEqual(SHARD_INFO_2_OF_5);
  });
});

// ---------------------------------------------------------------------------
// applyShardGuard — strategy='warn'
// ---------------------------------------------------------------------------

test.describe('applyShardGuard — strategy="warn"', () => {
  test('returns the original projects array (not a new array with different content)', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq-a', 0, 2, 'step0.spec.ts'),
      makeOrderedProject('seq-a', 1, 2, 'step1.spec.ts', ['ordertest:seq-a:0']),
    ];

    const result = applyShardGuard({ projects, shardInfo: SHARD_INFO_2_OF_5, strategy: 'warn' });

    expect(result).toHaveLength(2);
  });

  test('projects are returned in same order and unchanged', () => {
    const p0 = makeOrderedProject('seq-a', 0, 2, 'alpha.spec.ts');
    const p1 = makeOrderedProject('seq-a', 1, 2, 'beta.spec.ts', ['ordertest:seq-a:0']);
    const projects: GeneratedProject[] = [p0, p1];

    const result = applyShardGuard({ projects, shardInfo: SHARD_INFO_2_OF_5, strategy: 'warn' });

    expect(result[0]?.name).toBe(p0.name);
    expect(result[1]?.name).toBe(p1.name);
    expect(result[0]?.testMatch).toBe('alpha.spec.ts');
    expect(result[1]?.testMatch).toBe('beta.spec.ts');
  });

  test('unordered projects are also returned unchanged', () => {
    const ordered = makeOrderedProject('my-seq', 0, 1, 'spec.ts');
    const unordered = makeUnorderedProject('ordertest:unordered', ['other.spec.ts']);
    const projects: GeneratedProject[] = [ordered, unordered];

    const result = applyShardGuard({ projects, shardInfo: SHARD_INFO_2_OF_5, strategy: 'warn' });

    expect(result).toHaveLength(2);
    expect(result[0]?.metadata).toBeDefined();
    expect(result[1]?.metadata).toBeUndefined();
  });

  test('does not throw', () => {
    const projects: GeneratedProject[] = [makeOrderedProject('seq', 0, 1, 'a.spec.ts')];

    expect(() => {
      applyShardGuard({ projects, shardInfo: SHARD_INFO_2_OF_5, strategy: 'warn' });
    }).not.toThrow();
  });

  test('handles empty projects array without throwing', () => {
    const result = applyShardGuard({
      projects: [],
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'warn',
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyShardGuard — strategy='collapse'
// ---------------------------------------------------------------------------

test.describe('applyShardGuard — strategy="collapse"', () => {
  // -------------------------------------------------------------------------
  // Basic collapse: single sequence
  // -------------------------------------------------------------------------

  test('collapses a two-step sequence into a single project', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('checkout', 0, 2, 'login.spec.ts'),
      makeOrderedProject('checkout', 1, 2, 'payment.spec.ts', ['ordertest:checkout:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result).toHaveLength(1);
  });

  test('collapses a three-step sequence into a single project', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('flow', 0, 3, 'a.spec.ts'),
      makeOrderedProject('flow', 1, 3, 'b.spec.ts', ['ordertest:flow:0']),
      makeOrderedProject('flow', 2, 3, 'c.spec.ts', ['ordertest:flow:1']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Collapsed project name
  // -------------------------------------------------------------------------

  test('collapsed project name is "ordertest:<sequenceName>"', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('checkout-flow', 0, 2, 'login.spec.ts'),
      makeOrderedProject('checkout-flow', 1, 2, 'payment.spec.ts', ['ordertest:checkout-flow:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.name).toBe('ordertest:checkout-flow');
  });

  test('collapsed name uses the exact sequence name from metadata', () => {
    const projects: GeneratedProject[] = [makeOrderedProject('My Sequence_v2', 0, 1, 'x.spec.ts')];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.name).toBe('ordertest:My Sequence_v2');
  });

  // -------------------------------------------------------------------------
  // Collapsed project fields: workers, fullyParallel
  // -------------------------------------------------------------------------

  test('collapsed project has workers: 1', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 2, 'a.spec.ts'),
      makeOrderedProject('seq', 1, 2, 'b.spec.ts', ['ordertest:seq:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.workers).toBe(1);
  });

  test('collapsed project has fullyParallel: false', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 2, 'a.spec.ts'),
      makeOrderedProject('seq', 1, 2, 'b.spec.ts', ['ordertest:seq:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.fullyParallel).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Collapsed project metadata
  // -------------------------------------------------------------------------

  test('collapsed project has metadata.isCollapsed: true', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 2, 'a.spec.ts'),
      makeOrderedProject('seq', 1, 2, 'b.spec.ts', ['ordertest:seq:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.metadata?.isCollapsed).toBe(true);
  });

  test('collapsed project metadata has stepIndex: 0', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 2, 'a.spec.ts'),
      makeOrderedProject('seq', 1, 2, 'b.spec.ts', ['ordertest:seq:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.metadata?.stepIndex).toBe(0);
  });

  test('collapsed project metadata has totalSteps: 1', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 3, 'a.spec.ts'),
      makeOrderedProject('seq', 1, 3, 'b.spec.ts', ['ordertest:seq:0']),
      makeOrderedProject('seq', 2, 3, 'c.spec.ts', ['ordertest:seq:1']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.metadata?.totalSteps).toBe(1);
  });

  test('collapsed project metadata sequenceName matches original', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('my-seq', 0, 2, 'a.spec.ts'),
      makeOrderedProject('my-seq', 1, 2, 'b.spec.ts', ['ordertest:my-seq:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result[0]?.metadata?.sequenceName).toBe('my-seq');
  });

  // -------------------------------------------------------------------------
  // testMatch — combines all files from the chain
  // -------------------------------------------------------------------------

  test('collapsed testMatch contains all files from the chain', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 3, 'login.spec.ts'),
      makeOrderedProject('seq', 1, 3, 'dashboard.spec.ts', ['ordertest:seq:0']),
      makeOrderedProject('seq', 2, 3, 'logout.spec.ts', ['ordertest:seq:1']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });
    const testMatch = result[0]?.testMatch;

    expect(Array.isArray(testMatch)).toBe(true);
    expect(testMatch as string[]).toContain('login.spec.ts');
    expect(testMatch as string[]).toContain('dashboard.spec.ts');
    expect(testMatch as string[]).toContain('logout.spec.ts');
  });

  test('collapsed testMatch preserves declaration order of files', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 3, 'first.spec.ts'),
      makeOrderedProject('seq', 1, 3, 'second.spec.ts', ['ordertest:seq:0']),
      makeOrderedProject('seq', 2, 3, 'third.spec.ts', ['ordertest:seq:1']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });
    const testMatch = result[0]?.testMatch as string[];

    expect(testMatch[0]).toBe('first.spec.ts');
    expect(testMatch[1]).toBe('second.spec.ts');
    expect(testMatch[2]).toBe('third.spec.ts');
  });

  test('single-step sequence produces a testMatch array with one entry', () => {
    const projects: GeneratedProject[] = [makeOrderedProject('solo-seq', 0, 1, 'only.spec.ts')];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });
    const testMatch = result[0]?.testMatch;

    expect(Array.isArray(testMatch)).toBe(true);
    expect(testMatch as string[]).toHaveLength(1);
    expect((testMatch as string[])[0]).toBe('only.spec.ts');
  });

  // -------------------------------------------------------------------------
  // Multiple sequences are each collapsed independently
  // -------------------------------------------------------------------------

  test('two independent sequences collapse into two separate projects', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq-a', 0, 2, 'a1.spec.ts'),
      makeOrderedProject('seq-a', 1, 2, 'a2.spec.ts', ['ordertest:seq-a:0']),
      makeOrderedProject('seq-b', 0, 2, 'b1.spec.ts'),
      makeOrderedProject('seq-b', 1, 2, 'b2.spec.ts', ['ordertest:seq-b:0']),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    // Two collapsed projects — one per sequence
    expect(result).toHaveLength(2);
    const names = result.map((p) => p.name);
    expect(names).toContain('ordertest:seq-a');
    expect(names).toContain('ordertest:seq-b');
  });

  test('each collapsed sequence has only its own files in testMatch', () => {
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq-a', 0, 1, 'a.spec.ts'),
      makeOrderedProject('seq-b', 0, 1, 'b.spec.ts'),
    ];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    const seqA = result.find((p) => p.name === 'ordertest:seq-a');
    const seqB = result.find((p) => p.name === 'ordertest:seq-b');

    expect(seqA?.testMatch as string[]).toContain('a.spec.ts');
    expect(seqA?.testMatch as string[]).not.toContain('b.spec.ts');

    expect(seqB?.testMatch as string[]).toContain('b.spec.ts');
    expect(seqB?.testMatch as string[]).not.toContain('a.spec.ts');
  });

  // -------------------------------------------------------------------------
  // Unordered pass-through projects
  // -------------------------------------------------------------------------

  test('unordered projects (no metadata) are passed through unchanged', () => {
    const ordered = makeOrderedProject('seq', 0, 1, 'a.spec.ts');
    const unordered = makeUnorderedProject('ordertest:unordered', [
      'other.spec.ts',
      'more.spec.ts',
    ]);
    const projects: GeneratedProject[] = [ordered, unordered];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    // collapsed ordered (1) + unordered (1) = 2
    expect(result).toHaveLength(2);
    const passthrough = result.find((p) => p.name === 'ordertest:unordered');
    expect(passthrough).toBeDefined();
    expect(passthrough?.metadata).toBeUndefined();
    expect(passthrough?.testMatch).toEqual(['other.spec.ts', 'more.spec.ts']);
  });

  test('unordered project is not collapsed and retains its testMatch array', () => {
    const unordered = makeUnorderedProject('ordertest:unordered', [
      'alpha.spec.ts',
      'beta.spec.ts',
      'gamma.spec.ts',
    ]);
    const projects: GeneratedProject[] = [unordered];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('ordertest:unordered');
    expect(result[0]?.testMatch).toEqual(['alpha.spec.ts', 'beta.spec.ts', 'gamma.spec.ts']);
  });

  test('multiple unordered projects are all passed through', () => {
    const u1 = makeUnorderedProject('custom-project-1', ['x.spec.ts']);
    const u2 = makeUnorderedProject('custom-project-2', ['y.spec.ts']);
    const projects: GeneratedProject[] = [u1, u2];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result).toHaveLength(2);
    const names = result.map((p) => p.name);
    expect(names).toContain('custom-project-1');
    expect(names).toContain('custom-project-2');
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  test('empty projects array returns empty array', () => {
    const result = applyShardGuard({
      projects: [],
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    expect(result).toHaveLength(0);
  });

  test('does not throw when called with only unordered projects', () => {
    const projects: GeneratedProject[] = [makeUnorderedProject('ordertest:unordered', ['spec.ts'])];

    expect(() => {
      applyShardGuard({ projects, shardInfo: SHARD_INFO_2_OF_5, strategy: 'collapse' });
    }).not.toThrow();
  });

  test('returns a plain array (not readonly)', () => {
    const projects: GeneratedProject[] = [makeOrderedProject('seq', 0, 1, 'a.spec.ts')];

    const result = applyShardGuard({
      projects,
      shardInfo: SHARD_INFO_2_OF_5,
      strategy: 'collapse',
    });

    // Verifies mutability — collapse returns a GeneratedProject[]
    expect(Array.isArray(result)).toBe(true);
  });

  test('shard source="argv" still collapses correctly', () => {
    const shardInfo: ShardInfo = { current: 1, total: 3, source: 'argv' };
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 2, 'a.spec.ts'),
      makeOrderedProject('seq', 1, 2, 'b.spec.ts', ['ordertest:seq:0']),
    ];

    const result = applyShardGuard({ projects, shardInfo, strategy: 'collapse' });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('ordertest:seq');
    expect(result[0]?.metadata?.isCollapsed).toBe(true);
  });

  test('shard source="env" still collapses correctly', () => {
    const shardInfo: ShardInfo = { current: 2, total: 4, source: 'env' };
    const projects: GeneratedProject[] = [
      makeOrderedProject('seq', 0, 2, 'a.spec.ts'),
      makeOrderedProject('seq', 1, 2, 'b.spec.ts', ['ordertest:seq:0']),
    ];

    const result = applyShardGuard({ projects, shardInfo, strategy: 'collapse' });

    expect(result).toHaveLength(1);
    expect(result[0]?.metadata?.isCollapsed).toBe(true);
  });
});
