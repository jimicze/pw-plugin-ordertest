import { expect, test } from '@playwright/test';
import { buildGrepPattern, escapeRegex } from '../../src/engine/testFilter.js';

// ---------------------------------------------------------------------------
// escapeRegex
// ---------------------------------------------------------------------------

test.describe('escapeRegex', () => {
  test('simple string with no special chars returns unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  test('empty string returns empty string', () => {
    expect(escapeRegex('')).toBe('');
  });

  test('escapes a dot', () => {
    expect(escapeRegex('a.b')).toBe('a\\.b');
  });

  test('escapes all regex special characters', () => {
    const input = '.*+?^${}()|[]\\';
    const result = escapeRegex(input);
    // Each special character must be preceded by a backslash in the output
    expect(result).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  test('escaped result is safe to use inside new RegExp', () => {
    const literal = 'price: $5.00 (usd)';
    const pattern = new RegExp(escapeRegex(literal));
    expect(pattern.test(literal)).toBe(true);
    // A slightly different string must NOT match
    expect(pattern.test('price: $500 (usd)')).toBe(false);
  });

  test('alphanumeric and spaces are not escaped', () => {
    const input = 'Test 123 abc ABC';
    expect(escapeRegex(input)).toBe('Test 123 abc ABC');
  });
});

// ---------------------------------------------------------------------------
// buildGrepPattern — no filter cases
// ---------------------------------------------------------------------------

test.describe('buildGrepPattern — no filter', () => {
  test('returns undefined when called with no arguments', () => {
    expect(buildGrepPattern()).toBeUndefined();
  });

  test('returns undefined when tests is undefined and tags is undefined', () => {
    expect(buildGrepPattern(undefined, undefined)).toBeUndefined();
  });

  test('returns undefined when tests is an empty array', () => {
    expect(buildGrepPattern([])).toBeUndefined();
  });

  test('returns undefined when tags is an empty array', () => {
    expect(buildGrepPattern(undefined, [])).toBeUndefined();
  });

  test('returns undefined when both tests and tags are empty arrays', () => {
    expect(buildGrepPattern([], [])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildGrepPattern — test-name filter
// ---------------------------------------------------------------------------

test.describe('buildGrepPattern — test-name filter', () => {
  test('single test name produces exact-match pattern', () => {
    const result = buildGrepPattern(['login succeeds']);
    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('^(login succeeds)$');
  });

  test('single test name: regex matches the exact title', () => {
    const result = buildGrepPattern(['login succeeds']) as RegExp;
    expect(result.test('login succeeds')).toBe(true);
  });

  test('single test name: regex does not match partial titles', () => {
    const result = buildGrepPattern(['login succeeds']) as RegExp;
    expect(result.test('login succeeds with extra')).toBe(false);
    expect(result.test('prefix login succeeds')).toBe(false);
  });

  test('multiple test names produce alternation pattern', () => {
    const result = buildGrepPattern(['test one', 'test two', 'test three']);
    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('^(test one|test two|test three)$');
  });

  test('multiple test names: regex matches each title exactly', () => {
    const result = buildGrepPattern(['test one', 'test two', 'test three']) as RegExp;
    expect(result.test('test one')).toBe(true);
    expect(result.test('test two')).toBe(true);
    expect(result.test('test three')).toBe(true);
  });

  test('multiple test names: regex does not match unrelated titles', () => {
    const result = buildGrepPattern(['test one', 'test two']) as RegExp;
    expect(result.test('test four')).toBe(false);
    expect(result.test('')).toBe(false);
  });

  test('test names with regex special characters are escaped', () => {
    const result = buildGrepPattern(['price: $5.00 (usd)']);
    expect(result).toBeInstanceOf(RegExp);
    // The source should have the special chars escaped
    expect(result?.source).toBe('^(price: \\$5\\.00 \\(usd\\))$');
  });

  test('test names with special chars: regex matches literal title', () => {
    const result = buildGrepPattern(['price: $5.00 (usd)']) as RegExp;
    expect(result.test('price: $5.00 (usd)')).toBe(true);
  });

  test('test names with special chars: regex does not match unescaped variant', () => {
    const result = buildGrepPattern(['price: $5.00 (usd)']) as RegExp;
    // Without escaping, '$' could match end-of-string and '.' could match any char —
    // verify the escaping prevents false positives
    expect(result.test('price: $5X00 (usd)')).toBe(false);
  });

  test('test name with pipe char is escaped', () => {
    const result = buildGrepPattern(['a|b']);
    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('^(a\\|b)$');
    const re = result as RegExp;
    expect(re.test('a|b')).toBe(true);
    expect(re.test('a')).toBe(false);
    expect(re.test('b')).toBe(false);
  });

  test('test name with backslash is escaped', () => {
    const result = buildGrepPattern(['path\\to\\file']);
    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('^(path\\\\to\\\\file)$');
    const re = result as RegExp;
    expect(re.test('path\\to\\file')).toBe(true);
  });

  test('test name with brackets is escaped', () => {
    const result = buildGrepPattern(['array[0]']);
    expect(result?.source).toBe('^(array\\[0\\])$');
    const re = result as RegExp;
    expect(re.test('array[0]')).toBe(true);
    expect(re.test('array0')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildGrepPattern — tag filter
// ---------------------------------------------------------------------------

test.describe('buildGrepPattern — tag filter', () => {
  test('single tag produces non-capturing group pattern', () => {
    const result = buildGrepPattern(undefined, ['@smoke']);
    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('(?:@smoke)');
  });

  test('single tag: regex matches a title containing the tag', () => {
    const result = buildGrepPattern(undefined, ['@smoke']) as RegExp;
    expect(result.test('login @smoke')).toBe(true);
    expect(result.test('@smoke')).toBe(true);
    expect(result.test('checkout flow @smoke @critical')).toBe(true);
  });

  test('single tag: regex does not match a title without the tag', () => {
    const result = buildGrepPattern(undefined, ['@smoke']) as RegExp;
    expect(result.test('login')).toBe(false);
    expect(result.test('@regression')).toBe(false);
  });

  test('multiple tags produce alternation pattern', () => {
    const result = buildGrepPattern(undefined, ['@smoke', '@regression']);
    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('(?:@smoke|@regression)');
  });

  test('multiple tags: regex matches a title containing any one tag', () => {
    const result = buildGrepPattern(undefined, ['@smoke', '@regression']) as RegExp;
    expect(result.test('login @smoke')).toBe(true);
    expect(result.test('checkout @regression')).toBe(true);
    expect(result.test('payment @smoke @regression')).toBe(true);
  });

  test('multiple tags: regex does not match a title with none of the tags', () => {
    const result = buildGrepPattern(undefined, ['@smoke', '@regression']) as RegExp;
    expect(result.test('login')).toBe(false);
    expect(result.test('checkout @critical')).toBe(false);
  });

  test('tag with regex special characters is escaped in pattern', () => {
    // Edge case: a tag that accidentally contains a regex special char
    const result = buildGrepPattern(undefined, ['@my.tag']);
    expect(result?.source).toBe('(?:@my\\.tag)');
    const re = result as RegExp;
    // Must match the literal tag name
    expect(re.test('test @my.tag')).toBe(true);
    // Must NOT match with any char in place of the dot
    expect(re.test('test @myXtag')).toBe(false);
  });

  test('empty tests array with tags still produces tag-only pattern', () => {
    const result = buildGrepPattern([], ['@smoke']);
    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('(?:@smoke)');
  });
});

// ---------------------------------------------------------------------------
// buildGrepPattern — tests + tags combined
// ---------------------------------------------------------------------------

test.describe('buildGrepPattern — tests and tags combined', () => {
  test('returns a RegExp (not undefined) when both are supplied', () => {
    const result = buildGrepPattern(['login'], ['@smoke']);
    expect(result).toBeInstanceOf(RegExp);
  });

  test('uses test-name filter only — same pattern as tests-only call', () => {
    const testsOnly = buildGrepPattern(['login', 'checkout']);
    const combined = buildGrepPattern(['login', 'checkout'], ['@smoke']);
    expect(combined?.source).toBe(testsOnly?.source);
  });

  test('combined pattern matches exact test titles', () => {
    const result = buildGrepPattern(['login', 'checkout'], ['@smoke']) as RegExp;
    expect(result.test('login')).toBe(true);
    expect(result.test('checkout')).toBe(true);
  });

  test('combined pattern does not match tag alone', () => {
    const result = buildGrepPattern(['login'], ['@smoke']) as RegExp;
    // "@smoke" alone should NOT match because the pattern is ^(login)$
    expect(result.test('@smoke')).toBe(false);
  });

  test('combined pattern with special-char test names escapes them', () => {
    const result = buildGrepPattern(['price: $5.00'], ['@smoke']) as RegExp;
    expect(result.test('price: $5.00')).toBe(true);
    expect(result.test('price: $5X00')).toBe(false);
  });

  test('empty tags with non-empty tests behaves like tests-only', () => {
    const testsOnly = buildGrepPattern(['my test']);
    const withEmptyTags = buildGrepPattern(['my test'], []);
    // empty tags treated as absent, result equals tests-only
    expect(withEmptyTags?.source).toBe(testsOnly?.source);
  });
});
