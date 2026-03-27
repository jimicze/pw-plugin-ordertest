/**
 * HTML template generator for the Custom HTML Reporter.
 *
 * Pure function module — takes a `ReportData` object and returns a self-contained
 * HTML string with embedded CSS and JavaScript. Includes four visualization sections:
 * Gantt timeline, summary table, dependency graph, and shard distribution.
 *
 * All rendering is done server-side (string generation). The embedded `<script>` block
 * exposes the full report data as JSON for optional client-side interactivity.
 */

import type { ReportData, SequenceReportData, StepReportData } from './reportData.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options controlling which sections are rendered in the report. */
export interface HtmlTemplateOptions {
  /** Show the Gantt timeline visualization. Default: true. */
  readonly showTimeline?: boolean;

  /** Show the summary table. Default: true. */
  readonly showSummary?: boolean;

  /** Show the dependency graph. Default: true. */
  readonly showDependencyGraph?: boolean;

  /** Show the shard distribution view. Default: true (auto-hidden if no shards). */
  readonly showShardDistribution?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete, self-contained HTML report document from report data.
 *
 * @param data - The full report data collected by the custom HTML reporter
 * @param options - Optional flags to show/hide individual sections
 * @returns A complete HTML document string ready to write to disk
 */
export function generateHtmlReport(data: ReportData, options?: HtmlTemplateOptions): string {
  const opts: Required<HtmlTemplateOptions> = {
    showTimeline: options?.showTimeline ?? true,
    showSummary: options?.showSummary ?? true,
    showDependencyGraph: options?.showDependencyGraph ?? true,
    showShardDistribution: options?.showShardDistribution ?? true,
  };

  const sections: string[] = [];

  if (opts.showSummary) {
    sections.push(generateSummaryTableHtml(data));
  }
  if (opts.showTimeline) {
    sections.push(generateTimelineSectionHtml(data));
  }
  if (opts.showDependencyGraph) {
    sections.push(generateDependencyGraphSectionHtml(data));
  }
  if (opts.showShardDistribution && data.shard !== undefined) {
    sections.push(generateShardDistributionHtml(data));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OrderTest Report</title>
  <style>${generateCss()}</style>
</head>
<body>
  ${generateHeaderHtml(data)}
  ${sections.join('\n  ')}
  <script>
    ${generateScript(data)}
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Exported helpers (for unit testing)
// ---------------------------------------------------------------------------

/**
 * Format a millisecond duration into a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string, e.g. "450ms", "1.2s", "2m 15.3s"
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSecs = ms / 1000;
  if (totalSecs < 60) return `${totalSecs.toFixed(1)}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = (totalSecs % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

/**
 * Escape a string for safe embedding in HTML content or attribute values.
 *
 * @param str - Raw string that may contain HTML special characters
 * @returns Escaped string safe for HTML output
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return a hex color for a given status string.
 *
 * @param status - Test or sequence status string
 * @returns Hex color string
 */
function statusColor(status: string): string {
  switch (status) {
    case 'passed':
      return '#22c55e';
    case 'failed':
    case 'timedOut':
    case 'timedout':
      return '#ef4444';
    case 'skipped':
      return '#eab308';
    case 'interrupted':
      return '#f97316';
    default:
      return '#9ca3af';
  }
}

/**
 * Return an HTML `<span>` badge with a colored background for the given status.
 *
 * @param status - Status string to display
 * @returns HTML string for a colored status badge
 */
function statusBadge(status: string): string {
  const color = statusColor(status);
  const label = escapeHtml(status);
  return `<span class="badge" style="background:${color}">${label}</span>`;
}

/**
 * Parse an ISO 8601 timestamp string to a millisecond epoch value.
 * Returns 0 on invalid input to avoid crashing the renderer.
 *
 * @param iso - ISO 8601 date string
 * @returns Millisecond timestamp, or 0 if unparseable
 */
function parseMs(iso: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Shorten a project name for compact display in graph nodes.
 * Strips the `ordertest:` prefix and any step-index suffix.
 *
 * @param name - Full project name, e.g. `ordertest:checkout-flow:2`
 * @returns Shortened display name, e.g. `checkout-flow:2`
 */
function shortProjectName(name: string): string {
  return name.replace(/^ordertest:/, '');
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

/**
 * Return the complete embedded CSS for the report.
 *
 * @returns CSS string
 */
function generateCss(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      background: #f3f4f6;
    }

    /* Header */
    header {
      background: #111827;
      color: #f9fafb;
      padding: 20px 24px;
    }
    header h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .meta { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
    .stats { font-size: 13px; color: #d1d5db; }
    .run-status {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    /* Layout */
    main, section { padding: 0; }
    .section-wrapper {
      background: #fff;
      border-radius: 8px;
      margin: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    details > summary {
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      cursor: pointer;
      user-select: none;
      font-weight: 600;
      font-size: 15px;
    }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before {
      content: '▶';
      font-size: 10px;
      color: #6b7280;
      transition: transform 0.15s;
    }
    details[open] > summary::before { transform: rotate(90deg); }
    .section-body { padding: 20px; overflow-x: auto; }

    /* Badge */
    .badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      text-align: left;
      padding: 8px 12px;
      background: #f3f4f6;
      color: #374151;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
      white-space: nowrap;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f9fafb; }
    tr.total-row td {
      font-weight: 700;
      background: #f3f4f6;
      border-top: 2px solid #e5e7eb;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .passed-count { color: #15803d; font-weight: 600; }
    .failed-count { color: #dc2626; font-weight: 600; }
    .skipped-count { color: #a16207; font-weight: 600; }

    /* SVG containers */
    .svg-container {
      width: 100%;
      overflow-x: auto;
    }
    svg text { font-family: inherit; }

    /* Shard table */
    .shard-info { font-size: 13px; color: #6b7280; margin-bottom: 12px; }

    /* Responsive */
    @media (max-width: 640px) {
      .section-wrapper { margin: 8px; }
      .section-body { padding: 12px; }
      th, td { padding: 6px 8px; }
    }
  `;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/**
 * Generate the `<header>` HTML block with run-level metadata.
 *
 * @param data - Full report data
 * @returns HTML string for the page header
 */
function generateHeaderHtml(data: ReportData): string {
  const runColor = statusColor(data.runStatus);
  const statusSpan = `<span class="run-status" style="background:${runColor}">${escapeHtml(data.runStatus)}</span>`;

  const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'unknown';
  const duration = formatDuration(data.totalDuration);

  const passed = data.totalPassed;
  const failed = data.totalFailed;
  const skipped = data.totalSkipped;
  const total = data.totalTests;

  return `<header>
    <h1>OrderTest Report</h1>
    <div class="meta">
      Generated: ${escapeHtml(generatedAt)} &nbsp;|&nbsp;
      Duration: ${escapeHtml(duration)} &nbsp;|&nbsp;
      Status: ${statusSpan} &nbsp;|&nbsp;
      v${escapeHtml(data.version)}
    </div>
    <div class="stats">
      ${total} test${total !== 1 ? 's' : ''}:
      <strong style="color:#86efac">${passed} passed</strong>,
      <strong style="color:#fca5a5">${failed} failed</strong>,
      <strong style="color:#fde68a">${skipped} skipped</strong>
      &nbsp;|&nbsp; ${data.sequences.length} sequence${data.sequences.length !== 1 ? 's' : ''}
    </div>
  </header>`;
}

// ---------------------------------------------------------------------------
// Section 1: Summary Table
// ---------------------------------------------------------------------------

/**
 * Generate the summary table section HTML showing per-sequence statistics.
 *
 * @param data - Full report data
 * @returns HTML string for the summary table section
 */
function generateSummaryTableHtml(data: ReportData): string {
  if (data.sequences.length === 0) {
    return `<div class="section-wrapper">
      <details open>
        <summary>Summary</summary>
        <div class="section-body"><p>No sequences recorded.</p></div>
      </details>
    </div>`;
  }

  const rows = data.sequences.map((seq) => generateSummaryRow(seq)).join('\n');

  const totalPassed = data.sequences.reduce((s, q) => s + q.passedTests, 0);
  const totalFailed = data.sequences.reduce((s, q) => s + q.failedTests, 0);
  const totalSkipped = data.sequences.reduce((s, q) => s + q.skippedTests, 0);
  const totalTests = data.sequences.reduce((s, q) => s + q.totalTests, 0);
  const totalDuration = data.sequences.reduce((s, q) => s + q.duration, 0);

  const totalRow = `<tr class="total-row">
      <td colspan="3"><strong>Total</strong></td>
      <td class="num">${totalTests}</td>
      <td class="num passed-count">${totalPassed}</td>
      <td class="num failed-count">${totalFailed}</td>
      <td class="num skipped-count">${totalSkipped}</td>
      <td class="num">${formatDuration(totalDuration)}</td>
    </tr>`;

  return `<div class="section-wrapper">
    <details open>
      <summary>Summary</summary>
      <div class="section-body">
        <table>
          <thead>
            <tr>
              <th>Sequence</th>
              <th>Mode</th>
              <th>Status</th>
              <th class="num">Tests</th>
              <th class="num">Passed</th>
              <th class="num">Failed</th>
              <th class="num">Skipped</th>
              <th class="num">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${totalRow}
          </tbody>
        </table>
      </div>
    </details>
  </div>`;
}

/**
 * Generate a single `<tr>` for the summary table from a sequence.
 *
 * @param seq - Sequence report data
 * @returns HTML table row string
 */
function generateSummaryRow(seq: SequenceReportData): string {
  const collapsed = seq.isCollapsed
    ? ' <span title="Collapsed for shard safety" style="color:#9ca3af">(collapsed)</span>'
    : '';
  return `<tr>
      <td>${escapeHtml(seq.name)}${collapsed}</td>
      <td>${escapeHtml(seq.mode)}</td>
      <td>${statusBadge(seq.status)}</td>
      <td class="num">${seq.totalTests}</td>
      <td class="num passed-count">${seq.passedTests}</td>
      <td class="num failed-count">${seq.failedTests}</td>
      <td class="num skipped-count">${seq.skippedTests}</td>
      <td class="num">${formatDuration(seq.duration)}</td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Section 2: Gantt Timeline
// ---------------------------------------------------------------------------

/**
 * Generate the timeline section HTML wrapping the SVG Gantt chart.
 *
 * @param data - Full report data
 * @returns HTML string for the timeline section
 */
function generateTimelineSectionHtml(data: ReportData): string {
  const svg = generateTimelineSvg(data);
  return `<div class="section-wrapper">
    <details open>
      <summary>Gantt Timeline</summary>
      <div class="section-body">
        <div class="svg-container">${svg}</div>
      </div>
    </details>
  </div>`;
}

/**
 * Generate the SVG Gantt timeline showing sequences and their steps over time.
 *
 * Each sequence occupies a horizontal lane. Within a lane, each step is a
 * colored rectangle whose x-position and width are proportional to its
 * start time and duration relative to the overall run start.
 *
 * @param data - Full report data
 * @returns SVG element string
 */
function generateTimelineSvg(data: ReportData): string {
  // Collect timestamps for all sequences that have at least one step
  const seqsWithSteps = data.sequences.filter((s) => s.steps.length > 0);

  if (seqsWithSteps.length === 0) {
    return `<svg viewBox="0 0 400 60" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="35" text-anchor="middle" fill="#9ca3af" font-size="13">
        No timeline data available.
      </text>
    </svg>`;
  }

  // Determine global start/end in ms
  let globalStart = Number.MAX_SAFE_INTEGER;
  let globalEnd = 0;

  for (const seq of seqsWithSteps) {
    const start = parseMs(seq.startTime);
    const end = parseMs(seq.endTime);
    if (start > 0 && start < globalStart) globalStart = start;
    if (end > globalEnd) globalEnd = end;
  }

  if (globalStart === Number.MAX_SAFE_INTEGER) globalStart = 0;
  const totalMs = Math.max(globalEnd - globalStart, 1);

  // Layout constants
  const SVG_W = 900;
  const LABEL_W = 160;
  const CHART_W = SVG_W - LABEL_W - 20;
  const LANE_H = 36;
  const BAR_H = 22;
  const BAR_Y_OFFSET = (LANE_H - BAR_H) / 2;
  const AXIS_H = 30;
  const lanes = seqsWithSteps.length;
  const SVG_H = AXIS_H + lanes * LANE_H + 10;

  const lines: string[] = [];
  lines.push(
    `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg" style="min-width:${SVG_W}px;max-width:100%">`,
  );

  // Background
  lines.push(`<rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="#f9fafb" rx="4"/>`);

  // Time axis
  const TICK_COUNT = 5;
  for (let i = 0; i <= TICK_COUNT; i++) {
    const fraction = i / TICK_COUNT;
    const x = LABEL_W + fraction * CHART_W;
    const tickMs = fraction * totalMs;
    const xStr = x.toFixed(1);
    const laneBottom = AXIS_H + lanes * LANE_H;
    lines.push(
      `<line x1="${xStr}" y1="${AXIS_H - 6}" x2="${xStr}" y2="${laneBottom}" stroke="#e5e7eb" stroke-width="1"/>`,
    );
    const tickLabel = escapeHtml(formatDuration(tickMs));
    lines.push(
      `<text x="${xStr}" y="${AXIS_H - 10}" text-anchor="middle" fill="#6b7280" font-size="11">${tickLabel}</text>`,
    );
  }

  // Lane rows + bars
  seqsWithSteps.forEach((seq, laneIdx) => {
    const laneY = AXIS_H + laneIdx * LANE_H;
    const bgFill = laneIdx % 2 === 0 ? '#fff' : '#f9fafb';

    lines.push(`<rect x="0" y="${laneY}" width="${SVG_W}" height="${LANE_H}" fill="${bgFill}"/>`);

    // Sequence label (truncated)
    const labelText = escapeHtml(truncateText(seq.name, 22));
    const labelY2 = laneY + LANE_H / 2 + 4;
    lines.push(
      `<text x="${LABEL_W - 8}" y="${labelY2}" text-anchor="end" fill="#374151" font-size="12" font-weight="600">${labelText}</text>`,
    );

    // Step bars
    for (const step of seq.steps) {
      const stepStart = parseMs(step.startTime);
      const stepEnd = parseMs(step.endTime);

      if (stepStart === 0 && stepEnd === 0) continue; // no timing data

      const x = LABEL_W + (Math.max(stepStart - globalStart, 0) / totalMs) * CHART_W;
      const rawW = ((stepEnd - stepStart) / totalMs) * CHART_W;
      const w = Math.max(rawW, 4); // min visible width

      const stepStatus = deriveStepStatus(step);
      const fill = statusColor(stepStatus);

      const tooltip = [
        escapeHtml(step.testFile),
        `Status: ${stepStatus}`,
        `Duration: ${formatDuration(step.duration)}`,
        `Tests: ${step.passedCount}✓ ${step.failedCount}✗ ${step.skippedCount}⊘`,
      ].join('&#10;');

      const barX = x.toFixed(1);
      const barY = (laneY + BAR_Y_OFFSET).toFixed(1);
      const barW = w.toFixed(1);
      lines.push(
        `<rect x="${barX}" y="${barY}" width="${barW}" height="${BAR_H}" fill="${fill}" rx="3" opacity="0.85"><title>${tooltip}</title></rect>`,
      );
    }
  });

  // Bottom border
  lines.push(
    `<line x1="0" y1="${SVG_H - 1}" x2="${SVG_W}" y2="${SVG_H - 1}" stroke="#e5e7eb" stroke-width="1"/>`,
  );

  lines.push('</svg>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Section 3: Dependency Graph
// ---------------------------------------------------------------------------

/**
 * Generate the dependency graph section HTML wrapping the SVG graph.
 *
 * @param data - Full report data
 * @returns HTML string for the dependency graph section
 */
function generateDependencyGraphSectionHtml(data: ReportData): string {
  const svg = generateDependencyGraphSvg(data);
  return `<div class="section-wrapper">
    <details open>
      <summary>Dependency Graph</summary>
      <div class="section-body">
        <div class="svg-container">${svg}</div>
      </div>
    </details>
  </div>`;
}

/**
 * Generate the SVG dependency graph showing nodes (project steps) and directed
 * edges (dependency relationships) in a left-to-right grid layout.
 *
 * Each sequence is rendered on its own row. Steps within a sequence are columns.
 * Arrows connect each step to the next, matching Playwright's dependency chain.
 *
 * @param data - Full report data
 * @returns SVG element string
 */
function generateDependencyGraphSvg(data: ReportData): string {
  const seqsWithSteps = data.sequences.filter((s) => s.steps.length > 0);

  if (seqsWithSteps.length === 0) {
    return `<svg viewBox="0 0 400 60" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="35" text-anchor="middle" fill="#9ca3af" font-size="13">
        No dependency data available.
      </text>
    </svg>`;
  }

  const NODE_W = 130;
  const NODE_H = 40;
  const H_GAP = 60; // horizontal gap between nodes
  const V_GAP = 28; // vertical gap between rows
  const PAD_X = 20;
  const PAD_Y = 20;

  // Compute max steps per sequence to determine SVG width
  const maxSteps = Math.max(...seqsWithSteps.map((s) => s.steps.length));
  const svgW = PAD_X * 2 + maxSteps * NODE_W + (maxSteps - 1) * H_GAP;
  const svgH = PAD_Y * 2 + seqsWithSteps.length * NODE_H + (seqsWithSteps.length - 1) * V_GAP;

  const lines: string[] = [];
  lines.push(
    `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="min-width:${svgW}px;max-width:100%">`,
  );

  // Arrowhead marker
  lines.push(`<defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
      <polygon points="0 0, 8 3.5, 0 7" fill="#6b7280"/>
    </marker>
  </defs>`);

  lines.push(`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#f9fafb" rx="4"/>`);

  seqsWithSteps.forEach((seq, rowIdx) => {
    const rowY = PAD_Y + rowIdx * (NODE_H + V_GAP);

    seq.steps.forEach((step, colIdx) => {
      const nodeX = PAD_X + colIdx * (NODE_W + H_GAP);
      const nodeY = rowY;
      const cx = nodeX + NODE_W / 2;
      const cy = nodeY + NODE_H / 2;

      const stepStatus = deriveStepStatus(step);
      const fill = statusColor(stepStatus);
      const textLabel = truncateText(shortProjectName(step.projectName), 18);

      const tooltip = [
        escapeHtml(step.projectName),
        `File: ${escapeHtml(step.testFile)}`,
        `Status: ${stepStatus}`,
        `${step.passedCount}✓ ${step.failedCount}✗ ${step.skippedCount}⊘`,
      ].join('&#10;');

      // Node rectangle
      lines.push(
        `<rect x="${nodeX}" y="${nodeY}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${fill}" opacity="0.85"><title>${tooltip}</title></rect>`,
      );

      // Node label
      lines.push(
        `<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="11" font-weight="600">${escapeHtml(textLabel)}</text>`,
      );

      // Arrow from previous node to this one (skip first)
      if (colIdx > 0) {
        const prevNodeRightX = PAD_X + (colIdx - 1) * (NODE_W + H_GAP) + NODE_W;
        const arrowEndX = nodeX;
        const arrowY = rowY + NODE_H / 2;
        lines.push(
          `<line x1="${prevNodeRightX}" y1="${arrowY}" x2="${arrowEndX}" y2="${arrowY}" stroke="#6b7280" stroke-width="1.5" marker-end="url(#arrow)"/>`,
        );
      }
    });

    // Row label (sequence name) on the left if first column is pushed right
    // We draw a subtle left-side label for each row
    if (PAD_X > 0) {
      // sequence mode indicator below each row (small text)
      const firstStepX = PAD_X;
      const rowBottomY = rowY + NODE_H + 4;
      lines.push(
        `<text x="${firstStepX}" y="${rowBottomY}" fill="#9ca3af" font-size="10">${escapeHtml(seq.name)} · ${escapeHtml(seq.mode)}</text>`,
      );
    }
  });

  lines.push('</svg>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Section 4: Shard Distribution
// ---------------------------------------------------------------------------

/**
 * Generate the shard distribution table section HTML.
 *
 * Only relevant when the test run was sharded. Displays which sequences ran on
 * which shard and whether any were collapsed for shard safety.
 *
 * @param data - Full report data (must have `data.shard` defined)
 * @returns HTML string for the shard distribution section
 */
function generateShardDistributionHtml(data: ReportData): string {
  const shard = data.shard;
  if (shard === undefined) return '';

  const seqRows = shard.sequences
    .map((name) => {
      const seq = data.sequences.find((s) => s.name === name);
      const collapsed = seq?.isCollapsed
        ? '<span class="badge" style="background:#f97316">yes</span>'
        : '<span style="color:#9ca3af">no</span>';
      return `<tr>
        <td>${escapeHtml(name)}</td>
        <td>${collapsed}</td>
      </tr>`;
    })
    .join('\n');

  return `<div class="section-wrapper">
    <details open>
      <summary>Shard Distribution</summary>
      <div class="section-body">
        <p class="shard-info">
          Shard <strong>${shard.current}</strong> of <strong>${shard.total}</strong>
          &nbsp;|&nbsp; Collapsed sequences: <strong>${shard.hasCollapsed ? 'yes' : 'no'}</strong>
        </p>
        <table>
          <thead>
            <tr>
              <th>Sequence</th>
              <th>Collapsed</th>
            </tr>
          </thead>
          <tbody>
            ${seqRows.length > 0 ? seqRows : '<tr><td colspan="2">No sequences on this shard.</td></tr>'}
          </tbody>
        </table>
      </div>
    </details>
  </div>`;
}

// ---------------------------------------------------------------------------
// Embedded script
// ---------------------------------------------------------------------------

/**
 * Generate the embedded `<script>` block with the full report data as JSON and
 * lightweight client-side interactivity helpers (tooltip positioning, etc.).
 *
 * @param data - Full report data to embed as JSON
 * @returns JavaScript source string (without `<script>` tags)
 */
function generateScript(data: ReportData): string {
  // Serialize the full data for potential client-side use.
  // JSON.stringify is safe here because the data is typed — no arbitrary
  // user content that could inject </script> tags in unexpected places.
  // We replace </script> occurrences defensively.
  const safeJson = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');

  return `
    // Full report data available for client-side use
    var REPORT_DATA = ${safeJson};

    // Expand/collapse all sections
    function setAllDetails(open) {
      document.querySelectorAll('details').forEach(function(el) {
        el.open = open;
      });
    }

    // Keyboard shortcut: 'e' = expand all, 'c' = collapse all
    document.addEventListener('keydown', function(e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'e') setAllDetails(true);
      if (e.key === 'c') setAllDetails(false);
    });

    // Log data to console for debugging
    console.info('[ordertest] Report data available as REPORT_DATA');
  `;
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/**
 * Derive an overall status for a step based on its test counts.
 *
 * @param step - Step report data
 * @returns Status string ('passed', 'failed', or 'skipped')
 */
function deriveStepStatus(step: StepReportData): string {
  if (step.failedCount > 0) return 'failed';
  if (step.passedCount > 0) return 'passed';
  return 'skipped';
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if needed.
 *
 * @param str - Input string
 * @param maxLen - Maximum character length
 * @returns Truncated string
 */
function truncateText(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}
