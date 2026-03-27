import { expect, test } from '@playwright/test';
import { escapeHtml, formatDuration, generateHtmlReport } from '../../src/reporter/htmlTemplate.js';
import type { ReportData, SequenceReportData } from '../../src/reporter/reportData.js';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeReportData(overrides?: Partial<ReportData>): ReportData {
  return {
    version: '0.1.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    totalDuration: 5000,
    runStatus: 'passed',
    sequences: [],
    dependencies: [],
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalSkipped: 0,
    ...overrides,
  };
}

function makeSequenceData(): SequenceReportData {
  return {
    name: 'checkout-flow',
    mode: 'serial',
    isCollapsed: false,
    steps: [
      {
        projectName: 'ordertest:checkout-flow:0',
        stepIndex: 0,
        testFile: 'auth.spec.ts',
        tests: [
          {
            title: 'login test',
            titlePath: ['ordertest:checkout-flow:0', 'auth.spec.ts', 'login test'],
            status: 'passed',
            duration: 100,
            startTime: '2026-01-01T00:00:01.000Z',
            endTime: '2026-01-01T00:00:01.100Z',
            retry: 0,
          },
        ],
        startTime: '2026-01-01T00:00:01.000Z',
        endTime: '2026-01-01T00:00:01.100Z',
        duration: 100,
        passedCount: 1,
        failedCount: 0,
        skippedCount: 0,
      },
      {
        projectName: 'ordertest:checkout-flow:1',
        stepIndex: 1,
        testFile: 'cart.spec.ts',
        tests: [
          {
            title: 'add to cart',
            titlePath: ['ordertest:checkout-flow:1', 'cart.spec.ts', 'add to cart'],
            status: 'passed',
            duration: 200,
            startTime: '2026-01-01T00:00:02.000Z',
            endTime: '2026-01-01T00:00:02.200Z',
            retry: 0,
          },
        ],
        startTime: '2026-01-01T00:00:02.000Z',
        endTime: '2026-01-01T00:00:02.200Z',
        duration: 200,
        passedCount: 1,
        failedCount: 0,
        skippedCount: 0,
      },
    ],
    duration: 1200,
    startTime: '2026-01-01T00:00:01.000Z',
    endTime: '2026-01-01T00:00:02.200Z',
    status: 'passed',
    totalTests: 2,
    passedTests: 2,
    failedTests: 0,
    skippedTests: 0,
  };
}

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

test.describe('formatDuration', () => {
  test('returns "0ms" for 0', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  test('returns "450ms" for 450', () => {
    expect(formatDuration(450)).toBe('450ms');
  });

  test('returns "999ms" for 999', () => {
    expect(formatDuration(999)).toBe('999ms');
  });

  test('returns "1.0s" for 1000', () => {
    expect(formatDuration(1000)).toBe('1.0s');
  });

  test('returns "1.5s" for 1500', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  test('returns "59.9s" for 59900', () => {
    expect(formatDuration(59900)).toBe('59.9s');
  });

  test('returns "1m 0.0s" for 60000', () => {
    expect(formatDuration(60000)).toBe('1m 0.0s');
  });

  test('returns "2m 15.3s" for 135300', () => {
    expect(formatDuration(135300)).toBe('2m 15.3s');
  });

  test('returns "0ms" for negative values', () => {
    expect(formatDuration(-1)).toBe('0ms');
  });

  test('returns "0ms" for NaN', () => {
    expect(formatDuration(Number.NaN)).toBe('0ms');
  });

  test('returns "0ms" for Infinity', () => {
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0ms');
  });
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

test.describe('escapeHtml', () => {
  test('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  test('escapes less-than', () => {
    expect(escapeHtml('<tag')).toBe('&lt;tag');
  });

  test('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  test('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  test('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  test('handles a string with all special characters', () => {
    expect(escapeHtml('<a href="x" data-val=\'y\'>&</a>')).toBe(
      '&lt;a href=&quot;x&quot; data-val=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  test('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('does not modify strings without special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// generateHtmlReport — structure
// ---------------------------------------------------------------------------

test.describe('generateHtmlReport — structure', () => {
  test('returns a string starting with <!DOCTYPE html>', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/);
  });

  test('contains <html lang="en">', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('<html lang="en">');
  });

  test('contains <title>OrderTest Report</title>', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('<title>OrderTest Report</title>');
  });

  test('contains the version string in the output', () => {
    const html = generateHtmlReport(makeReportData({ version: '1.2.3' }));
    expect(html).toContain('1.2.3');
  });

  test('contains the generatedAt date', () => {
    const html = generateHtmlReport(makeReportData({ generatedAt: '2026-01-01T00:00:00.000Z' }));
    expect(html).toContain('2026');
  });

  test('contains a <style> block', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('<style>');
  });

  test('contains a <script> block with REPORT_DATA', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('<script>');
    expect(html).toContain('REPORT_DATA');
  });
});

// ---------------------------------------------------------------------------
// generateHtmlReport — sections
// ---------------------------------------------------------------------------

test.describe('generateHtmlReport — sections', () => {
  test('includes Summary section by default', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('Summary');
  });

  test('includes Gantt Timeline section by default', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('Gantt Timeline');
  });

  test('includes Dependency Graph section by default', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('Dependency Graph');
  });

  test('does NOT include Shard Distribution when no shard data', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).not.toContain('Shard Distribution');
  });

  test('does include Shard Distribution when shard data is present', () => {
    const data = makeReportData({
      shard: { current: 1, total: 3, sequences: [], hasCollapsed: false },
    });
    const html = generateHtmlReport(data);
    expect(html).toContain('Shard Distribution');
  });

  test('hides Summary when showSummary: false', () => {
    const html = generateHtmlReport(makeReportData(), { showSummary: false });
    expect(html).not.toContain('Summary');
  });

  test('hides Timeline when showTimeline: false', () => {
    const html = generateHtmlReport(makeReportData(), { showTimeline: false });
    expect(html).not.toContain('Gantt Timeline');
  });

  test('hides Dependency Graph when showDependencyGraph: false', () => {
    const html = generateHtmlReport(makeReportData(), { showDependencyGraph: false });
    expect(html).not.toContain('Dependency Graph');
  });

  test('hides Shard Distribution when showShardDistribution: false', () => {
    const data = makeReportData({
      shard: { current: 1, total: 3, sequences: [], hasCollapsed: false },
    });
    const html = generateHtmlReport(data, { showShardDistribution: false });
    expect(html).not.toContain('Shard Distribution');
  });
});

