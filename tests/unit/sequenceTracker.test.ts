import { expect, test } from '@playwright/test';
import { SequenceTracker, parseProjectName } from '../../src/reporter/sequenceTracker.js';

// ---------------------------------------------------------------------------
// parseProjectName
// ---------------------------------------------------------------------------

test.describe('parseProjectName', () => {
  test.describe('valid inputs', () => {
    test('parses step 0 correctly', () => {
      const result = parseProjectName('ordertest:checkout:0');
      expect(result).toEqual({ sequenceName: 'checkout', stepIndex: 0 });
    });

    test('parses step index greater than 0', () => {
      const result = parseProjectName('ordertest:my-flow:3');
      expect(result).toEqual({ sequenceName: 'my-flow', stepIndex: 3 });
    });

    test('parses a double-digit step index', () => {
      const result = parseProjectName('ordertest:big-suite:12');
      expect(result).toEqual({ sequenceName: 'big-suite', stepIndex: 12 });
    });

    test('sequence name with underscores is preserved', () => {
      const result = parseProjectName('ordertest:my_flow:1');
      expect(result).toEqual({ sequenceName: 'my_flow', stepIndex: 1 });
    });

    test('sequence name with dots is preserved', () => {
      const result = parseProjectName('ordertest:flow.v2:0');
      expect(result).toEqual({ sequenceName: 'flow.v2', stepIndex: 0 });
    });

    test('sequence name containing colons uses the last segment as step index', () => {
      // The parser takes everything after the prefix up to the last colon as the sequence name
      const result = parseProjectName('ordertest:a:b:2');
      expect(result).toEqual({ sequenceName: 'a:b', stepIndex: 2 });
    });
  });

  test.describe('invalid inputs — wrong prefix', () => {
    test('returns undefined for a completely different prefix', () => {
      expect(parseProjectName('other-prefix:foo:0')).toBeUndefined();
    });

    test('returns undefined for an empty string', () => {
      expect(parseProjectName('')).toBeUndefined();
    });

    test('returns undefined for a plain project name with no prefix', () => {
      expect(parseProjectName('chromium')).toBeUndefined();
    });

    test('returns undefined when prefix is present but not at position 0', () => {
      expect(parseProjectName('x-ordertest:foo:0')).toBeUndefined();
    });
  });

  test.describe('invalid inputs — structural issues', () => {
    test('returns undefined when there is no step index segment', () => {
      // "ordertest:unordered" — the unordered passthrough project
      expect(parseProjectName('ordertest:unordered')).toBeUndefined();
    });

    test('returns undefined for the bare prefix with no further segments', () => {
      expect(parseProjectName('ordertest:')).toBeUndefined();
    });

    test('returns undefined when sequence name is empty', () => {
      // "ordertest::0" — empty sequence name
      expect(parseProjectName('ordertest::0')).toBeUndefined();
    });
  });

  test.describe('invalid inputs — bad step index', () => {
    test('returns undefined for a non-numeric step index', () => {
      expect(parseProjectName('ordertest:foo:abc')).toBeUndefined();
    });

    test('returns undefined for a negative step index', () => {
      expect(parseProjectName('ordertest:foo:-1')).toBeUndefined();
    });

    test('returns undefined for a float step index', () => {
      expect(parseProjectName('ordertest:foo:1.5')).toBeUndefined();
    });

    test('returns undefined for an empty step index segment', () => {
      // Trailing colon makes the step segment empty
      expect(parseProjectName('ordertest:foo:')).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// SequenceTracker.buildFromProjectNames
// ---------------------------------------------------------------------------

test.describe('SequenceTracker.buildFromProjectNames', () => {
  test('handles an empty project-names array without throwing', () => {
    const tracker = new SequenceTracker();
    expect(() => tracker.buildFromProjectNames([])).not.toThrow();
    expect(tracker.getAllSequences()).toHaveLength(0);
  });

  test('builds sequence state from a single valid project name', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.getAllSequences()).toContain('checkout');
  });

  test('builds sequence state from multiple steps of the same sequence', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames([
      'ordertest:checkout:0',
      'ordertest:checkout:1',
      'ordertest:checkout:2',
    ]);
    expect(tracker.getAllSequences()).toEqual(['checkout']);
  });

  test('builds multiple distinct sequences', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0', 'ordertest:auth:0', 'ordertest:auth:1']);
    const sequences = tracker.getAllSequences();
    expect(sequences).toContain('checkout');
    expect(sequences).toContain('auth');
    expect(sequences).toHaveLength(2);
  });

  test('ignores the unordered passthrough project name', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:unordered', 'ordertest:checkout:0']);
    expect(tracker.getAllSequences()).toEqual(['checkout']);
    expect(tracker.isOrderedProject('ordertest:unordered')).toBe(false);
  });

  test('ignores native Playwright project names (no ordertest prefix)', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['chromium', 'firefox', 'ordertest:checkout:0']);
    expect(tracker.getAllSequences()).toEqual(['checkout']);
    expect(tracker.isOrderedProject('chromium')).toBe(false);
  });

  test('ignores all non-ordered names when no valid names are present', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['chromium', 'ordertest:unordered']);
    expect(tracker.getAllSequences()).toHaveLength(0);
  });

  test('is idempotent — calling again with same input resets to same state', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.getAllSequences()).toEqual(['checkout']);
  });

  test('rebuild with different input replaces old state', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.buildFromProjectNames(['ordertest:auth:0', 'ordertest:auth:1']);
    expect(tracker.getAllSequences()).toEqual(['auth']);
    expect(tracker.isOrderedProject('ordertest:checkout:0')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SequenceTracker.isOrderedProject
// ---------------------------------------------------------------------------

test.describe('SequenceTracker.isOrderedProject', () => {
  test('returns true for a known ordered project', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.isOrderedProject('ordertest:checkout:0')).toBe(true);
  });

  test('returns false for a non-ordered project name', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.isOrderedProject('chromium')).toBe(false);
  });

  test('returns false for the unordered passthrough name', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0', 'ordertest:unordered']);
    expect(tracker.isOrderedProject('ordertest:unordered')).toBe(false);
  });

  test('returns false for a project not in the current build set', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.isOrderedProject('ordertest:auth:0')).toBe(false);
  });

  test('returns false before buildFromProjectNames is called', () => {
    const tracker = new SequenceTracker();
    expect(tracker.isOrderedProject('ordertest:checkout:0')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SequenceTracker.getSequenceMetadata
// ---------------------------------------------------------------------------

test.describe('SequenceTracker.getSequenceMetadata', () => {
  test('returns undefined for a non-ordered project', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.getSequenceMetadata('chromium')).toBeUndefined();
  });

  test('returns metadata for a known ordered project', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    const meta = tracker.getSequenceMetadata('ordertest:checkout:0');
    expect(meta).toBeDefined();
  });

  test('metadata contains the correct sequenceName', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    const meta = tracker.getSequenceMetadata('ordertest:checkout:0');
    expect(meta?.sequenceName).toBe('checkout');
  });

  test('metadata contains the correct stepIndex', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0', 'ordertest:checkout:1']);
    const meta = tracker.getSequenceMetadata('ordertest:checkout:1');
    expect(meta?.stepIndex).toBe(1);
  });

  test('metadata contains the correct totalSteps', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames([
      'ordertest:checkout:0',
      'ordertest:checkout:1',
      'ordertest:checkout:2',
    ]);
    const meta = tracker.getSequenceMetadata('ordertest:checkout:0');
    expect(meta?.totalSteps).toBe(3);
  });

  test('position string is "Step 1 of N" for step index 0', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0', 'ordertest:checkout:1']);
    const meta = tracker.getSequenceMetadata('ordertest:checkout:0');
    expect(meta?.position).toBe('Step 1 of 2');
  });

  test('position string is "Step 2 of 3" for step index 1 in a 3-step sequence', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames([
      'ordertest:checkout:0',
      'ordertest:checkout:1',
      'ordertest:checkout:2',
    ]);
    const meta = tracker.getSequenceMetadata('ordertest:checkout:1');
    expect(meta?.position).toBe('Step 2 of 3');
  });

  test('position string is "Step N of N" for the last step', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:auth:0', 'ordertest:auth:1', 'ordertest:auth:2']);
    const meta = tracker.getSequenceMetadata('ordertest:auth:2');
    expect(meta?.position).toBe('Step 3 of 3');
  });

  test('single-step sequence has position "Step 1 of 1"', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:smoke:0']);
    const meta = tracker.getSequenceMetadata('ordertest:smoke:0');
    expect(meta?.position).toBe('Step 1 of 1');
  });

  test('returns undefined before buildFromProjectNames is called', () => {
    const tracker = new SequenceTracker();
    expect(tracker.getSequenceMetadata('ordertest:checkout:0')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SequenceTracker.recordTestEnd + getProgress
// ---------------------------------------------------------------------------

test.describe('SequenceTracker.recordTestEnd + getProgress', () => {
  test('getProgress returns undefined for an unknown sequence', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.getProgress('nonexistent')).toBeUndefined();
  });

  test('getProgress returns an entry with zero counts after build', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0', 'ordertest:checkout:1']);
    const progress = tracker.getProgress('checkout');
    expect(progress).toBeDefined();
    expect(progress?.completedSteps).toBe(0);
    expect(progress?.passedTests).toBe(0);
    expect(progress?.failedTests).toBe(0);
    expect(progress?.skippedTests).toBe(0);
    expect(progress?.timedOutTests).toBe(0);
  });

  test('getProgress has correct totalSteps', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames([
      'ordertest:checkout:0',
      'ordertest:checkout:1',
      'ordertest:checkout:2',
    ]);
    expect(tracker.getProgress('checkout')?.totalSteps).toBe(3);
  });

  test('getProgress sequenceName matches the tracked sequence', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.getProgress('checkout')?.sequenceName).toBe('checkout');
  });

  test('passed status increments passedTests', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.recordTestEnd('ordertest:checkout:0', 'passed');
    expect(tracker.getProgress('checkout')?.passedTests).toBe(1);
  });

  test('failed status increments failedTests', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.recordTestEnd('ordertest:checkout:0', 'failed');
    expect(tracker.getProgress('checkout')?.failedTests).toBe(1);
  });

  test('skipped status increments skippedTests', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.recordTestEnd('ordertest:checkout:0', 'skipped');
    expect(tracker.getProgress('checkout')?.skippedTests).toBe(1);
  });

  test('timedOut status increments timedOutTests', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.recordTestEnd('ordertest:checkout:0', 'timedOut');
    expect(tracker.getProgress('checkout')?.timedOutTests).toBe(1);
  });

  test('interrupted status counts as failed', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.recordTestEnd('ordertest:checkout:0', 'interrupted');
    const progress = tracker.getProgress('checkout');
    expect(progress?.failedTests).toBe(1);
    // Other counters must remain zero
    expect(progress?.passedTests).toBe(0);
    expect(progress?.skippedTests).toBe(0);
    expect(progress?.timedOutTests).toBe(0);
  });

  test('recordTestEnd increments completedSteps on every call', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.recordTestEnd('ordertest:checkout:0', 'passed');
    tracker.recordTestEnd('ordertest:checkout:0', 'passed');
    expect(tracker.getProgress('checkout')?.completedSteps).toBe(2);
  });

  test('multiple statuses accumulate correctly', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0', 'ordertest:checkout:1']);

    tracker.recordTestEnd('ordertest:checkout:0', 'passed');
    tracker.recordTestEnd('ordertest:checkout:0', 'passed');
    tracker.recordTestEnd('ordertest:checkout:1', 'failed');
    tracker.recordTestEnd('ordertest:checkout:1', 'skipped');
    tracker.recordTestEnd('ordertest:checkout:1', 'timedOut');
    tracker.recordTestEnd('ordertest:checkout:1', 'interrupted');

    const progress = tracker.getProgress('checkout');
    expect(progress?.passedTests).toBe(2);
    expect(progress?.failedTests).toBe(2); // 1 failed + 1 interrupted
    expect(progress?.skippedTests).toBe(1);
    expect(progress?.timedOutTests).toBe(1);
    expect(progress?.completedSteps).toBe(6);
  });

  test('recordTestEnd on an untracked project name does not throw', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(() => tracker.recordTestEnd('chromium', 'passed')).not.toThrow();
  });

  test('recording on one sequence does not affect another', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0', 'ordertest:auth:0']);

    tracker.recordTestEnd('ordertest:checkout:0', 'failed');

    expect(tracker.getProgress('checkout')?.failedTests).toBe(1);
    expect(tracker.getProgress('auth')?.failedTests).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SequenceTracker.recordTestStart
// ---------------------------------------------------------------------------

test.describe('SequenceTracker.recordTestStart', () => {
  test('does not throw for a known ordered project', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(() => tracker.recordTestStart('ordertest:checkout:0')).not.toThrow();
  });

  test('does not throw for a non-ordered project', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(() => tracker.recordTestStart('chromium')).not.toThrow();
  });

  test('does not mutate progress counters', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    tracker.recordTestStart('ordertest:checkout:0');
    const progress = tracker.getProgress('checkout');
    expect(progress?.completedSteps).toBe(0);
    expect(progress?.passedTests).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SequenceTracker.getAllSequences
// ---------------------------------------------------------------------------

test.describe('SequenceTracker.getAllSequences', () => {
  test('returns an empty array before build', () => {
    const tracker = new SequenceTracker();
    expect(tracker.getAllSequences()).toEqual([]);
  });

  test('returns an empty array when only non-ordered names are given', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['chromium', 'ordertest:unordered']);
    expect(tracker.getAllSequences()).toHaveLength(0);
  });

  test('returns all tracked sequence names', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames([
      'ordertest:checkout:0',
      'ordertest:checkout:1',
      'ordertest:auth:0',
      'ordertest:smoke:0',
    ]);
    const sequences = tracker.getAllSequences();
    expect(sequences).toContain('checkout');
    expect(sequences).toContain('auth');
    expect(sequences).toContain('smoke');
    expect(sequences).toHaveLength(3);
  });

  test('does not include duplicates for multi-step sequences', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames([
      'ordertest:checkout:0',
      'ordertest:checkout:1',
      'ordertest:checkout:2',
    ]);
    expect(tracker.getAllSequences()).toHaveLength(1);
    expect(tracker.getAllSequences()[0]).toBe('checkout');
  });

  test('returns a read-only array (does not expose internal state)', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    const sequences = tracker.getAllSequences();
    // Mutating the returned value must not affect the tracker
    (sequences as string[]).push('injected');
    expect(tracker.getAllSequences()).toHaveLength(1);
  });

  test('result reflects the latest build call', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:old:0']);
    tracker.buildFromProjectNames(['ordertest:new:0', 'ordertest:another:0']);
    const sequences = tracker.getAllSequences();
    expect(sequences).not.toContain('old');
    expect(sequences).toContain('new');
    expect(sequences).toContain('another');
  });
});

// ---------------------------------------------------------------------------
// SequenceTracker — constructor with optional logger
// ---------------------------------------------------------------------------

test.describe('SequenceTracker constructor', () => {
  test('constructs without a logger argument', () => {
    expect(() => new SequenceTracker()).not.toThrow();
  });

  test('constructs with an undefined logger', () => {
    expect(() => new SequenceTracker(undefined)).not.toThrow();
  });

  test('tracker is functional when constructed without a logger', () => {
    const tracker = new SequenceTracker();
    tracker.buildFromProjectNames(['ordertest:checkout:0']);
    expect(tracker.isOrderedProject('ordertest:checkout:0')).toBe(true);
  });
});
