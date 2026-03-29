import { expect, test } from '@playwright/test';

import type { SequenceDefinition } from '../../src/config/types.js';
import { generateFullyParallelProjects } from '../../src/engine/fullyParallelStrategy.js';
import type { GeneratedProject } from '../../src/engine/fullyParallelStrategy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSequence(overrides: Partial<SequenceDefinition> = {}): SequenceDefinition {
  return {
    name: 'test-seq',
    mode: 'fullyParallel',
    files: ['a.spec.ts', 'b.spec.ts'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Single file
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — single file', () => {
  test('produces exactly one project', () => {
    const seq = makeSequence({ files: ['only.spec.ts'] });
    const result = generateFullyParallelProjects(seq);
    expect(result).toHaveLength(1);
  });

  test('project has fullyParallel: true', () => {
    const seq = makeSequence({ files: ['only.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.fullyParallel).toBe(true);
  });

  test('first project has empty dependencies array', () => {
    const seq = makeSequence({ files: ['only.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.dependencies).toEqual([]);
  });

  test('project name follows ordertest:<sequenceName>:0 convention', () => {
    const seq = makeSequence({ name: 'smoke', files: ['only.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.name).toBe('ordertest:smoke:0');
  });
});

// ---------------------------------------------------------------------------
// Multiple files — dependency chain
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — multiple files', () => {
  test('produces one project per file', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const result = generateFullyParallelProjects(seq);
    expect(result).toHaveLength(3);
  });

  test('all projects have fullyParallel: true', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    for (const project of generateFullyParallelProjects(seq)) {
      expect(project.fullyParallel).toBe(true);
    }
  });

  test('projects form a linear dependency chain', () => {
    const seq = makeSequence({ name: 'chain', files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const [p0, p1, p2] = generateFullyParallelProjects(seq) as [
      GeneratedProject,
      GeneratedProject,
      GeneratedProject,
    ];

    expect(p0.dependencies).toEqual([]);
    expect(p1.dependencies).toEqual(['ordertest:chain:0']);
    expect(p2.dependencies).toEqual(['ordertest:chain:1']);
  });

  test('each project name encodes its step index', () => {
    const seq = makeSequence({ name: 'steps', files: ['a.spec.ts', 'b.spec.ts'] });
    const [p0, p1] = generateFullyParallelProjects(seq) as [GeneratedProject, GeneratedProject];
    expect(p0.name).toBe('ordertest:steps:0');
    expect(p1.name).toBe('ordertest:steps:1');
  });
});

// ---------------------------------------------------------------------------
// testMatch is always an array
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — testMatch', () => {
  test('testMatch is an array, not a string', () => {
    const seq = makeSequence({ files: ['my.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(Array.isArray(project.testMatch)).toBe(true);
  });

  test('testMatch contains exactly the file path', () => {
    const seq = makeSequence({ files: ['path/to/my.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.testMatch).toEqual(['path/to/my.spec.ts']);
  });

  test('each project testMatch contains only its own file', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'] });
    const [p0, p1] = generateFullyParallelProjects(seq) as [GeneratedProject, GeneratedProject];
    expect(p0.testMatch).toEqual(['a.spec.ts']);
    expect(p1.testMatch).toEqual(['b.spec.ts']);
  });

  test('FileSpecification object entry resolves to its file path in testMatch', () => {
    const seq = makeSequence({ files: [{ file: 'spec/login.spec.ts', tests: ['logs in'] }] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.testMatch).toEqual(['spec/login.spec.ts']);
  });
});

// ---------------------------------------------------------------------------
// Workers override
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — workers', () => {
  test('workers is not set when sequence.workers is undefined', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.workers).toBeUndefined();
  });

  test('workers is set when sequence.workers is provided', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], workers: 4 });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.workers).toBe(4);
  });

  test('workers override propagates to every project in the chain', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts'], workers: 2 });
    for (const project of generateFullyParallelProjects(seq)) {
      expect(project.workers).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Grep from file tests / tags
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — grep', () => {
  test('no grep when file has no tests or tags', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.grep).toBeUndefined();
  });

  test('grep is set when FileSpecification has tests', () => {
    const seq = makeSequence({ files: [{ file: 'a.spec.ts', tests: ['logs in', 'logs out'] }] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.grep).toBeInstanceOf(RegExp);
  });

  test('grep pattern matches exact test names from FileSpecification', () => {
    const seq = makeSequence({ files: [{ file: 'a.spec.ts', tests: ['logs in'] }] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.grep?.test('logs in')).toBe(true);
    expect(project.grep?.test('unrelated test')).toBe(false);
  });

  test('grep is set when sequence-level tags are provided', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], tags: ['@smoke'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.grep).toBeInstanceOf(RegExp);
  });

  test('grep pattern matches sequence-level tag', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], tags: ['@smoke'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.grep?.test('checkout @smoke')).toBe(true);
    expect(project.grep?.test('untagged test')).toBe(false);
  });

  test('grep is set when FileSpecification has tags', () => {
    const seq = makeSequence({ files: [{ file: 'a.spec.ts', tags: ['@regression'] }] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.grep).toBeInstanceOf(RegExp);
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — metadata', () => {
  test('metadata.mode is fullyParallel', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.metadata?.mode).toBe('fullyParallel');
  });

  test('metadata.isCollapsed is false', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.metadata?.isCollapsed).toBe(false);
  });

  test('metadata.sequenceName matches the sequence name', () => {
    const seq = makeSequence({ name: 'my-seq', files: ['a.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.metadata?.sequenceName).toBe('my-seq');
  });

  test('metadata.stepIndex is correct for each project', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateFullyParallelProjects(seq);
    projects.forEach((project, idx) => {
      expect(project.metadata?.stepIndex).toBe(idx);
    });
  });

  test('metadata.totalSteps equals number of files', () => {
    const seq = makeSequence({ files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'] });
    const projects = generateFullyParallelProjects(seq);
    for (const project of projects) {
      expect(project.metadata?.totalSteps).toBe(3);
    }
  });

  test('retries and timeout propagate from sequence when set', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], retries: 2, timeout: 30000 });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.retries).toBe(2);
    expect(project.timeout).toBe(30000);
  });

  test('retries and timeout are absent when not set on sequence', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];
    expect(project.retries).toBeUndefined();
    expect(project.timeout).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Browser field → use.browserName
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — browser field', () => {
  test('use is undefined when sequence.browser is not set', () => {
    const seq = makeSequence({ files: ['a.spec.ts'] });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];

    expect(project.use).toBeUndefined();
  });

  test('use.browserName is set when sequence.browser is specified', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], browser: 'firefox' });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];

    expect(project.use).toEqual({ browserName: 'firefox' });
  });

  test('browser propagates to all projects in the chain', () => {
    const seq = makeSequence({
      files: ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'],
      browser: 'webkit',
    });
    const projects = generateFullyParallelProjects(seq);

    for (const project of projects) {
      expect(project.use).toEqual({ browserName: 'webkit' });
    }
  });

  test('browser value is preserved exactly as provided', () => {
    const seq = makeSequence({ files: ['a.spec.ts'], browser: 'chromium' });
    const [project] = generateFullyParallelProjects(seq) as [GeneratedProject];

    expect(project.use?.browserName).toBe('chromium');
  });
});

// ---------------------------------------------------------------------------
// Empty sequence
// ---------------------------------------------------------------------------

test.describe('generateFullyParallelProjects — edge cases', () => {
  test('empty files array produces empty projects array', () => {
    const seq = makeSequence({ files: [] });
    const result = generateFullyParallelProjects(seq);
    expect(result).toHaveLength(0);
  });
});
