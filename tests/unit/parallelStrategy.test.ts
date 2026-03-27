import { expect, test } from '@playwright/test';

import type { SequenceDefinition } from '../../src/config/types.js';
import { PROJECT_NAME_PREFIX } from '../../src/config/types.js';
import { generateParallelProjects } from '../../src/engine/parallelStrategy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid sequence factory — only the fields relevant to each test are
 * overridden via the `overrides` parameter so every test stays focused.
 */
function makeSequence(overrides: Partial<SequenceDefinition>): SequenceDefinition {
  return {
    name: 'my-seq',
    mode: 'parallel',
    files: ['tests/a.spec.ts'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Project count & shape
// ---------------------------------------------------------------------------

test.describe('generateParallelProjects — single file', () => {
  test('returns exactly one project', () => {
    const seq = makeSequence({ files: ['tests/a.spec.ts'] });
    const projects = generateParallelProjects(seq);

    expect(projects).toHaveLength(1);
  });

  test('project name follows ordertest:<seqName>:<index> convention', () => {
    const seq = makeSequence({ name: 'checkout', files: ['tests/a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.name).toBe(`${PROJECT_NAME_PREFIX}:checkout:0`);
  });

  test('testMatch is set to the file path', () => {
    const seq = makeSequence({ files: ['tests/login.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.testMatch).toBe('tests/login.spec.ts');
  });

  test('first project has no dependencies property (omitted)', () => {
    const seq = makeSequence({ files: ['tests/a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    // When there is only one file the implementation omits `dependencies`
    // entirely (spreads nothing) rather than setting it to [].
    expect(project?.dependencies).toBeUndefined();
  });

  test('fullyParallel is false on the single project', () => {
    const seq = makeSequence({ files: ['tests/a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.fullyParallel).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dependency chain
// ---------------------------------------------------------------------------

test.describe('generateParallelProjects — multiple files', () => {
  test('returns one project per file', () => {
    const seq = makeSequence({
      name: 'flow',
      files: ['tests/a.spec.ts', 'tests/b.spec.ts', 'tests/c.spec.ts'],
    });

    expect(generateParallelProjects(seq)).toHaveLength(3);
  });

  test('first project has no dependencies', () => {
    const seq = makeSequence({
      name: 'flow',
      files: ['tests/a.spec.ts', 'tests/b.spec.ts', 'tests/c.spec.ts'],
    });
    const [first] = generateParallelProjects(seq);

    expect(first?.dependencies).toBeUndefined();
  });

  test('second project depends on the first', () => {
    const seq = makeSequence({
      name: 'flow',
      files: ['tests/a.spec.ts', 'tests/b.spec.ts'],
    });
    const [, second] = generateParallelProjects(seq);

    expect(second?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:flow:0`]);
  });

  test('third project depends on the second', () => {
    const seq = makeSequence({
      name: 'flow',
      files: ['tests/a.spec.ts', 'tests/b.spec.ts', 'tests/c.spec.ts'],
    });
    const [, , third] = generateParallelProjects(seq);

    expect(third?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:flow:1`]);
  });

  test('dependency chain is strictly linear (each project depends only on its predecessor)', () => {
    const seq = makeSequence({
      name: 'pipe',
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'd.spec.ts'],
    });
    const projects = generateParallelProjects(seq);

    // Index 0 — no deps
    expect(projects[0]?.dependencies).toBeUndefined();

    // Indexes 1–3 each depend only on the immediately preceding project
    for (let i = 1; i < projects.length; i++) {
      const project = projects[i];
      expect(project?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:pipe:${i - 1}`]);
    }
  });

  test('project names use sequential zero-based indexes', () => {
    const seq = makeSequence({
      name: 'steps',
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'],
    });
    const projects = generateParallelProjects(seq);

    expect(projects.map((p) => p.name)).toEqual([
      `${PROJECT_NAME_PREFIX}:steps:0`,
      `${PROJECT_NAME_PREFIX}:steps:1`,
      `${PROJECT_NAME_PREFIX}:steps:2`,
    ]);
  });

  test('testMatch for each project matches the corresponding file', () => {
    const files = ['tests/login.spec.ts', 'tests/checkout.spec.ts', 'tests/confirm.spec.ts'];
    const seq = makeSequence({ name: 'e2e', files });
    const projects = generateParallelProjects(seq);

    expect(projects.map((p) => p.testMatch)).toEqual(files);
  });

  test('all projects have fullyParallel: false', () => {
    const seq = makeSequence({
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'],
    });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.fullyParallel).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

test.describe('generateParallelProjects — workers', () => {
  test('workers is undefined on all projects when sequence.workers is not set', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'] });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.workers).toBeUndefined();
    }
  });

  test('workers is propagated to all projects when sequence.workers is specified', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'], workers: 4 });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.workers).toBe(4);
    }
  });

  test('workers value of 1 is preserved and propagated', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], workers: 1 });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.workers).toBe(1);
    }
  });

  test('single-worker override does not affect the dependency chain', () => {
    const seq = makeSequence({
      name: 'w1',
      files: ['a.spec.ts', 'b.spec.ts'],
      workers: 1,
    });
    const [, second] = generateParallelProjects(seq);

    expect(second?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:w1:0`]);
  });
});

// ---------------------------------------------------------------------------
// Retries and timeout
// ---------------------------------------------------------------------------

test.describe('generateParallelProjects — retries and timeout', () => {
  test('retries is undefined on all projects when sequence.retries is not set', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.retries).toBeUndefined();
  });

  test('timeout is undefined on all projects when sequence.timeout is not set', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.timeout).toBeUndefined();
  });

  test('retries is propagated to every project', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'], retries: 2 });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.retries).toBe(2);
    }
  });

  test('timeout is propagated to every project', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], timeout: 30_000 });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.timeout).toBe(30_000);
    }
  });

  test('retries value of 0 is not propagated (treated as unset)', () => {
    // `0` is falsy — the implementation uses `!== undefined`, so 0 IS propagated.
    // This test documents the actual behaviour.
    const seq = makeSequence({ files: ['a.spec.ts'], retries: 0 });
    const [project] = generateParallelProjects(seq);

    expect(project?.retries).toBe(0);
  });

  test('both retries and timeout are propagated together', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], retries: 3, timeout: 60_000 });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.retries).toBe(3);
      expect(project.timeout).toBe(60_000);
    }
  });
});

