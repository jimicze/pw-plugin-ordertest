# Product Requirements Document (PRD)

## @playwright-ordertest/core — Playwright Ordered Test Execution Plugin

| Field | Value |
|-------|-------|
| **Product Name** | @playwright-ordertest/core |
| **Version** | 1.0.0 |
| **Status** | Design Approved — Pre-Implementation |
| **Author** | pw-plugin-ordertest team |
| **Created** | 2026-03-27 |
| **Last Updated** | 2026-03-27 |
| **Target Release** | 2026-Q2 |

---

## 1. Executive Summary

### 1.1 Problem Statement

Playwright Test provides excellent parallelization but offers no first-class mechanism for defining deterministic, cross-file test execution order. Teams that need ordered test flows (e.g., E2E scenarios where "login" must happen before "add to cart" before "checkout") are forced to:

1. **Cram everything into a single file** with `test.describe.configure({ mode: 'serial' })` — destroying modularity and code organization.
2. **Manually configure chained projects** with `dependencies[]` in `playwright.config.ts` — tedious, error-prone, and breaks when sharding is enabled.
3. **Use `workers: 1` globally** — killing parallelism for the entire suite, not just the ordered subset.
4. **Accept broken flows in CI** — sharding silently splits ordered test chains across machines, causing false failures.

There is **no existing npm package** that solves this problem. Playwright's GitHub issues show recurring requests for cross-file test ordering with no planned native solution.

### 1.2 Solution

A Playwright Test plugin (`@playwright-ordertest/core`) that:

- Lets users declaratively define ordered test sequences (files + optional test methods) via config or external manifest
- Supports three execution modes: `serial`, `parallel` (ordered files, parallel tests within), and `fullyParallel` (ordered files, fully parallel tests within)
- Automatically generates the correct Playwright `projects[]` configuration with `dependencies`, `testMatch`, `workers`, and execution modes
- Detects CI sharding (`--shard`) and prevents it from breaking ordered chains
- Provides an extended HTML reporter that visualizes sequence execution, ordering, and progress
- Logs all plugin activity persistently for debugging and audit trails

### 1.3 Non-Goals (v1.0)