// ---------------------------------------------------------------------------
// generateHtmlReport — content
// ---------------------------------------------------------------------------

test.describe('generateHtmlReport — content', () => {
  test('includes sequence name in summary table', () => {
    const seq = makeSequenceData();
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).toContain('checkout-flow');
  });

  test('includes "serial" mode text in summary table', () => {
    const seq = makeSequenceData();
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).toContain('serial');
  });

  test('includes status badge with "passed"', () => {
    const seq = makeSequenceData();
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).toContain('class="badge"');
    expect(html).toContain('passed');
  });

  test('includes test counts in summary table', () => {
    const seq = makeSequenceData();
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    // totalTests = 2, passedTests = 2
    expect(html).toContain('>2<');
  });

  test('includes SVG elements for timeline', () => {
    const seq = makeSequenceData();
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox');
  });

  test('includes SVG elements for dependency graph', () => {
    const seq = makeSequenceData();
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('escapes sequence names containing HTML special characters', () => {
    const seq: SequenceReportData = {
      ...makeSequenceData(),
      name: '<script>alert(1)</script>',
    };
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('includes dependency arrows between steps (marker-end="url(#arrow)")', () => {
    const seq = makeSequenceData();
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).toContain('marker-end="url(#arrow)"');
  });

  test('formats duration correctly in summary table', () => {
    const seq: SequenceReportData = { ...makeSequenceData(), duration: 1500 };
    const html = generateHtmlReport(makeReportData({ sequences: [seq] }));
    expect(html).toContain('1.5s');
  });
});

// ---------------------------------------------------------------------------
// generateHtmlReport — empty data
// ---------------------------------------------------------------------------

test.describe('generateHtmlReport — empty data', () => {
  test('handles zero sequences without errors', () => {
    expect(() => generateHtmlReport(makeReportData())).not.toThrow();
  });

  test('produces a valid HTML string with no sequences', () => {
    const html = generateHtmlReport(makeReportData());
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<!DOCTYPE html>');
  });

  test('shows "No sequences recorded" message in summary', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('No sequences recorded');
  });

  test('shows "No timeline data" message in timeline SVG', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('No timeline data');
  });

  test('shows "No dependency data" message in dependency graph SVG', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('No dependency data');
  });
});

// ---------------------------------------------------------------------------
// generateHtmlReport — shard data
// ---------------------------------------------------------------------------

test.describe('generateHtmlReport — shard data', () => {
  test('includes shard info when shard is present (current/total)', () => {
    const data = makeReportData({
      shard: { current: 2, total: 5, sequences: [], hasCollapsed: false },
    });
    const html = generateHtmlReport(data);
    expect(html).toContain('>2<');
    expect(html).toContain('>5<');
  });

  test('includes "Shard Distribution" section heading', () => {
    const data = makeReportData({
      shard: { current: 1, total: 4, sequences: ['checkout-flow'], hasCollapsed: false },
      sequences: [makeSequenceData()],
    });
    const html = generateHtmlReport(data);
    expect(html).toContain('Shard Distribution');
  });

  test('shows sequence names in shard distribution table', () => {
    const data = makeReportData({
      shard: { current: 1, total: 2, sequences: ['checkout-flow'], hasCollapsed: false },
      sequences: [makeSequenceData()],
    });
    const html = generateHtmlReport(data);
    // Sequence name must appear inside the shard table
    const shardIdx = html.indexOf('Shard Distribution');
    expect(shardIdx).toBeGreaterThan(-1);
    const afterShard = html.slice(shardIdx);
    expect(afterShard).toContain('checkout-flow');
  });
});