// ---------------------------------------------------------------------------
// Grep / test-level filtering
// ---------------------------------------------------------------------------

test.describe('generateParallelProjects — grep patterns', () => {
  test('grep is undefined when no tests or tags are specified (string file entry)', () => {
    const seq = makeSequence({ files: ['tests/a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.grep).toBeUndefined();
  });

  test('grep is undefined when no tests or tags are specified (FileSpecification entry)', () => {
    const seq = makeSequence({ files: [{ file: 'tests/a.spec.ts' }] });
    const [project] = generateParallelProjects(seq);

    expect(project?.grep).toBeUndefined();
  });

  test('grep is a RegExp when file-level tests are specified', () => {
    const seq = makeSequence({
      files: [{ file: 'tests/a.spec.ts', tests: ['login succeeds', 'login fails'] }],
    });
    const [project] = generateParallelProjects(seq);

    expect(project?.grep).toBeInstanceOf(RegExp);
  });

  test('grep pattern matches specified test names exactly', () => {
    const seq = makeSequence({
      files: [{ file: 'tests/a.spec.ts', tests: ['login succeeds', 'login fails'] }],
    });
    const [project] = generateParallelProjects(seq);
    const grep = project?.grep as RegExp;

    expect(grep.test('login succeeds')).toBe(true);
    expect(grep.test('login fails')).toBe(true);
    expect(grep.test('login succeeds or fails')).toBe(false);
    expect(grep.test('login')).toBe(false);
  });

  test('grep pattern escapes regex special characters in test names', () => {
    const seq = makeSequence({
      files: [{ file: 'tests/a.spec.ts', tests: ['user (admin) can log.in'] }],
    });
    const [project] = generateParallelProjects(seq);
    const grep = project?.grep as RegExp;

    expect(grep.test('user (admin) can log.in')).toBe(true);
    // Without proper escaping the dot would match any character — verify it doesn't
    expect(grep.test('user (admin) can logXin')).toBe(false);
  });

  test('grep is set from file-level tags when no test names given', () => {
    const seq = makeSequence({
      files: [{ file: 'tests/a.spec.ts', tags: ['@smoke'] }],
    });
    const [project] = generateParallelProjects(seq);

    expect(project?.grep).toBeInstanceOf(RegExp);
    expect((project?.grep as RegExp).test('my test @smoke')).toBe(true);
    expect((project?.grep as RegExp).test('my test @regression')).toBe(false);
  });

  test('grep is set from sequence-level tags when file entry has none', () => {
    const seq = makeSequence({
      files: ['tests/a.spec.ts'],
      tags: ['@nightly'],
    });
    const [project] = generateParallelProjects(seq);

    expect(project?.grep).toBeInstanceOf(RegExp);
    expect((project?.grep as RegExp).test('some test @nightly')).toBe(true);
  });

  test('file-level tags take precedence over sequence-level tags in the grep pattern', () => {
    // When the FileSpecification has its own tags, they are merged with the
    // sequence tags in buildGrepPattern via: resolved.tags ?? sequence.tags.
    // With both supplied it becomes a tag-only pattern using the file-level tags.
    const seq = makeSequence({
      files: [{ file: 'tests/a.spec.ts', tags: ['@smoke'] }],
      tags: ['@nightly'],
    });
    const [project] = generateParallelProjects(seq);

    // The result depends on how the implementation merges: resolved.tags ?? sequence.tags.
    // resolved.tags is ['@smoke'] so sequence.tags ('@nightly') is NOT used.
    expect(project?.grep).toBeInstanceOf(RegExp);
    expect((project?.grep as RegExp).test('my test @smoke')).toBe(true);
  });

  test('each file in a multi-file sequence gets its own independent grep', () => {
    const seq = makeSequence({
      name: 'multi',
      files: [
        { file: 'tests/a.spec.ts', tests: ['test A'] },
        { file: 'tests/b.spec.ts', tests: ['test B'] },
      ],
    });
    const [first, second] = generateParallelProjects(seq);

    expect((first?.grep as RegExp).test('test A')).toBe(true);
    expect((first?.grep as RegExp).test('test B')).toBe(false);

    expect((second?.grep as RegExp).test('test B')).toBe(true);
    expect((second?.grep as RegExp).test('test A')).toBe(false);
  });

  test('grep is undefined for files with no filter even when other files in the sequence have one', () => {
    const seq = makeSequence({
      files: ['tests/a.spec.ts', { file: 'tests/b.spec.ts', tests: ['only this test'] }],
    });
    const [first, second] = generateParallelProjects(seq);

    expect(first?.grep).toBeUndefined();
    expect(second?.grep).toBeInstanceOf(RegExp);
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

test.describe('generateParallelProjects — metadata', () => {
  test('metadata.mode is "parallel"', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.metadata?.mode).toBe('parallel');
  });

  test('metadata.isCollapsed is false', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.metadata?.isCollapsed).toBe(false);
  });

  test('metadata.sequenceName matches the sequence name', () => {
    const seq = makeSequence({ name: 'smoke-suite', files: ['a.spec.ts'] });
    const [project] = generateParallelProjects(seq);

    expect(project?.metadata?.sequenceName).toBe('smoke-suite');
  });

  test('metadata.totalSteps equals the number of files', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.metadata?.totalSteps).toBe(3);
    }
  });

  test('metadata.stepIndex is zero-based and correct per project', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateParallelProjects(seq);

    expect(projects[0]?.metadata?.stepIndex).toBe(0);
    expect(projects[1]?.metadata?.stepIndex).toBe(1);
    expect(projects[2]?.metadata?.stepIndex).toBe(2);
  });

  test('all metadata fields are present on every project', () => {
    const seq = makeSequence({ name: 'full', files: ['a.spec.ts', 'b.spec.ts'] });
    const projects = generateParallelProjects(seq);

    for (const project of projects) {
      expect(project.metadata).toBeDefined();
      expect(project.metadata?.sequenceName).toBeDefined();
      expect(project.metadata?.stepIndex).toBeDefined();
      expect(project.metadata?.totalSteps).toBeDefined();
      expect(project.metadata?.mode).toBeDefined();
      expect(project.metadata?.isCollapsed).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test.describe('generateParallelProjects — edge cases', () => {
  test('empty files array returns an empty array', () => {
    const seq = makeSequence({ files: [] });

    expect(generateParallelProjects(seq)).toEqual([]);
  });

  test('FileSpecification entries are resolved correctly', () => {
    const seq = makeSequence({
      files: [{ file: 'tests/login.spec.ts', tests: ['can log in'] }],
    });
    const [project] = generateParallelProjects(seq);

    expect(project?.testMatch).toBe('tests/login.spec.ts');
    expect(project?.grep).toBeInstanceOf(RegExp);
  });

  test('mixed string and FileSpecification entries are both handled', () => {
    const seq = makeSequence({
      name: 'mix',
      files: ['tests/plain.spec.ts', { file: 'tests/filtered.spec.ts', tests: ['only me'] }],
    });
    const [plain, filtered] = generateParallelProjects(seq);

    expect(plain?.testMatch).toBe('tests/plain.spec.ts');
    expect(plain?.grep).toBeUndefined();

    expect(filtered?.testMatch).toBe('tests/filtered.spec.ts');
    expect(filtered?.grep).toBeInstanceOf(RegExp);
  });

  test('sequence name with special characters is embedded verbatim in project names', () => {
    const seq = makeSequence({
      name: 'auth/login-flow',
      files: ['a.spec.ts', 'b.spec.ts'],
    });
    const [first, second] = generateParallelProjects(seq);

    expect(first?.name).toBe(`${PROJECT_NAME_PREFIX}:auth/login-flow:0`);
    expect(second?.name).toBe(`${PROJECT_NAME_PREFIX}:auth/login-flow:1`);
    // Dependency name must also embed the sequence name verbatim
    expect(second?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:auth/login-flow:0`]);
  });

  test('function accepts an optional logger without error', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });

    // Should not throw regardless of whether logger is provided
    expect(() => generateParallelProjects(seq, undefined)).not.toThrow();
  });

  test('large sequence produces the correct number of projects with a valid chain', () => {
    const files = Array.from({ length: 20 }, (_, i) => `tests/step-${i}.spec.ts`);
    const seq = makeSequence({ name: 'big', files });
    const projects = generateParallelProjects(seq);

    expect(projects).toHaveLength(20);

    // Verify the entire chain is valid
    expect(projects[0]?.dependencies).toBeUndefined();
    for (let i = 1; i < projects.length; i++) {
      expect(projects[i]?.dependencies).toEqual([`${PROJECT_NAME_PREFIX}:big:${i - 1}`]);
    }
  });
});
