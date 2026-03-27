import { expect, test } from '@playwright/test';

import type { SequenceDefinition } from '../../src/config/types.js';
import { UNORDERED_PROJECT_NAME } from '../../src/config/types.js';
import {
  collectOrderedFiles,
  generateProjects,
  generateUnorderedProject,
} from '../../src/engine/projectGenerator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serialSeq(name: string, files: SequenceDefinition['files']): SequenceDefinition {
  return { name, mode: 'serial', files };
}

function parallelSeq(name: string, files: SequenceDefinition['files']): SequenceDefinition {
  return { name, mode: 'parallel', files };
}

function fullyParallelSeq(name: string, files: SequenceDefinition['files']): SequenceDefinition {
  return { name, mode: 'fullyParallel', files };
}

// ---------------------------------------------------------------------------
// collectOrderedFiles
// ---------------------------------------------------------------------------

test.describe('collectOrderedFiles', () => {
  test('returns empty array for empty sequences', () => {
    expect(collectOrderedFiles([])).toEqual([]);
  });

  test('returns empty array when all sequences have no files', () => {
    expect(collectOrderedFiles([serialSeq('s', [])])).toEqual([]);
  });

  test('deduplicates files within a single sequence', () => {
    const seq = serialSeq('s', ['a.spec.ts', 'a.spec.ts', 'b.spec.ts']);
    const result = collectOrderedFiles([seq]);
    expect(result).toHaveLength(2);
    expect(result).toContain('a.spec.ts');
    expect(result).toContain('b.spec.ts');
  });

  test('deduplicates files across multiple sequences', () => {
    const seqA = serialSeq('a', ['shared.spec.ts', 'only-a.spec.ts']);
    const seqB = serialSeq('b', ['shared.spec.ts', 'only-b.spec.ts']);
    const result = collectOrderedFiles([seqA, seqB]);
    expect(result).toHaveLength(3);
    expect(result).toContain('shared.spec.ts');
    expect(result).toContain('only-a.spec.ts');
    expect(result).toContain('only-b.spec.ts');
  });

  test('handles string file entries', () => {
    const seq = serialSeq('s', ['login.spec.ts', 'checkout.spec.ts']);
    const result = collectOrderedFiles([seq]);
    expect(result).toContain('login.spec.ts');
    expect(result).toContain('checkout.spec.ts');
  });

  test('handles FileSpecification object entries', () => {
    const seq = serialSeq('s', [
      { file: 'login.spec.ts', tests: ['logs in'] },
      { file: 'checkout.spec.ts' },
    ]);
    const result = collectOrderedFiles([seq]);
    expect(result).toContain('login.spec.ts');
    expect(result).toContain('checkout.spec.ts');
  });

  test('handles mixed string and FileSpecification entries', () => {
    const seq = serialSeq('s', [
      'plain.spec.ts',
      { file: 'spec.spec.ts', tests: ['does a thing'] },
    ]);
    const result = collectOrderedFiles([seq]);
    expect(result).toContain('plain.spec.ts');
    expect(result).toContain('spec.spec.ts');
  });

  test('deduplicates across string and FileSpecification for the same path', () => {
    const seq = serialSeq('s', ['same.spec.ts', { file: 'same.spec.ts' }]);
    const result = collectOrderedFiles([seq]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('same.spec.ts');
  });
});

// ---------------------------------------------------------------------------
// generateProjects — strategy routing
// ---------------------------------------------------------------------------

test.describe('generateProjects — serial routing', () => {
  test('routes serial sequence to serial strategy (workers: 1)', () => {
    const seq = serialSeq('s', ['a.spec.ts', 'b.spec.ts']);
    const projects = generateProjects([seq]);
    for (const p of projects) {
      expect(p.workers).toBe(1);
    }
  });

  test('serial strategy sets fullyParallel: false on every project', () => {
    const seq = serialSeq('s', ['a.spec.ts', 'b.spec.ts']);
    const projects = generateProjects([seq]);
    for (const p of projects) {
      expect(p.fullyParallel).toBe(false);
    }
  });

  test('serial strategy produces one project per file', () => {
    const seq = serialSeq('s', ['a.spec.ts', 'b.spec.ts', 'c.spec.ts']);
    const projects = generateProjects([seq]);
    expect(projects).toHaveLength(3);
  });

  test('serial project metadata.mode is serial', () => {
    const seq = serialSeq('s', ['a.spec.ts']);
    const [project] = generateProjects([seq]);
    expect(project?.metadata?.mode).toBe('serial');
  });
});

test.describe('generateProjects — parallel routing', () => {
  test('routes parallel sequence — fullyParallel is false', () => {
    const seq = parallelSeq('p', ['a.spec.ts', 'b.spec.ts']);
    const projects = generateProjects([seq]);
    for (const p of projects) {
      expect(p.fullyParallel).toBe(false);
    }
  });

  test('parallel strategy does NOT force workers: 1', () => {
    const seq = parallelSeq('p', ['a.spec.ts']);
    const [project] = generateProjects([seq]);
    expect(project?.workers).toBeUndefined();
  });

  test('parallel strategy produces one project per file', () => {
    const seq = parallelSeq('p', ['a.spec.ts', 'b.spec.ts']);
    const projects = generateProjects([seq]);
    expect(projects).toHaveLength(2);
  });

  test('parallel project metadata.mode is parallel', () => {
    const seq = parallelSeq('p', ['a.spec.ts']);
    const [project] = generateProjects([seq]);
    expect(project?.metadata?.mode).toBe('parallel');
  });
});

test.describe('generateProjects — fullyParallel routing', () => {
  test('routes fullyParallel sequence — fullyParallel is true', () => {
    const seq = fullyParallelSeq('fp', ['a.spec.ts', 'b.spec.ts']);
    const projects = generateProjects([seq]);
    for (const p of projects) {
      expect(p.fullyParallel).toBe(true);
    }
  });

  test('fullyParallel strategy does NOT force workers: 1', () => {
    const seq = fullyParallelSeq('fp', ['a.spec.ts']);
    const [project] = generateProjects([seq]);
    expect(project?.workers).toBeUndefined();
  });

  test('fullyParallel strategy produces one project per file', () => {
    const seq = fullyParallelSeq('fp', ['a.spec.ts', 'b.spec.ts']);
    const projects = generateProjects([seq]);
    expect(projects).toHaveLength(2);
  });

  test('fullyParallel project metadata.mode is fullyParallel', () => {
    const seq = fullyParallelSeq('fp', ['a.spec.ts']);
    const [project] = generateProjects([seq]);
    expect(project?.metadata?.mode).toBe('fullyParallel');
  });

  test('fullyParallel testMatch is an array', () => {
    const seq = fullyParallelSeq('fp', ['a.spec.ts']);
    const [project] = generateProjects([seq]);
    expect(Array.isArray(project?.testMatch)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateProjects — multiple sequences (flat array)
// ---------------------------------------------------------------------------

test.describe('generateProjects — multiple sequences', () => {
  test('returns empty array for empty sequences input', () => {
    expect(generateProjects([])).toEqual([]);
  });

  test('concatenates projects from all sequences into a flat array', () => {
    const seqA = serialSeq('a', ['a1.spec.ts', 'a2.spec.ts']);
    const seqB = parallelSeq('b', ['b1.spec.ts']);
    const seqC = fullyParallelSeq('c', ['c1.spec.ts', 'c2.spec.ts', 'c3.spec.ts']);
    const projects = generateProjects([seqA, seqB, seqC]);
    // 2 + 1 + 3 = 6
    expect(projects).toHaveLength(6);
  });

  test('preserves sequence declaration order in the flat array', () => {
    const seqA = serialSeq('alpha', ['a.spec.ts']);
    const seqB = serialSeq('beta', ['b.spec.ts']);
    const projects = generateProjects([seqA, seqB]);
    expect(projects[0]?.name).toBe('ordertest:alpha:0');
    expect(projects[1]?.name).toBe('ordertest:beta:0');
  });

  test('each sequence builds its own independent dependency chain', () => {
    const seqA = serialSeq('a', ['a1.spec.ts', 'a2.spec.ts']);
    const seqB = serialSeq('b', ['b1.spec.ts', 'b2.spec.ts']);
    const projects = generateProjects([seqA, seqB]);
    // a:1 depends on a:0, b:1 depends on b:0 — no cross-sequence deps
    const a1 = projects.find((p) => p.name === 'ordertest:a:1');
    const b1 = projects.find((p) => p.name === 'ordertest:b:1');
    expect(a1?.dependencies).toEqual(['ordertest:a:0']);
    expect(b1?.dependencies).toEqual(['ordertest:b:0']);
  });
});

// ---------------------------------------------------------------------------
// generateUnorderedProject
// ---------------------------------------------------------------------------

test.describe('generateUnorderedProject', () => {
  test('project name is UNORDERED_PROJECT_NAME constant', () => {
    const project = generateUnorderedProject([]);
    expect(project.name).toBe(UNORDERED_PROJECT_NAME);
  });

  test('project name is ordertest:unordered', () => {
    const project = generateUnorderedProject([]);
    expect(project.name).toBe('ordertest:unordered');
  });

  test('testMatch is **/* catch-all glob', () => {
    const project = generateUnorderedProject([]);
    expect(project.testMatch).toBe('**/*');
  });

  test('project has no dependencies', () => {
    const project = generateUnorderedProject([serialSeq('s', ['a.spec.ts'])]);
    expect(project.dependencies).toBeUndefined();
  });

  test('project has no workers override', () => {
    const project = generateUnorderedProject([]);
    expect(project.workers).toBeUndefined();
  });

  test('returned regardless of how many sequences are provided', () => {
    const sequences: SequenceDefinition[] = [
      serialSeq('a', ['a.spec.ts']),
      parallelSeq('b', ['b.spec.ts']),
      fullyParallelSeq('c', ['c.spec.ts']),
    ];
    const project = generateUnorderedProject(sequences);
    expect(project.name).toBe(UNORDERED_PROJECT_NAME);
    expect(project.testMatch).toBe('**/*');
  });
});
