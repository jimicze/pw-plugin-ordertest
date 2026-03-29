import { expect, test } from '@playwright/test';
import type { SequenceDefinition } from '../../src/config/types.js';
import { PROJECT_NAME_PREFIX } from '../../src/config/types.js';
import { generateSerialProjects, resolveFileEntry } from '../../src/engine/serialStrategy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal serial SequenceDefinition for tests. */
function makeSequence(overrides: Partial<SequenceDefinition> = {}): SequenceDefinition {
  return {
    name: 'test-seq',
    mode: 'serial',
    files: ['a.spec.ts'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveFileEntry
// ---------------------------------------------------------------------------

test.describe('resolveFileEntry', () => {
  test('string entry returns { file } only', () => {
    const result = resolveFileEntry('path/to/test.spec.ts');

    expect(result).toEqual({ file: 'path/to/test.spec.ts' });
    expect(result.tests).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  test('object entry with all fields returns { file, tests, tags }', () => {
    const result = resolveFileEntry({
      file: 'path/to/test.spec.ts',
      tests: ['should login', 'should logout'],
      tags: ['@smoke', '@regression'],
    });

    expect(result.file).toBe('path/to/test.spec.ts');
    expect(result.tests).toEqual(['should login', 'should logout']);
    expect(result.tags).toEqual(['@smoke', '@regression']);
  });

  test('object entry with file only returns { file } and leaves tests/tags undefined', () => {
    const result = resolveFileEntry({ file: 'only-file.spec.ts' });

    expect(result.file).toBe('only-file.spec.ts');
    expect(result.tests).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  test('object entry with tests but no tags returns { file, tests }', () => {
    const result = resolveFileEntry({
      file: 'filter.spec.ts',
      tests: ['login works'],
    });

    expect(result.file).toBe('filter.spec.ts');
    expect(result.tests).toEqual(['login works']);
    expect(result.tags).toBeUndefined();
  });

  test('object entry with tags but no tests returns { file, tags }', () => {
    const result = resolveFileEntry({
      file: 'tagged.spec.ts',
      tags: ['@critical'],
    });

    expect(result.file).toBe('tagged.spec.ts');
    expect(result.tests).toBeUndefined();
    expect(result.tags).toEqual(['@critical']);
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — project count
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — project count', () => {
  test('single file produces exactly one project', () => {
    const seq = makeSequence({ files: ['only.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects).toHaveLength(1);
  });

  test('three files produce exactly three projects', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects).toHaveLength(3);
  });

  test('empty files array produces no projects', () => {
    const seq = makeSequence({ files: [] });
    const projects = generateSerialProjects(seq);

    expect(projects).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — project naming
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — project naming', () => {
  test('single file: project name is <prefix>:<seqName>:0', () => {
    const seq = makeSequence({ name: 'checkout-flow', files: ['checkout.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.name).toBe(`${PROJECT_NAME_PREFIX}:checkout-flow:0`);
  });

  test('multiple files: names are indexed from 0', () => {
    const seq = makeSequence({
      name: 'my-seq',
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'],
    });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.name).toBe(`${PROJECT_NAME_PREFIX}:my-seq:0`);
    expect(projects[1]?.name).toBe(`${PROJECT_NAME_PREFIX}:my-seq:1`);
    expect(projects[2]?.name).toBe(`${PROJECT_NAME_PREFIX}:my-seq:2`);
  });

  test('sequence name is reflected verbatim in each project name', () => {
    const seq = makeSequence({ name: 'order-critical', files: ['x.spec.ts', 'y.spec.ts'] });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.name).toMatch(/^ordertest:order-critical:\d+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — dependency chaining
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — dependency chaining', () => {
  test('single file: first project has empty dependencies array', () => {
    const seq = makeSequence({ files: ['first.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.dependencies).toEqual([]);
  });

  test('second project depends on the first project', () => {
    const seq = makeSequence({ name: 'chain', files: ['a.spec.ts', 'b.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.dependencies).toEqual([]);
    expect(projects[1]?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:chain:0`]);
  });

  test('three projects form a linear chain', () => {
    const seq = makeSequence({
      name: 'linear',
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'],
    });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.dependencies).toEqual([]);
    expect(projects[1]?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:linear:0`]);
    expect(projects[2]?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:linear:1`]);
  });

  test('each project N depends only on project N-1 (no transitive deps)', () => {
    const seq = makeSequence({
      name: 'seq',
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'd.spec.ts'],
    });
    const projects = generateSerialProjects(seq);

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      if (i === 0) {
        expect(project?.dependencies).toEqual([]);
      } else {
        // Exactly one dependency — no transitive entries
        expect(project?.dependencies).toHaveLength(1);
        expect(project?.dependencies?.[0]).toBe(`${PROJECT_NAME_PREFIX}:seq:${i - 1}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — workers and fullyParallel
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — workers and fullyParallel', () => {
  test('all projects have workers: 1', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.workers).toBe(1);
    }
  });

  test('all projects have fullyParallel: false', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'] });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.fullyParallel).toBe(false);
    }
  });

  test('sequence-level workers override is ignored (serial always uses 1)', () => {
    // The serial strategy must enforce workers: 1 regardless of sequence.workers
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], workers: 8 });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.workers).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — testMatch
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — testMatch', () => {
  test('testMatch is the file path string for a string entry', () => {
    const seq = makeSequence({ files: ['tests/auth/login.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.testMatch).toBe('tests/auth/login.spec.ts');
  });

  test('testMatch is the file path string for an object entry', () => {
    const seq = makeSequence({ files: [{ file: 'tests/checkout.spec.ts' }] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.testMatch).toBe('tests/checkout.spec.ts');
  });

  test('each project testMatch corresponds to its respective file', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.testMatch).toBe('a.spec.ts');
    expect(projects[1]?.testMatch).toBe('b.spec.ts');
    expect(projects[2]?.testMatch).toBe('c.spec.ts');
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — metadata
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — metadata', () => {
  test('metadata.sequenceName matches the sequence name', () => {
    const seq = makeSequence({ name: 'my-flow', files: ['a.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.metadata?.sequenceName).toBe('my-flow');
  });

  test('metadata.mode is always "serial"', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'] });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.metadata?.mode).toBe('serial');
    }
  });

  test('metadata.isCollapsed is always false', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'] });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.metadata?.isCollapsed).toBe(false);
    }
  });

  test('metadata.stepIndex matches the project index', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.metadata?.stepIndex).toBe(0);
    expect(projects[1]?.metadata?.stepIndex).toBe(1);
    expect(projects[2]?.metadata?.stepIndex).toBe(2);
  });

  test('metadata.totalSteps equals the number of files in the sequence', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.metadata?.totalSteps).toBe(3);
    }
  });

  test('metadata is present on every project', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'] });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.metadata).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — retries and timeout propagation
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — retries and timeout propagation', () => {
  test('retries from sequence are propagated to all projects', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], retries: 3 });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.retries).toBe(3);
    }
  });

  test('retries is absent when not set on sequence', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.retries).toBeUndefined();
  });

  test('retries: 0 is propagated (not treated as absent)', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], retries: 0 });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.retries).toBe(0);
    }
  });

  test('timeout from sequence is propagated to all projects', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], timeout: 60_000 });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.timeout).toBe(60_000);
    }
  });

  test('timeout is absent when not set on sequence', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.timeout).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — grep / test-level filtering
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — grep filtering', () => {
  test('no grep when file entry has no tests or tags and sequence has no tags', () => {
    const seq = makeSequence({ files: ['plain.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.grep).toBeUndefined();
  });

  test('grep applied when file entry specifies test names', () => {
    const seq = makeSequence({
      files: [{ file: 'auth.spec.ts', tests: ['should login', 'should logout'] }],
    });
    const projects = generateSerialProjects(seq);
    const grep = projects[0]?.grep;

    expect(grep).toBeInstanceOf(RegExp);
    // Must match exact test names
    expect(grep?.test('should login')).toBe(true);
    expect(grep?.test('should logout')).toBe(true);
    // Must not match unrelated titles
    expect(grep?.test('should register')).toBe(false);
  });

  test('grep pattern uses anchored exact matching for test names (^…$)', () => {
    const seq = makeSequence({
      files: [{ file: 'x.spec.ts', tests: ['exact title'] }],
    });
    const projects = generateSerialProjects(seq);
    const grep = projects[0]?.grep;

    // Anchored: prefix/suffix must not match
    expect(grep?.test('exact title')).toBe(true);
    expect(grep?.test('prefix exact title')).toBe(false);
    expect(grep?.test('exact title suffix')).toBe(false);
  });

  test('grep applied when sequence specifies tags only', () => {
    const seq = makeSequence({
      files: ['a.spec.ts'],
      tags: ['@smoke'],
    });
    const projects = generateSerialProjects(seq);
    const grep = projects[0]?.grep;

    expect(grep).toBeInstanceOf(RegExp);
    expect(grep?.test('login test @smoke')).toBe(true);
    expect(grep?.test('checkout test @regression')).toBe(false);
  });

  test('grep applied when file-level tags are provided', () => {
    const seq = makeSequence({
      files: [{ file: 'b.spec.ts', tags: ['@critical'] }],
    });
    const projects = generateSerialProjects(seq);
    const grep = projects[0]?.grep;

    expect(grep).toBeInstanceOf(RegExp);
    expect(grep?.test('some test @critical')).toBe(true);
    expect(grep?.test('some test @smoke')).toBe(false);
  });

  test('sequence-level and file-level tags are merged for grep', () => {
    const seq = makeSequence({
      files: [{ file: 'c.spec.ts', tags: ['@regression'] }],
      tags: ['@smoke'],
    });
    const projects = generateSerialProjects(seq);
    const grep = projects[0]?.grep;

    expect(grep).toBeInstanceOf(RegExp);
    // Both tags should match
    expect(grep?.test('login @smoke')).toBe(true);
    expect(grep?.test('checkout @regression')).toBe(true);
  });

  test('when both tests and tags supplied, test-name filter takes precedence', () => {
    // Per v1 design: test names win; tags are noted in debug only.
    const seq = makeSequence({
      files: [{ file: 'd.spec.ts', tests: ['login works'], tags: ['@smoke'] }],
    });
    const projects = generateSerialProjects(seq);
    const grep = projects[0]?.grep;

    expect(grep).toBeInstanceOf(RegExp);
    // Exact test name must match
    expect(grep?.test('login works')).toBe(true);
    // Tag-only title must NOT match (tests win)
    expect(grep?.test('another test @smoke')).toBe(false);
  });

  test('grep is absent for a file with empty tests array', () => {
    const seq = makeSequence({
      files: [{ file: 'e.spec.ts', tests: [] }],
    });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.grep).toBeUndefined();
  });

  test('each file gets its own independent grep pattern', () => {
    const seq = makeSequence({
      name: 'multi-grep',
      files: [
        { file: 'a.spec.ts', tests: ['test A'] },
        { file: 'b.spec.ts', tests: ['test B'] },
        'c.spec.ts',
      ],
    });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.grep?.test('test A')).toBe(true);
    expect(projects[0]?.grep?.test('test B')).toBe(false);
    expect(projects[1]?.grep?.test('test B')).toBe(true);
    expect(projects[1]?.grep?.test('test A')).toBe(false);
    expect(projects[2]?.grep).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — optional logger
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — optional logger', () => {
  test('runs without errors when no logger is provided', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'] });

    expect(() => generateSerialProjects(seq)).not.toThrow();
  });

  test('accepts a logger object without throwing', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });

    const mockLogger = {
      debug: (_obj: unknown, _msg: string) => {},
      info: (_obj: unknown, _msg: string) => {},
      warn: (_obj: unknown, _msg: string) => {},
      error: (_obj: unknown, _msg: string) => {},
    };

    // The Logger type used by the module is pino-compatible; a structural duck
    // type is sufficient here.
    expect(() =>
      generateSerialProjects(seq, mockLogger as Parameters<typeof generateSerialProjects>[1]),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — browser field → use.browserName
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — browser field', () => {
  test('use is undefined when sequence.browser is not set', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.use).toBeUndefined();
  });

  test('use.browserName is set when sequence.browser is specified', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], browser: 'firefox' });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.use).toEqual({ browserName: 'firefox' });
  });

  test('browser propagates to all projects in the chain', () => {
    const seq = makeSequence({
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'],
      browser: 'webkit',
    });
    const projects = generateSerialProjects(seq);

    for (const project of projects) {
      expect(project.use).toEqual({ browserName: 'webkit' });
    }
  });

  test('browser value is preserved exactly as provided', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], browser: 'chromium' });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.use?.browserName).toBe('chromium');
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — mixed FileEntry types
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — mixed FileEntry types', () => {
  test('handles mix of string and object entries correctly', () => {
    const seq = makeSequence({
      name: 'mixed',
      files: [
        'plain.spec.ts',
        { file: 'filtered.spec.ts', tests: ['only this test'] },
        { file: 'tagged.spec.ts', tags: ['@smoke'] },
      ],
    });
    const projects = generateSerialProjects(seq);

    expect(projects).toHaveLength(3);
    expect(projects[0]?.testMatch).toBe('plain.spec.ts');
    expect(projects[0]?.grep).toBeUndefined();

    expect(projects[1]?.testMatch).toBe('filtered.spec.ts');
    expect(projects[1]?.grep).toBeInstanceOf(RegExp);

    expect(projects[2]?.testMatch).toBe('tagged.spec.ts');
    expect(projects[2]?.grep).toBeInstanceOf(RegExp);
  });

  test('dependency chain is consistent across mixed entry types', () => {
    const seq = makeSequence({
      name: 'mixed-chain',
      files: ['a.spec.ts', { file: 'b.spec.ts' }, 'c.spec.ts'],
    });
    const projects = generateSerialProjects(seq);

    expect(projects[0]?.dependencies).toEqual([]);
    expect(projects[1]?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:mixed-chain:0`]);
    expect(projects[2]?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:mixed-chain:1`]);
  });
});

// ---------------------------------------------------------------------------
// generateSerialProjects — immutability of output shape
// ---------------------------------------------------------------------------

test.describe('generateSerialProjects — output shape', () => {
  test('returned array is a plain array (not readonly)', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const projects = generateSerialProjects(seq);

    expect(Array.isArray(projects)).toBe(true);
  });

  test('each project object has all required keys', () => {
    const seq = makeSequence({ name: 'shape-check', files: ['x.spec.ts'] });
    const projects = generateSerialProjects(seq);
    const project = projects[0];

    expect(project).toHaveProperty('name');
    expect(project).toHaveProperty('testMatch');
    expect(project).toHaveProperty('dependencies');
    expect(project).toHaveProperty('workers');
    expect(project).toHaveProperty('fullyParallel');
    expect(project).toHaveProperty('metadata');
  });

  test('deterministic: same input always produces the same output', () => {
    const seq = makeSequence({ name: 'det', files: ['a.spec.ts', 'b.spec.ts'] });

    const first = generateSerialProjects(seq);
    const second = generateSerialProjects(seq);

    expect(first).toEqual(second);
  });
});
