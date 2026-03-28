/**
 * Test-level filter generation for @jimicze-pw/ordertest-core.
 *
 * Generates Playwright-compatible `grep` RegExp patterns from ordered sequence
 * test-name lists and/or tag lists. The produced patterns are passed directly to
 * a Playwright project's `grep` property so that only the intended tests run in
 * each project step.
 *
 * Design decisions for v1:
 * - If only `tests` are supplied: match exact test titles with `^(name1|name2)$`.
 * - If only `tags` are supplied: match any title that contains one of the tags
 *   (e.g. `@smoke`, `@regression`) using a lookahead alternative.
 * - If BOTH are supplied: match exact test titles only. Tags at this level are
 *   a secondary concern; they can be applied by Playwright's own `--grep` CLI
 *   flag. A debug note is emitted to explain the decision.
 * - Empty arrays are treated as "no filter" — `undefined` is returned and a
 *   debug warning is emitted.
 */

import { debugConsole } from '../logger/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape all regex special characters in a string so it can be used as a
 * literal pattern inside a RegExp.
 *
 * Characters escaped: `\ . * + ? ^ $ { } ( ) | [ ]`
 *
 * @param str - The raw string to escape
 * @returns The escaped string safe for use inside a RegExp literal
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// buildGrepPattern
// ---------------------------------------------------------------------------

/**
 * Build a Playwright `grep` RegExp from an optional list of test names and/or
 * tags.
 *
 * | Input           | Result                                                    |
 * |-----------------|-----------------------------------------------------------|
 * | both empty/absent | `undefined` — no filtering, all tests run               |
 * | tests only      | `/^(escaped_name1|escaped_name2)$/`                       |
 * | tags only       | `/(?:@tag1|@tag2)/`                                       |
 * | tests + tags    | `/^(escaped_name1|escaped_name2)$/` (tags noted in debug) |
 *
 * Playwright matches the `grep` pattern against the **full test title**
 * (including any tag annotations appended by the framework), so exact-name
 * matching via `^…$` works correctly for plain test titles.
 *
 * @param tests - Ordered list of exact test titles to include. Regex special
 *   characters are automatically escaped.
 * @param tags  - Playwright tags (e.g. `@smoke`, `@regression`) whose presence
 *   in the full test title is sufficient to include the test.
 * @returns A RegExp to pass to `testProject.grep`, or `undefined` when no
 *   filtering is needed.
 */
export function buildGrepPattern(
  tests?: readonly string[],
  tags?: readonly string[],
): RegExp | undefined {
  const hasTests = tests !== undefined && tests.length > 0;
  const hasTags = tags !== undefined && tags.length > 0;

  debugConsole(
    `buildGrepPattern called — tests: ${JSON.stringify(tests ?? [])}, tags: ${JSON.stringify(tags ?? [])}`,
  );

  // No filtering requested.
  if (!hasTests && !hasTags) {
    if (tests !== undefined && tests.length === 0) {
      debugConsole(
        'buildGrepPattern: empty tests array received — treating as "all tests" (no grep applied)',
      );
    }
    if (tags !== undefined && tags.length === 0) {
      debugConsole(
        'buildGrepPattern: empty tags array received — treating as "all tests" (no grep applied)',
      );
    }
    debugConsole('buildGrepPattern: no filter — returning undefined');
    return undefined;
  }

  // Test-name-only filter: exact title match.
  if (hasTests && !hasTags) {
    const escapedNames = (tests as readonly string[]).map((name) => {
      const escaped = escapeRegex(name);
      debugConsole(`  escaping test name: "${name}" → "${escaped}"`);
      return escaped;
    });
    const pattern = `^(${escapedNames.join('|')})$`;
    debugConsole(`buildGrepPattern: test-name filter → /${pattern}/`);
    return new RegExp(pattern);
  }

  // Tag-only filter: match any title containing one of the tags.
  if (!hasTests && hasTags) {
    const tagAlts = (tags as readonly string[]).map((tag) => escapeRegex(tag)).join('|');
    const pattern = `(?:${tagAlts})`;
    debugConsole(`buildGrepPattern: tag-only filter → /${pattern}/`);
    return new RegExp(pattern);
  }

  // Both tests and tags supplied: use test-name matching only.
  // Tags are intentionally excluded from the grep pattern in v1 — Playwright's
  // own `--grep` CLI flag (or a higher-level project grep) should handle tag
  // filtering so that the two constraints compose cleanly.
  debugConsole(
    'buildGrepPattern: both tests and tags supplied — applying test-name filter only. ' +
      'Use Playwright --grep CLI flag or a project-level grep for tag filtering.',
  );
  const escapedNames = (tests as readonly string[]).map((name) => {
    const escaped = escapeRegex(name);
    debugConsole(`  escaping test name: "${name}" → "${escaped}"`);
    return escaped;
  });
  const pattern = `^(${escapedNames.join('|')})$`;
  debugConsole(`buildGrepPattern: combined (tests-only) filter → /${pattern}/`);
  return new RegExp(pattern);
}