- Cross-browser sequences (e.g., "login in Chrome, then verify in Firefox") — deferred to v2.0
- Visual test builder / GUI for defining sequences — out of scope
- Integration with specific CI providers beyond GitHub Actions examples — community-driven
- Custom retry strategies per sequence — uses Playwright's native retry mechanism
- Test dependency graphs (test A depends on test B's result) — this is ordering, not dependency injection

---

## 2. Target Users

### 2.1 Primary Persona: E2E Test Engineer

- Writes Playwright tests for complex web applications
- Has multi-step user flows that span multiple spec files
- Runs tests in CI with sharding enabled for speed
- Frustrated by flows breaking when tests run out of order
- Wants modularity (separate files per concern) without sacrificing execution guarantees

### 2.2 Secondary Persona: QA Lead / Test Architect

- Designs the test suite structure for a team
- Needs to define which flows exist and in what order they run
- Wants a single manifest that documents all ordered flows
- Needs reporting that shows flow-level pass/fail, not just individual tests

### 2.3 Tertiary Persona: DevOps / CI Engineer

- Configures CI pipelines with Playwright sharding
- Needs confidence that sharding won't silently break test flows
- Wants clear warnings/errors when sharding conflicts with ordering
- Needs HTML reports that merge cleanly across shards

---

## 3. Feature Specifications

### 3.1 Feature: Inline Config API — `defineOrderedConfig()`

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

A TypeScript function that wraps Playwright's `defineConfig()`. Users pass their normal Playwright config plus an `orderedTests` section. The function transforms the config, generating the correct `projects[]` array.

#### API Signature

```typescript
import { defineOrderedConfig } from '@playwright-ordertest/core';

export default defineOrderedConfig({
  // All standard Playwright config options are supported
  testDir: './tests',
  retries: 2,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  // Plugin-specific configuration
  orderedTests: {
    // Global plugin settings
    logLevel: 'info',                     // 'debug' | 'info' | 'warn' | 'error'
    logDir: '.ordertest',                 // Directory for activity logs
    shardStrategy: 'collapse',            // 'collapse' | 'warn' | 'fail'

    // Ordered sequences
    sequences: [
      {
        name: 'checkout-flow',            // Unique identifier for this sequence
        mode: 'serial',                   // 'serial' | 'parallel' | 'fullyParallel'
        browser: 'chromium',              // Optional: browser to use (default: project default)
        retries: 1,                       // Optional: override global retries for this sequence
        timeout: 60000,                   // Optional: override global timeout
        files: [
          // Simple: entire file, all tests
          'auth/login.spec.ts',

          // Detailed: specific tests within a file
          {
            file: 'cart/add-item.spec.ts',
            tests: ['add single item', 'add multiple items'],  // Only these tests
          },

          // Detailed with tags
          {
            file: 'checkout/payment.spec.ts',
            tests: ['credit card payment'],
            tags: ['@smoke'],             // Additional PW tag filtering
          },
        ],
      },
      {
        name: 'admin-flow',
        mode: 'parallel',                 // Files in order, tests within files parallel
        files: [
          'admin/login.spec.ts',
          'admin/create-user.spec.ts',
          'admin/assign-role.spec.ts',
        ],
      },
    ],

    // Tests not in any sequence run normally (unordered)
    // They form an implicit "unordered" project with default settings
  },

  // Users can still define their own projects — they'll be merged
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

#### Behavior

1. **Validation**: The `orderedTests` config is validated against a Zod schema. Clear errors for invalid configs.
2. **Project generation**: Each sequence becomes one or more Playwright projects (depending on mode).
3. **Merging**: User-defined `projects[]` are preserved and merged with generated projects.
4. **Reporter injection**: If no reporter is configured, the ordered HTML reporter is automatically added.
5. **Idempotent**: The function produces identical output for identical input (required because PW evaluates config per worker).

#### Acceptance Criteria

- [ ] TypeScript types provide full IntelliSense for the `orderedTests` config
- [ ] Invalid configs produce clear, actionable error messages (not stack traces)
- [ ] Generated `projects[]` array is valid Playwright config (passes PW's own validation)
- [ ] User-defined projects are preserved without modification
- [ ] Config transformation is deterministic (same input → same output, every time)
- [ ] All config activity is logged to the persistent activity log

---

### 3.2 Feature: External Manifest File

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

As an alternative to inline config, users can define ordered sequences in an external file. The plugin auto-discovers this file or accepts an explicit path.

#### Supported Formats

1. **`ordertest.config.ts`** — TypeScript (type-checked, auto-completed)
2. **`ordertest.config.json`** — JSON (simple, CI-friendly)
3. **`ordertest.config.yaml`** — YAML (human-readable)

#### Auto-Discovery Order

The plugin searches for manifest files in this order (first match wins):

1. Explicit path in inline config: `orderedTests: { manifest: './my-order.json' }`
2. `ordertest.config.ts` in project root
3. `ordertest.config.json` in project root
4. `ordertest.config.yaml` in project root

If both inline `sequences` and a manifest file exist, inline takes precedence and the manifest is ignored (with a warning logged).

#### Manifest File Schema

```typescript
// ordertest.config.ts
import type { OrderedTestManifest } from '@playwright-ordertest/core';

const manifest: OrderedTestManifest = {
  sequences: [
    {
      name: 'checkout-flow',
      mode: 'serial',
      files: [
        'auth/login.spec.ts',
        { file: 'cart/add-item.spec.ts', tests: ['add single item'] },
        'checkout/payment.spec.ts',
      ],
    },
  ],
};

export default manifest;
```

```json
// ordertest.config.json
{
  "$schema": "https://unpkg.com/@playwright-ordertest/core/schema.json",
  "sequences": [
    {
      "name": "checkout-flow",
      "mode": "serial",
      "files": [
        "auth/login.spec.ts",
        { "file": "cart/add-item.spec.ts", "tests": ["add single item"] },
        "checkout/payment.spec.ts"
      ]
    }
  ]
}
```

```yaml
# ordertest.config.yaml
sequences:
  - name: checkout-flow
    mode: serial
    files:
      - auth/login.spec.ts
      - file: cart/add-item.spec.ts
        tests:
          - add single item
      - checkout/payment.spec.ts
```

#### Acceptance Criteria

- [ ] All three formats (TS, JSON, YAML) are loadable and validated identically
- [ ] Auto-discovery finds manifest files without explicit configuration
- [ ] JSON schema file is published for IDE auto-completion in JSON manifests
- [ ] Clear error when manifest file is malformed (with file path and line number if possible)
- [ ] TS manifests are type-checked at load time
- [ ] Manifest loading is logged to activity log

---

### 3.3 Feature: Serial Execution Mode

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

When `mode: 'serial'`, all files in the sequence run strictly in the defined order, on a **single worker**, with no parallelism. If any test fails, subsequent tests in the sequence are skipped (following Playwright's serial suite behavior).

#### Implementation Strategy

A serial sequence generates **one Playwright project**:

```typescript
// Generated for sequence: { name: 'checkout-flow', mode: 'serial', files: [...] }
{
  name: 'ordertest:checkout-flow',
  testMatch: [
    'auth/login.spec.ts',
    'cart/add-item.spec.ts',
    'checkout/payment.spec.ts',
  ],
  workers: 1,                    // Single worker — guarantees sequential execution
  fullyParallel: false,          // Tests within files also run sequentially
  // Files are run in alphabetical order by PW. To enforce our custom order,
  // we generate a wrapper spec file that imports/requires tests in order.
  // OR: We use project dependencies with one project per file for strict ordering.
}
```

**Critical implementation detail**: Playwright runs files within a project in alphabetical order (by file path). Since our user-defined order may differ from alphabetical order, we have two options:

**Option A — File-per-project chain** (chosen): Each file becomes its own project with `dependencies` pointing to the previous project. This guarantees ordering regardless of file names.

```typescript
// Generated projects for serial sequence
[
  { name: 'ordertest:checkout-flow:0', testMatch: 'auth/login.spec.ts', workers: 1 },
  { name: 'ordertest:checkout-flow:1', testMatch: 'cart/add-item.spec.ts', workers: 1, dependencies: ['ordertest:checkout-flow:0'] },
  { name: 'ordertest:checkout-flow:2', testMatch: 'checkout/payment.spec.ts', workers: 1, dependencies: ['ordertest:checkout-flow:1'] },
]
```

**Option B — Alphabetical prefix injection** (rejected): Rename files at runtime. Too invasive, breaks source maps, and confuses reporters.

#### Retry Behavior

When a test fails in a serial sequence:

1. Playwright's serial mode skips all subsequent tests in the current file.
2. Our project dependency chain stops the entire sequence — project N+1 won't start if project N has failures.
3. On retry: only the failed project retries. If it passes, the chain continues.

#### Shard Behavior

Serial sequences in shard mode: all projects in the chain are collapsed into a **single project** with `workers: 1`. This ensures the entire sequence lands on one shard. A warning is logged: "Serial sequence 'checkout-flow' collapsed to single project for shard safety."

#### Acceptance Criteria

- [ ] Tests execute in the exact order defined, regardless of file names
- [ ] A single worker processes all tests (no parallelism)
- [ ] If test N fails, tests N+1..end are skipped
- [ ] The sequence is atomic under sharding (never split across shards)
- [ ] Retries work correctly (failed project retries, then chain continues)
- [ ] Activity log records execution order and timing

---

### 3.4 Feature: Parallel Execution Mode

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

When `mode: 'parallel'`, files in the sequence run in the defined order (file B starts only after all tests in file A complete), but **tests within each file run in parallel** using multiple workers.

#### Implementation Strategy

Each file becomes a project. Each project allows multiple workers (uses default or user-configured `workers` count). Projects are chained with `dependencies[]`.

```typescript
// Generated projects for parallel sequence
[
  { name: 'ordertest:admin-flow:0', testMatch: 'admin/login.spec.ts', fullyParallel: false },
  { name: 'ordertest:admin-flow:1', testMatch: 'admin/create-user.spec.ts', fullyParallel: false, dependencies: ['ordertest:admin-flow:0'] },
  { name: 'ordertest:admin-flow:2', testMatch: 'admin/assign-role.spec.ts', fullyParallel: false, dependencies: ['ordertest:admin-flow:1'] },
]
```

Note: `fullyParallel: false` means tests within a file run sequentially by default (Playwright's default behavior). Workers parallelize at the file level, but since each project has only one file, the parallelism is within-file only if the file has multiple `test.describe` blocks.

#### Shard Behavior

Under sharding, the project dependency chain is shard-local. The plugin detects sharding and handles it according to the configured `shardStrategy`:

- `'collapse'` (default): Collapse the chain into a single project with sequential file execution. Log a warning.
- `'warn'`: Keep the chain but log a prominent warning that ordering may break across shards.
- `'fail'`: Throw an error refusing to run parallel sequences under sharding.

#### Acceptance Criteria

- [ ] File B does not start until all tests in file A complete
- [ ] Tests within each file can run in parallel (if the file has parallel test.describes)
- [ ] Shard strategy is configurable and defaults to 'collapse'
- [ ] Worker count respects user configuration
- [ ] Activity log records file-level timing and ordering

---

### 3.5 Feature: Fully Parallel Execution Mode

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

When `mode: 'fullyParallel'`, files run in the defined order (file B after file A), but **tests within each file are fully parallelized** — each test can run on its own worker.

#### Implementation Strategy

Same as parallel mode, but each generated project has `fullyParallel: true`:

```typescript
[
  { name: 'ordertest:perf-suite:0', testMatch: 'perf/homepage.spec.ts', fullyParallel: true },
  { name: 'ordertest:perf-suite:1', testMatch: 'perf/dashboard.spec.ts', fullyParallel: true, dependencies: ['ordertest:perf-suite:0'] },
]
```

#### Key Difference from Parallel

| Aspect | `parallel` | `fullyParallel` |
|--------|-----------|-----------------|
| File ordering | Enforced via deps | Enforced via deps |
| Tests within file | Sequential (PW default) | Each test gets own worker |
| Worker utilization | Low (1 file = 1 worker at a time) | High (N tests = up to N workers) |
| Test isolation | Shared page within file | Each test has own page |
| Shard granularity | One TestGroup per file | One TestGroup per test |

#### Shard Behavior

`fullyParallel: true` changes Playwright's shard granularity to per-test. This means individual tests from a single file may be split across shards. Under sharding:

- `'collapse'`: Collapse to serial (single project, workers:1)
- `'warn'`: Keep fullyParallel but warn that within-file tests may split across shards (file ordering is still enforced within each shard)
- `'fail'`: Throw error

#### Acceptance Criteria

- [ ] File ordering is enforced (B after A)
- [ ] Tests within each file run fully parallel
- [ ] Each test gets its own browser context (Playwright's fullyParallel behavior)
- [ ] Shard strategy is respected
- [ ] Performance improvement is measurable vs serial mode for test suites with many independent tests per file

---

### 3.6 Feature: Test-Level Filtering

**Priority**: P1 (Should Have)
**Status**: Specified

#### Description

Users can specify not just files but individual test names within a file. Only the specified tests run as part of the sequence; other tests in the file are excluded from the ordered execution (they may still run in the unordered project).

#### API

```typescript
files: [
  // All tests in the file
  'auth/login.spec.ts',

  // Specific tests only
  {
    file: 'cart/add-item.spec.ts',
    tests: ['add single item', 'add multiple items'],
  },

  // Specific tests with tag filtering
  {
    file: 'checkout/payment.spec.ts',
    tests: ['credit card payment'],
    tags: ['@smoke'],
  },
]
```

#### Implementation

Test-level filtering uses Playwright's `testProject.grep` property:

```typescript
{
  name: 'ordertest:checkout-flow:1',
  testMatch: 'cart/add-item.spec.ts',
  grep: /^(add single item|add multiple items)$/,
  dependencies: ['ordertest:checkout-flow:0'],
}
```

For tag filtering, we combine `grep` with Playwright's native `--grep-invert` or tag filtering.

#### Edge Cases

1. **Test name with regex special characters**: Escape all special chars in test names before building the grep regex.
2. **Test name not found**: If a specified test name doesn't match any test in the file, log a warning (don't fail — the test may be skipped via `.skip` or conditionally defined).
3. **Empty tests array**: If `tests: []`, treat as "all tests in the file" (with a warning).

#### Acceptance Criteria

- [ ] Only specified tests run within the ordered sequence
- [ ] Unspecified tests in the same file are excluded from the sequence
- [ ] Regex special characters in test names are properly escaped
- [ ] Tags are applied correctly in combination with test name filtering
- [ ] Warnings are logged for empty or non-matching test specifications

---

### 3.7 Feature: Shard-Aware Execution Guard

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

The plugin detects when Playwright is running in shard mode (`--shard=X/Y` or `config.shard`) and adjusts its strategy to prevent ordered test chains from being broken across shards.

#### Detection

```typescript
// Detection sources (checked in this order):
// 1. config.shard property (set in playwright.config.ts)
// 2. process.argv containing --shard
// 3. process.env.PLAYWRIGHT_SHARD (custom CI integration)
```

#### Shard Strategies

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `'collapse'` (default) | Collapse all chained projects into a single project. Serial sequences keep workers:1. Parallel/fullyParallel sequences become serial within the collapsed project. | Safety-first. Guarantees ordering at the cost of some parallelism. |
| `'warn'` | Keep the generated project structure but log a prominent warning that ordering may break across shards. | User accepts the risk and wants maximum parallelism. |
| `'fail'` | Throw `OrderTestShardError` and refuse to generate config. | Strict environments where broken ordering is unacceptable and the user must resolve the conflict. |

#### Collapse Mechanism

When collapsing:

1. All projects in a sequence are merged into a single project.
2. `testMatch` becomes an array of all files in the sequence.
3. `workers: 1` is set (to maintain file ordering within the single project).
4. `fullyParallel: false` is set.
5. `dependencies` are removed (single project doesn't need self-dependencies).
6. A metadata annotation is added for the reporter to display collapse information.

#### Acceptance Criteria

- [ ] Shard mode is correctly detected from all three sources (config, CLI args, env var)
- [ ] `'collapse'` strategy produces a valid, single-project config
- [ ] `'warn'` strategy logs a visible warning but doesn't alter config
- [ ] `'fail'` strategy throws a clear error with remediation instructions
- [ ] Activity log records shard detection and strategy decision
- [ ] Non-ordered tests (unordered project) are NOT affected by shard guard

---

### 3.8 Feature: Ordered HTML Reporter (Wrapper)

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

The default reporter wraps Playwright's built-in HTML reporter. It delegates all standard reporting to the HTML reporter while injecting ordered-sequence metadata into the report.

#### How It Works

1. **Instantiation**: The ordered reporter creates an instance of PW's HTML reporter internally.
2. **Event delegation**: All reporter events (`onBegin`, `onTestBegin`, `onTestEnd`, `onEnd`, etc.) are forwarded to the HTML reporter.
3. **Metadata injection**: For each test that belongs to an ordered sequence, the reporter calls `testInfo.attach()` (or `result.attachments.push()`) to add metadata:
   - Sequence name
   - Position in sequence (e.g., "Step 2 of 5")
   - Execution mode
   - Whether the sequence was collapsed for sharding
4. **Summary injection**: At `onEnd`, the reporter generates a sequence summary attachment on the root suite.

#### Reporter Configuration

```typescript
// playwright.config.ts (generated by defineOrderedConfig)
reporter: [
  ['@playwright-ordertest/core/reporter', {
    // Pass-through to PW HTML reporter
    outputFolder: 'playwright-report',
    open: 'never',

    // Plugin-specific options
    showSequenceTimeline: true,      // Show sequence execution timeline in report
    showSequenceInTestTitle: true,   // Prefix test titles with "[sequence-name] Step N"
  }],
],
```

#### Merge-Reports Compatibility

The wrapper reporter uses PW's `blob` reporter for shard merging. Sequence metadata is stored as test attachments, which are preserved through blob merge. The merged HTML report shows the complete sequence view.

#### Acceptance Criteria

- [ ] HTML report is identical to PW's native report, plus sequence metadata
- [ ] Sequence information appears in test detail view
- [ ] Report generates without errors for zero-sequence configs (passthrough mode)
- [ ] Compatible with `npx playwright merge-reports` for sharded runs
- [ ] Reporter options are passed through to the underlying HTML reporter

---

### 3.9 Feature: Custom HTML Reporter (Optional)

**Priority**: P2 (Nice to Have)
**Status**: Specified

#### Description

An optional standalone HTML reporter with rich sequence visualization. Users opt in by specifying the custom reporter path.

#### Custom Visualizations

1. **Sequence Timeline**: Gantt-chart-style visualization showing when each file/test in a sequence started and finished, color-coded by pass/fail/skip.

2. **Sequence Summary Table**: For each sequence, shows:
   - Name, mode, status (all-passed / has-failures / has-skips)
   - Total duration
   - Files: ordered list with individual timing
   - Tests: count passed/failed/skipped

3. **Dependency Graph**: Visual graph showing project dependencies generated by the plugin.

4. **Shard Distribution View**: If sharded, shows which sequences landed on which shard and whether any were collapsed.

#### Implementation

Built as a standalone HTML page using:
- Vanilla HTML/CSS/JS (no framework — keeps bundle small, no build step for the report itself)
- Chart rendering: lightweight SVG-based Gantt chart (no D3 dependency)
- Data: embedded as JSON in a `<script>` tag in the HTML file

#### Acceptance Criteria

- [ ] Sequence timeline renders correctly for all three modes
- [ ] Summary table shows accurate pass/fail/skip counts
- [ ] Report file is self-contained (single HTML file, no external dependencies)
- [ ] Report renders in all major browsers
- [ ] Compatible with merge-reports (aggregates data from multiple shards)

---

### 3.10 Feature: Persistent Activity Logging

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

Every significant plugin action is logged to a persistent, structured JSON log file. This is essential for debugging ordering issues, CI failures, and understanding plugin decisions.

#### Log Events

| Event | Level | Data |
|-------|-------|------|
| Config loaded | info | Source (inline/manifest), file path |
| Config validated | info | Sequence count, total files |
| Config validation error | error | Zod error details, original config (sanitized) |
| Shard detected | info | Shard current/total, detection source |
| Shard strategy applied | warn | Strategy name, affected sequences |
| Project generated | info | Project name, testMatch, workers, deps |
| Sequence collapsed | warn | Sequence name, reason, original vs collapsed structure |
| Test started (reporter) | info | Test title, sequence name, position, file |
| Test completed (reporter) | info | Test title, status, duration, sequence position |
| Sequence completed | info | Sequence name, status, total duration, pass/fail/skip counts |
| Plugin error | error | Error class, message, stack trace, context |
| Manifest loaded | info | File path, format, sequence count |
| Manifest not found | debug | Searched paths |

#### Log Format

```json
{"level":30,"time":1711555200000,"pid":12345,"hostname":"ci-runner-7","msg":"Generating projects for sequence","sequence":"checkout-flow","mode":"serial","fileCount":3}
{"level":30,"time":1711555200001,"pid":12345,"hostname":"ci-runner-7","msg":"Created project","project":"ordertest:checkout-flow:0","testMatch":"auth/login.spec.ts","workers":1}
{"level":40,"time":1711555200002,"pid":12345,"hostname":"ci-runner-7","msg":"Shard detected, collapsing parallel to serial","shard":"2/5","sequence":"admin-flow","strategy":"collapse"}
```

#### Configuration

```typescript
orderedTests: {
  logLevel: 'info',           // 'debug' | 'info' | 'warn' | 'error' | 'silent'
  logDir: '.ordertest',       // Directory for log files
  logStdout: false,           // Also emit to stdout (useful in CI)
  logRotation: {
    maxSize: '10m',           // Max log file size before rotation
    maxFiles: 5,              // Number of rotated files to keep
  },
}
```

#### Acceptance Criteria

- [ ] All events in the table above are logged at the correct level
- [ ] Log file is created in the configured directory
- [ ] Log rotation works correctly (rotates at maxSize, keeps maxFiles)
- [ ] `logLevel: 'silent'` suppresses all log output (but still creates the log file)
- [ ] Log file is safe for concurrent writes (multiple workers)
- [ ] Logs contain enough context to reconstruct exactly what the plugin did and why

---

### 3.10.1 Feature: Debug Console Output

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

In addition to persistent file-based logging, the plugin provides a verbose console debug mode that prints human-readable, colorized output to stderr. This is activated via `ORDERTEST_DEBUG=true` or `orderedTests.debug: true` in config. It is designed for users debugging ordering issues locally or in CI.

#### What Debug Mode Outputs

When debug mode is enabled, the plugin prints to stderr (not stdout, to avoid interfering with Playwright's output):

```
[ordertest:debug] Config loaded from inline orderedTests (3 sequences)
[ordertest:debug] Sequence "checkout-flow" (serial, 3 files)
[ordertest:debug]   → Step 0: auth/login.spec.ts (all tests)
[ordertest:debug]   → Step 1: cart/add-item.spec.ts (grep: /^(add single item|add multiple items)$/)
[ordertest:debug]   → Step 2: checkout/payment.spec.ts (all tests, tags: @smoke)
[ordertest:debug] Shard detected: 2/5 (source: process.argv)
[ordertest:debug] Shard strategy: collapse → collapsing "checkout-flow" to single project
[ordertest:debug] Generated 7 projects:
[ordertest:debug]   ordertest:checkout-flow:0 → auth/login.spec.ts [workers:1, deps:[]]
[ordertest:debug]   ordertest:checkout-flow:1 → cart/add-item.spec.ts [workers:1, deps:[checkout-flow:0]]
[ordertest:debug]   ...
[ordertest:debug]   ordertest:unordered → [testIgnore: 6 files]
[ordertest:debug] Reporter: orderedHtmlReporter injected
[ordertest:debug] Config transformation complete (4ms)
```

#### Activation

```typescript
// Via config
orderedTests: {
  debug: true,  // Enable debug console output
}

// Via environment variable (overrides config)
ORDERTEST_DEBUG=true npx playwright test

// Via logLevel (debug level also enables console output)
orderedTests: {
  logLevel: 'debug',  // Enables debug-level pino logs AND console output
}
```

#### Implementation Rules

1. **Use stderr** (`process.stderr.write`) — never stdout. Playwright uses stdout for its own output.
2. **Prefix all lines** with `[ordertest:debug]` for easy grep/filtering.
3. **Include timing** — measure and report config transformation duration.
4. **Structured but readable** — not JSON, but human-scannable indented text.
5. **Every module must emit debug output** at key decision points (see "Internal Debug Logging" below).

#### Internal Debug Logging (for developers)

Every module in the plugin must have thorough debug-level log statements at key decision points. These go to the pino logger at `level: 'debug'` and are also emitted to console when debug mode is active.

| Module | Debug Events |
|--------|-------------|
| `validator.ts` | Schema parsed, each field validated, defaults applied |
| `manifestLoader.ts` | Search paths tried, file found/not found, parse result |
| `serialStrategy.ts` | Each project created, deps chain, workers/mode set |
| `parallelStrategy.ts` | Each project created, deps chain, workers count |
| `fullyParallelStrategy.ts` | Each project created, fullyParallel flag set |
| `testFilter.ts` | Input test names, generated regex, escaped chars |
| `projectGenerator.ts` | Strategy routing decision, merged project list, unordered project files |
| `shardGuard.ts` | Detection source checked, shard values, strategy decision, collapse details |
| `defineOrderedConfig.ts` | Entry, manifest vs inline decision, merge steps, final project count, timing |
| `orderedHtmlReporter.ts` | Sequence mapping built, metadata injected per test, summary generated |
| `sequenceTracker.ts` | Project name parsed, sequence matched, progress updated |

#### Acceptance Criteria

- [ ] `ORDERTEST_DEBUG=true` enables human-readable console output to stderr
- [ ] `orderedTests.debug: true` enables the same via config
- [ ] Console output is prefixed with `[ordertest:debug]` on every line
- [ ] Config transformation timing is reported
- [ ] Every module emits debug-level pino logs at key decision points
- [ ] Debug output does not interfere with Playwright's stdout output
- [ ] Debug mode works in both local and CI environments
- [ ] `logLevel: 'debug'` implicitly enables console debug output

---

### 3.11 Feature: Unordered Test Passthrough

**Priority**: P0 (Must Have)
**Status**: Specified

#### Description

Tests that are not part of any ordered sequence must continue to run normally, with no behavioral changes. The plugin must not break the default Playwright experience for unordered tests.

#### Implementation

The plugin generates an additional "passthrough" project that uses `testIgnore` to exclude all files that belong to ordered sequences:

```typescript
{
  name: 'ordertest:unordered',
  testIgnore: [
    'auth/login.spec.ts',
    'cart/add-item.spec.ts',
    'checkout/payment.spec.ts',
    'admin/login.spec.ts',
    'admin/create-user.spec.ts',
    'admin/assign-role.spec.ts',
  ],
  // Inherits all default config: workers, fullyParallel, browsers, etc.
}
```

If the user defines their own `projects[]`, those are preserved as-is. The unordered project only handles files not covered by user projects or ordered sequences.

#### Acceptance Criteria

- [ ] Files not in any sequence run normally with default parallelism
- [ ] User-defined projects are not modified
- [ ] No test is accidentally excluded or double-counted
- [ ] The unordered project inherits the base config's `use`, `workers`, etc.

---

## 4. Technical Architecture

### 4.1 System Context Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     User's Project                       │
│                                                         │
│  playwright.config.ts ──→ defineOrderedConfig()         │
│                              │                          │
│  ordertest.config.json ──→ manifestLoader ──┐           │
│                                             │           │
│                              ┌──────────────┘           │
│                              ▼                          │
│                    ┌─────────────────┐                  │
│                    │  Config Engine   │                  │
│                    │  (validator →    │                  │
│                    │   shardGuard →   │                  │
│                    │   projGenerator) │                  │
│                    └────────┬────────┘                  │
│                             │                          │
│                             ▼                          │
│                    Native defineConfig()               │
│                             │                          │
│                             ▼                          │
│                    Playwright Test Runner              │
│                    (enforces ordering via              │
│                     projects + deps)                   │
│                             │                          │
│                             ▼                          │
│                    ┌─────────────────┐                  │
│                    │   Reporter(s)    │                  │
│                    │  (wrapper HTML   │                  │
│                    │   + sequence     │                  │
│                    │   metadata)      │                  │
│                    └────────┬────────┘                  │
│                             │                          │
│                             ▼                          │
│                    HTML Report + Activity Log           │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow

```
User Config
    │
    ▼
┌──────────────────────┐
│ 1. Load & Validate   │ ← Zod schema validation
│    (validator.ts)     │ ← Manifest loading (if external)
└──────────┬───────────┘
           │ OrderedTestConfig (validated)
           ▼
┌──────────────────────┐
│ 2. Detect Shard      │ ← Reads config.shard, process.argv, env
│    (shardGuard.ts)   │ ← Decides: collapse / warn / fail
└──────────┬───────────┘
           │ ShardAwareConfig
           ▼
┌──────────────────────┐
│ 3. Generate Projects │ ← Routes to serial/parallel/fullyParallel strategy
│    (projGenerator)   │ ← Each strategy returns ProjectConfig[]
└──────────┬───────────┘
           │ PlaywrightProjectConfig[]
           ▼
┌──────────────────────┐
│ 4. Merge & Output    │ ← Merges with user projects
│    (defineOrdered     │ ← Injects reporter config
│     Config.ts)       │ ← Returns final PlaywrightTestConfig
└──────────┬───────────┘
           │ Final Config
           ▼
     Playwright's defineConfig()
```

### 4.3 Generated Project Naming Convention

```
ordertest:<sequence-name>:<step-index>

Examples:
  ordertest:checkout-flow:0     ← First file in checkout-flow
  ordertest:checkout-flow:1     ← Second file in checkout-flow
  ordertest:admin-flow:0        ← First file in admin-flow
  ordertest:unordered           ← Tests not in any sequence
```

### 4.4 Module Dependency Graph

```
src/index.ts
├── src/config/defineOrderedConfig.ts
│   ├── src/config/types.ts
│   ├── src/config/validator.ts
│   │   └── src/config/types.ts
│   ├── src/config/manifestLoader.ts
│   │   ├── src/config/types.ts
│   │   └── src/config/validator.ts
│   ├── src/config/shardGuard.ts
│   │   └── src/config/types.ts
│   └── src/engine/projectGenerator.ts
│       ├── src/config/types.ts
│       ├── src/engine/serialStrategy.ts
│       │   ├── src/config/types.ts
│       │   └── src/engine/testFilter.ts
│       ├── src/engine/parallelStrategy.ts
│       │   ├── src/config/types.ts
│       │   └── src/engine/testFilter.ts
│       ├── src/engine/fullyParallelStrategy.ts
│       │   ├── src/config/types.ts
│       │   └── src/engine/testFilter.ts
│       └── src/engine/testFilter.ts
│           └── src/config/types.ts
├── src/reporter/orderedHtmlReporter.ts
│   ├── src/config/types.ts
│   └── src/reporter/sequenceTracker.ts
├── src/reporter/customHtmlReporter.ts
│   ├── src/config/types.ts
│   └── src/reporter/sequenceTracker.ts
└── src/logger/logger.ts
    └── src/config/types.ts
```

---

## 5. Configuration Reference

### 5.1 Full Configuration Schema

```typescript
interface OrderedTestPluginConfig {
  /** Ordered test sequences */
  sequences?: SequenceDefinition[];

  /** Path to external manifest file (overrides auto-discovery) */
  manifest?: string;

  /** Log level for persistent activity logging */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';

  /** Directory for log files (relative to project root) */
  logDir?: string;

  /** Also emit logs to stdout */
  logStdout?: boolean;

  /** Log rotation settings */
  logRotation?: {
    /** Max file size before rotation (e.g., '10m', '1g') */
    maxSize?: string;
    /** Number of rotated files to keep */
    maxFiles?: number;
  };

  /** Strategy when sharding conflicts with ordering */
  shardStrategy?: 'collapse' | 'warn' | 'fail';

  /** Enable verbose debug output to stderr */
  debug?: boolean;
}

interface SequenceDefinition {
  /** Unique name for this sequence */
  name: string;

  /** Execution mode */
  mode: 'serial' | 'parallel' | 'fullyParallel';

  /** Ordered list of test files */
  files: Array<string | FileSpecification>;

  /** Browser/project to use (optional, uses default if not specified) */
  browser?: string;

  /** Override retries for this sequence (optional) */
  retries?: number;

  /** Override timeout for this sequence (optional) */
  timeout?: number;

  /** Override workers for this sequence (optional, only meaningful for parallel/fullyParallel) */
  workers?: number;

  /** Tags to filter tests within this sequence (optional) */
  tags?: string[];
}

interface FileSpecification {
  /** Relative path to the test file (from testDir) */
  file: string;

  /** Specific test names to include (empty/undefined = all tests) */
  tests?: string[];

  /** Tags to filter tests within this file (optional) */
  tags?: string[];
}
```

### 5.2 Defaults

| Option | Default | Notes |
|--------|---------|-------|
| `logLevel` | `'info'` | Set to `'debug'` for maximum visibility |
| `logDir` | `'.ordertest'` | Created automatically if it doesn't exist |
| `logStdout` | `false` | Set `ORDERTEST_LOG_STDOUT=true` env var to override |
| `logRotation.maxSize` | `'10m'` | 10 megabytes |
| `logRotation.maxFiles` | `5` | Keep last 5 rotated files |
| `shardStrategy` | `'collapse'` | Safest default — never breaks ordering |
| `mode` | (required) | No default — user must choose |
| `browser` | (inherited) | Uses the base config's browser settings |
| `retries` | (inherited) | Uses the base config's retries |
| `timeout` | (inherited) | Uses the base config's timeout |
| `workers` | (inherited) | Uses the base config's workers |

---

## 6. Edge Cases and Error Handling

### 6.1 Duplicate Files Across Sequences

**Scenario**: The same file appears in two different sequences.
**Behavior**: The file is included in both sequences, each with its own project. If the user specified test-level filtering, different tests from the same file may belong to different sequences.
**Warning**: Log a warning if the same test (file + test name) appears in multiple sequences — this may cause unexpected behavior.

### 6.2 Non-Existent Files

**Scenario**: A file in the manifest doesn't exist on disk.
**Behavior**: Fail validation with a clear error: "File 'path/to/missing.spec.ts' in sequence 'checkout-flow' does not exist. Searched in testDir: '/abs/path/tests'."

### 6.3 Empty Sequence

**Scenario**: `files: []` in a sequence definition.
**Behavior**: Fail validation: "Sequence 'name' has no files. Remove the sequence or add at least one file."

### 6.4 Circular Dependencies

**Scenario**: Sequence A depends on Sequence B which depends on Sequence A (not directly supported in v1.0, but projects with manual dependencies could create this).
**Behavior**: Playwright itself detects circular dependencies and fails. Our plugin should pre-validate generated projects for cycles.

### 6.5 Config Evaluated Multiple Times

**Scenario**: Playwright evaluates `playwright.config.ts` once per worker process.
**Behavior**: Our config transformer is pure and deterministic. Same input → same output. No side effects during config generation (logging happens but is append-only and safe for concurrent writes).

### 6.6 No Sequences Defined

**Scenario**: User uses `defineOrderedConfig()` but doesn't define any sequences (or manifest is empty).
**Behavior**: Passthrough mode — the plugin does nothing, returns the config as-is. Log info: "No ordered sequences defined. Running in passthrough mode."

### 6.7 Sequence Name Collision

**Scenario**: Two sequences have the same name.
**Behavior**: Fail validation: "Duplicate sequence name 'checkout-flow'. Each sequence must have a unique name."

### 6.8 Sequence Name Conflicts with User Project

**Scenario**: User has a project named "chromium" and a sequence generates a project that might conflict.
**Behavior**: Our projects are always prefixed with `ordertest:`, so collision is impossible unless the user manually names a project starting with `ordertest:`. Validation checks for this.

---

## 7. CLI Integration

### 7.1 No Custom CLI

The plugin does **not** provide a custom CLI. All execution goes through Playwright's standard CLI:

```bash
# Run all tests (ordered and unordered)
npx playwright test

# Run with sharding
npx playwright test --shard=1/3

# Run only a specific sequence's project
npx playwright test --project="ordertest:checkout-flow:*"

# Run with the custom reporter
npx playwright test --reporter=@playwright-ordertest/core/reporter
```

### 7.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `ORDERTEST_LOG_LEVEL` | Override log level (overrides config) |
| `ORDERTEST_LOG_STDOUT` | Set to `'true'` to also emit logs to stdout |
| `ORDERTEST_LOG_DIR` | Override log directory (overrides config) |
| `ORDERTEST_SHARD_STRATEGY` | Override shard strategy (overrides config) |
| `ORDERTEST_MANIFEST` | Path to manifest file (overrides auto-discovery) |
| `ORDERTEST_DEBUG` | Set to `'true'` to enable verbose console debug output to stderr |

---

## 8. Performance Considerations

### 8.1 Config Generation Overhead

The config transformer runs once per worker spawn (Playwright re-evaluates the config). Our transformer must be fast:

- **Target**: <10ms for config generation (excluding manifest file I/O)
- **Strategy**: No async operations in the config transformer. Manifest loading uses `fs.readFileSync()` (safe because it's in the config, not in a test).

### 8.2 Reporter Overhead

The reporter wraps PW's HTML reporter. Overhead is the cost of:

- Tracking sequence membership (Map lookup per test: O(1))
- Injecting attachments (string concatenation per test)
- Writing to activity log (async, buffered, non-blocking)

**Target**: <1ms per test event.

### 8.3 Shard Collapse Overhead

When collapsing parallel sequences to serial under sharding:

- Parallelism is reduced for ordered sequences
- Unordered tests are NOT affected
- The overhead is inherent to the safety guarantee — users who want parallelism under sharding should use `shardStrategy: 'warn'`

---

## 9. Testing Strategy

### 9.1 Unit Tests

Test each module in isolation with mocked dependencies:

- `validator.test.ts` — schema validation with valid/invalid configs, edge cases
- `serialStrategy.test.ts` — project generation for serial sequences
- `parallelStrategy.test.ts` — project generation for parallel sequences
- `fullyParallelStrategy.test.ts` — project generation for fullyParallel sequences
- `testFilter.test.ts` — grep pattern generation, special character escaping
- `shardGuard.test.ts` — shard detection from all sources, strategy application
- `projectGenerator.test.ts` — routing to correct strategy, project merging
- `manifestLoader.test.ts` — loading from JSON, YAML, TS; auto-discovery
- `logger.test.ts` — log file creation, rotation, level filtering

### 9.2 Integration Tests

End-to-end tests that run actual Playwright Test on fixture configs:

- `serial-execution.test.ts` — verify serial ordering by checking execution timestamps
- `parallel-execution.test.ts` — verify file ordering + within-file parallelism
- `fullyParallel-execution.test.ts` — verify file ordering + full test parallelism
- `shard-safety.test.ts` — run with `--shard` and verify no chain breakage
- `reporter.test.ts` — verify HTML report contains sequence metadata

### 9.3 Cross-Platform Tests

CI matrix:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: [18, 20, 22]
    playwright: ['1.40.0', '1.44.0', 'latest']
```

---

## 10. Release Plan

### 10.1 v1.0.0 — Initial Release

- [ ] Core config transformer (defineOrderedConfig)
- [ ] All three execution modes (serial, parallel, fullyParallel)
- [ ] External manifest support (JSON, YAML, TS)
- [ ] Shard guard with collapse/warn/fail strategies
- [ ] Test-level filtering (grep-based)
- [ ] Wrapper HTML reporter with sequence metadata
- [ ] Persistent activity logging (pino)
- [ ] Unordered test passthrough
- [ ] Full unit + integration test suite
- [ ] Cross-platform CI (Linux, macOS, Windows)
- [ ] npm publish as `@playwright-ordertest/core`
- [ ] JSON schema for manifest files
- [ ] Examples (serial, parallel, sharded CI)
- [ ] README with quick start, API reference, examples

### 10.2 v1.1.0 — Reporter Enhancement

- [ ] Custom standalone HTML reporter with sequence timeline
- [ ] Dependency graph visualization
- [ ] Shard distribution view

### 10.3 v2.0.0 — Advanced Features

- [ ] Cross-browser sequences
- [ ] Sequence dependencies (sequence B after sequence A)
- [ ] Weighted shard distribution for ordered sequences
- [ ] VS Code extension for sequence visualization
- [ ] Test result caching (skip sequence if all tests passed in last run)

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| npm weekly downloads | 1,000+ within 6 months | npm stats |
| GitHub stars | 200+ within 6 months | GitHub |
| Zero known ordering bugs | 0 open bugs labeled "ordering" | GitHub issues |
| CI reliability | 99.9% — sequences never break under sharding | CI pass rate |
| Config generation speed | <10ms for 50-sequence configs | Benchmark tests |
| Community adoption | 5+ blog posts / conference mentions | Google search |

---

## 12. Open Questions

1. **Should we support dynamic sequence generation?** E.g., a function that receives the test file list and returns sequences based on tags or conventions. → Deferred to v1.1.

2. **Should we support sequence-level `beforeAll`/`afterAll`?** E.g., run a setup step before the entire sequence. → Can be achieved with Playwright's project-level setup. Document as a pattern, don't build custom support.

3. **Should we publish `@playwright-ordertest/reporter` as a separate package?** → Start as subpath export (`@playwright-ordertest/core/reporter`), split to separate package if it grows significantly.

4. **Should we support Playwright's `--last-failed` flag?** → Research needed on how `--last-failed` interacts with project dependencies. Likely works out of the box since we use native PW projects.

---

## Appendix A: Competitive Analysis

| Solution | Approach | Limitations |
|----------|----------|-------------|
| Manual project deps | User writes chained projects in config | Tedious, error-prone, breaks with sharding |
| Single-file serial | `test.describe.configure({ mode: 'serial' })` in one file | Destroys modularity, doesn't work across files |
| `workers: 1` globally | Forces entire suite to serialize | Kills parallelism for ALL tests, not just ordered ones |
| Alphabetical naming | Prefix files with `01-`, `02-`, etc. | Fragile, only works with `workers: 1`, no test-level control |
| **@playwright-ordertest/core** | Config transformer + project deps + shard guard | New tool, needs community adoption |

## Appendix B: Playwright Internals Reference

This section documents Playwright Test internals that the plugin relies on. These are stable behaviors but not part of the public API contract.

### B.1 Test File Discovery Order

Files are collected via `readDirAsync` with `entries.sort((a, b) => a.name.localeCompare(b.name))`. **Alphabetical within each directory.** This is stable since v1.0 and unlikely to change.

### B.2 Shard Distribution Algorithm

Tests are distributed to shards by index-based slicing of `TestGroup[]`. The order of TestGroups is deterministic (alphabetical file order, declaration order within files). Slicing is by test count, not file count.

### B.3 Worker Hash Computation

`workerHash = projectId + '-' + fixturePoolDigest + '-' + repeatEachIndex`. Two tests with different worker-scoped fixtures will never share a worker.

### B.4 Serial Suite Retry Behavior

When a serial suite has a failure, ALL tests in the suite (including already-passed ones) are retried as a group on a fresh worker. This is atomic retry.

### B.5 Project Dependency Enforcement

Project dependencies are shard-local. Each shard is an independent process. There is no cross-shard coordination for project dependencies.
