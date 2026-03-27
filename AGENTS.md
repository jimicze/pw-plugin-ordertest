# AGENTS.md — Coding Agent Instructions for @playwright-ordertest/core

> This file is the single source of truth for any AI coding agent (Copilot, Cursor, OpenCode, Claude, etc.)
> operating in this repository. Read it fully before making any change.

---

## Table of Contents

1. [Companion Files — MUST READ](#companion-files--must-read)
2. [Project Overview](#project-overview)
3. [Agent Orchestration — Parallel Execution Strategy](#agent-orchestration--parallel-execution-strategy)
4. [Build / Lint / Test Commands](#build--lint--test-commands)
5. [Code Style Guidelines](#code-style-guidelines)
6. [Architecture Overview](#architecture-overview)
7. [Directory Structure](#directory-structure)
8. [Dependency Rules](#dependency-rules)
9. [Error Handling Policy](#error-handling-policy)
10. [Logging Policy](#logging-policy)
11. [Testing Policy](#testing-policy)
12. [Git / Commit Conventions](#git--commit-conventions)
13. [Playwright-Specific Knowledge](#playwright-specific-knowledge)
14. [Known Gotchas](#known-gotchas)

---

## Companion Files — MUST READ

> **Agents MUST read these files at the start of every session.** They contain critical context
> that prevents repeated mistakes and ensures continuity across agent sessions.

| File | Purpose | When to Read | When to Update |
|------|---------|--------------|----------------|
| [`PRD.md`](./PRD.md) | Full product requirements (11 features, acceptance criteria, architecture) | Start of session; before implementing any feature | Only if requirements change (rare) |
| [`TASKS.md`](./TASKS.md) | 129 granular implementation tasks with estimates, priorities, and batch ordering | Before starting any implementation work | Mark tasks `[~]` when starting, `[x]` when done |
| [`PROGRESS.md`](./PROGRESS.md) | Implementation progress tracker, milestone history, verify results log | Start of session (to know where things left off) | After completing each batch; after every `pnpm verify` run |
| [`LEARNINGS.md`](./LEARNINGS.md) | Self-learning memory: bugs, workarounds, Playwright gotchas, design decisions | **Start of every session** (prevents repeating mistakes) | Immediately when encountering a non-obvious issue or workaround |

### Rules for Companion Files

1. **LEARNINGS.md is the highest-priority read.** It contains hard-won knowledge about Playwright quirks, tooling issues, and past mistakes. Skipping it risks wasting time on already-solved problems.

2. **TASKS.md is the source of truth for what to build next.** Always check which batch/task is next before starting work. Never skip ahead to a later batch.

3. **PROGRESS.md tracks history.** After completing a batch: update the batch status, add a milestone entry, and record the `pnpm verify` result.

4. **Update files in real-time.** Don't batch up updates — mark a task in TASKS.md as `[~]` the moment you start it, and `[x]` the moment you finish. This helps the next agent (or a resumed session) know exactly where things stand.

5. **Never delete entries from LEARNINGS.md.** It's append-only. Past issues remain relevant even after they're fixed — they document architectural decisions and known constraints.

---

## Project Overview

**Package**: `@playwright-ordertest/core`
**Purpose**: Playwright Test plugin that enables deterministic, user-defined test execution ordering across files and test methods. Supports `serial`, `parallel`, and `fullyParallel` execution modes while preserving order guarantees even under worker distribution and CI sharding.

**Key mechanism**: The plugin is a **config transformer** — it reads a user-defined ordered test manifest (inline or external file) and generates the correct Playwright `projects[]` array with `dependencies`, `testMatch`, `workers`, and execution mode settings. Playwright's own scheduler then enforces the ordering natively. No internal patching.

**Minimum Playwright version**: `>=1.40.0`
**Node.js**: `>=18.0.0`
**Platforms**: Linux, macOS, Windows (multi-platform CI matrix)

---

## Agent Orchestration — Parallel Execution Strategy

> **CRITICAL**: To save context windows and avoid compaction, agents MUST delegate work to sub-agents
> for parallel execution whenever tasks are independent. Never serially execute tasks that can be parallelized.

### Rules for Agent Spawning

1. **Always use sub-agents for independent tasks.** If you need to create 3 files that don't depend on each other, spawn 3 sub-agents in a single message — do NOT create them one by one.

2. **Use the Task tool aggressively.** Every file creation, every research query, every test run that doesn't depend on a prior result should be a parallel sub-agent.

3. **Batch independent operations.** Example: if implementing `serialStrategy.ts`, `parallelStrategy.ts`, and `fullyParallelStrategy.ts` — these share the same interface but are independent implementations. Spawn 3 agents simultaneously.

4. **Sequential only when truly dependent.** Only execute sequentially when output of step N is required input for step N+1. For example: `types.ts` must exist before `validator.ts` can be written (it imports the types). But `validator.ts` and `logger.ts` are independent and can be parallel.

5. **Research in parallel.** When you need to look up multiple things (e.g., "how does pino work" AND "how does zod work"), spawn parallel explore agents — never research sequentially.

6. **Sub-agent prompts must be self-contained.** Each sub-agent starts fresh. Include ALL context it needs: file paths, interfaces to implement, coding style rules, the full function signature. Never assume a sub-agent has context from the parent conversation.

7. **Prefer many small agents over few large agents.** A sub-agent that writes one file is better than one that writes five — it's faster, uses less context, and if it fails, you only retry one file.

8. **Mark todos in real-time.** After spawning parallel agents, mark each corresponding todo as `in_progress`. When an agent returns, immediately mark its todo `completed` before processing the next result.

### Dependency Graph for This Project

```
types.ts ──────────┬──────────────────────────────────────────────┐
                   │                                              │
                   ├─→ validator.ts                               │
                   ├─→ logger.ts (independent)                    │
                   ├─→ serialStrategy.ts ──┐                      │
                   ├─→ parallelStrategy.ts ─┼─→ projectGenerator.ts ─→ shardGuard.ts ─→ defineOrderedConfig.ts
                   ├─→ fullyParallelStrategy.ts ┘                 │
                   ├─→ testFilter.ts ──────────┘                  │
                   │                                              │
                   ├─→ orderedHtmlReporter.ts (independent)       │
                   ├─→ sequenceTracker.ts (independent)           │
                   └─→ customHtmlReporter.ts (independent)        │
                                                                  │
                   manifestLoader.ts ← depends on types.ts + validator.ts
                   index.ts ← depends on everything (write last)
```

**Parallel batches:**
- Batch 1: `types.ts` + `logger.ts` (no deps)
- Batch 2: `validator.ts` + `serialStrategy.ts` + `parallelStrategy.ts` + `fullyParallelStrategy.ts` + `testFilter.ts` + `orderedHtmlReporter.ts` + `sequenceTracker.ts` + `customHtmlReporter.ts` (all depend only on types.ts)
- Batch 3: `projectGenerator.ts` + `manifestLoader.ts` (depend on batch 2)
- Batch 4: `shardGuard.ts` (depends on projectGenerator)
- Batch 5: `defineOrderedConfig.ts` (depends on everything)
- Batch 6: `index.ts` (public API, depends on everything)
- Batch 7: All test files (parallel, one agent per test file)

---

## Build / Lint / Test Commands

### Primary Commands

```bash
# Install dependencies
pnpm install

# Build (ESM + CJS dual output)
pnpm build

# Type-check only (no emit)
pnpm typecheck

# Lint + Format (Biome handles both)
pnpm check              # Check lint + format (no writes)
pnpm check:fix          # Auto-fix lint + format issues

# Lint only
pnpm lint               # Check lint rules only
pnpm lint:fix           # Auto-fix lint issues

# Format only
pnpm format             # Auto-format all files
pnpm format:check       # Check format (CI — no writes)

# Run ALL tests
pnpm test

# Run a single test file
pnpm test tests/unit/serialStrategy.test.ts

# Run tests matching a pattern
pnpm test -g "serial"

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run a single test by name
pnpm test -g "should generate serial project with workers 1"

# Clean build artifacts
pnpm clean

# Full CI pipeline (clean + build + check + test)
pnpm ci:check

# Verify everything (agents MUST run this after every task)
pnpm verify             # = typecheck && check && test
```

### Under the Hood

```bash
# Build uses tsup
tsup src/index.ts --format esm,cjs --dts --clean

# Tests use Playwright Test (dogfooding)
npx playwright test

# Lint + Format uses Biome (single tool, replaces ESLint + Prettier)
biome check 'src/**/*.ts' 'tests/**/*.ts'        # lint + format check
biome check --write 'src/**/*.ts' 'tests/**/*.ts' # lint + format fix
```

### MANDATORY: Build & Test After Every Task

> **Agents MUST run `pnpm verify` (or at minimum `pnpm typecheck && pnpm check && pnpm test`)
> after completing ANY task — no exceptions.** If it fails, fix the errors before moving on.
> A task is NOT complete until `pnpm verify` passes with zero errors.

```bash
# After every file creation, edit, or refactor:
pnpm verify

# If verify fails, fix ALL errors, then re-run:
pnpm verify

# NEVER leave the codebase in a broken state between tasks.
```

---

## Code Style Guidelines

### Imports

```typescript
// 1. Node.js built-ins (with node: prefix)
import path from 'node:path';
import fs from 'node:fs/promises';

// 2. External packages
import { z } from 'zod';
import pino from 'pino';

// 3. Internal absolute imports (from src root)
import { OrderedTestConfig } from '../config/types.js';
import { logger } from '../logger/logger.js';

// RULES:
// - Always use .js extension in import paths (ESM compatibility)
// - Always use named exports, never default exports (except Reporter classes which PW requires as default)
// - No barrel re-exports except in src/index.ts
// - No circular imports — ever. The dependency graph above prevents this.
// - Import types with `import type { ... }` when importing only types
```

### Formatting (Biome — replaces Prettier)

Biome handles both linting and formatting in a single tool. Configuration lives in `biome.json`.

```
- lineWidth: 100
- indentStyle: 'space'
- indentWidth: 2
- quoteStyle: 'single'
- trailingCommas: 'all'
- semicolons: 'always'
- bracketSpacing: true
- arrowParentheses: 'always'
- lineEnding: 'lf'
```

### TypeScript Strictness

```
- strict: true
- noUncheckedIndexedAccess: true
- noImplicitReturns: true
- noFallthroughCasesInSwitch: true
- exactOptionalPropertyTypes: false (too aggressive for PW types)
- All function parameters and return types MUST be explicitly typed
- No `any` — use `unknown` and narrow. If truly unavoidable, add // biome-ignore lint: with justification
- No type assertions (`as`) unless interfacing with PW internals that lack proper types — add comment explaining why
```

### Naming Conventions

```
- Files:           camelCase.ts           (e.g., serialStrategy.ts, shardGuard.ts)
- Interfaces:      PascalCase, prefix I   ONLY for disambiguation — otherwise plain PascalCase
                   (e.g., OrderedTestConfig, SequenceDefinition — NOT IOrderedTestConfig)
- Types:           PascalCase             (e.g., ExecutionMode, ShardInfo)
- Classes:         PascalCase             (e.g., OrderedHtmlReporter, ProjectGenerator)
- Functions:       camelCase              (e.g., generateProjects, detectShardConfig)
- Constants:       SCREAMING_SNAKE_CASE   (e.g., DEFAULT_LOG_DIR, MAX_SEQUENCE_DEPTH)
- Enums:           PascalCase members     (e.g., ExecutionMode.Serial)
- Private fields:  prefix with _          (e.g., _logger, _config)
- Boolean vars:    prefix is/has/should   (e.g., isSharded, hasManifest, shouldCollapse)
```

### Functions

```typescript
// All exported functions must have JSDoc with @param and @returns
// Keep functions under 50 lines. If longer, extract helpers.
// Pure functions preferred. Side effects (logging, file I/O) should be explicit in the name.
// Async functions must have explicit return type (no inferred Promise<...>).

/** Generate Playwright projects from an ordered sequence definition. */
export function generateProjectsFromSequence(
  sequence: SequenceDefinition,
  baseConfig: PlaywrightTestConfig,
  logger: Logger,
): PlaywrightProjectConfig[] {
  // ...
}
```

### Error Handling

```typescript
// ZERO tolerance for swallowed errors. Every catch must either:
// 1. Re-throw with additional context
// 2. Log at ERROR level AND return a typed error result
// 3. Handle completely and document why

// Use custom error classes for all plugin-specific errors:
export class OrderTestConfigError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(`[ordertest] Config error: ${message}`);
    this.name = 'OrderTestConfigError';
  }
}

export class OrderTestShardError extends Error { /* ... */ }
export class OrderTestManifestError extends Error { /* ... */ }

// NEVER use generic Error('something went wrong')
// ALWAYS include actionable context: what failed, what was expected, what to do
```

---

## Architecture Overview

```
User Config (playwright.config.ts or ordertest.config.ts/json/yaml)
       │
       ▼
 manifestLoader.ts  ─→  Reads + validates external manifest (if used)
       │
       ▼
 defineOrderedConfig.ts  ─→  Main entry point, merges inline + external config
       │
       ├─→ validator.ts  ─→  Zod schema validation of the ordered config
       │
       ├─→ shardGuard.ts  ─→  Detects --shard, adjusts strategy to prevent chain breakage
       │
       └─→ projectGenerator.ts  ─→  Routes to the correct strategy:
              │
              ├─→ serialStrategy.ts       ─→  Single project, workers:1, serial mode
              ├─→ parallelStrategy.ts     ─→  Chained projects with dependencies[]
              └─→ fullyParallelStrategy.ts ─→  Chained projects, fullyParallel:true per step
              │
              └─→ testFilter.ts  ─→  Generates grep patterns for test-level filtering
       │
       ▼
 Native Playwright defineConfig()  ─→  Playwright's own scheduler enforces the ordering
       │
       ▼
 orderedHtmlReporter.ts  ─→  Wraps PW HTML reporter, injects sequence metadata
 customHtmlReporter.ts   ─→  Optional standalone reporter with timeline visualization
 sequenceTracker.ts      ─→  Tracks execution progress per sequence
       │
       ▼
 logger.ts  ─→  All decisions and events logged to .ordertest/activity.log (pino, JSON)
```

---

## Directory Structure

```
src/
├── index.ts                         # Public API: exports defineOrderedConfig, types, reporters
├── config/
│   ├── types.ts                     # All TypeScript interfaces and types
│   ├── validator.ts                 # Zod schema validation
│   ├── defineOrderedConfig.ts       # Main config transformer entry point
│   ├── manifestLoader.ts            # External manifest file loader (JSON/YAML/TS)
│   └── shardGuard.ts               # Shard detection and chain protection
├── engine/
│   ├── projectGenerator.ts          # Routes sequences to strategies, assembles projects[]
│   ├── serialStrategy.ts            # Serial execution: single project, workers:1
│   ├── parallelStrategy.ts          # Parallel execution: chained projects with deps
│   ├── fullyParallelStrategy.ts     # FullyParallel: chained projects, fullyParallel per step
│   └── testFilter.ts               # Test-level grep/filter generation
├── reporter/
│   ├── orderedHtmlReporter.ts       # Default: wraps PW HTML reporter + sequence metadata
│   ├── customHtmlReporter.ts        # Optional: standalone custom HTML reporter
│   └── sequenceTracker.ts          # Tracks per-sequence execution progress
├── logger/
│   └── logger.ts                    # Pino-based persistent structured logger
└── errors/
    └── errors.ts                    # Custom error classes (OrderTestConfigError, etc.)

tests/
├── unit/
│   ├── validator.test.ts
│   ├── serialStrategy.test.ts
│   ├── parallelStrategy.test.ts
│   ├── fullyParallelStrategy.test.ts
│   ├── testFilter.test.ts
│   ├── shardGuard.test.ts
│   ├── projectGenerator.test.ts
│   ├── manifestLoader.test.ts
│   └── logger.test.ts
├── integration/
│   ├── serial-execution.test.ts
│   ├── parallel-execution.test.ts
│   ├── fullyParallel-execution.test.ts
│   ├── shard-safety.test.ts
│   └── reporter.test.ts
└── fixtures/
    ├── sample-specs/                # .spec.ts files used by integration tests
    ├── manifests/                   # Sample manifest files (JSON, YAML, TS)
    └── configs/                     # Sample playwright configs for integration tests

examples/
├── serial-flow/
├── parallel-steps/
└── sharded-ci/
```

---

## Dependency Rules

### External Dependencies (production)

| Package | Purpose | Justification |
|---------|---------|---------------|
| `zod` | Config validation | Type-safe schema validation with excellent error messages |
| `pino` | Structured logging | Fast, JSON-native, file transport built-in |
| `yaml` | YAML manifest parsing | Support YAML config files |

### Peer Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `@playwright/test` | `>=1.40.0` | Core dependency — must be user-installed |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `tsup` | Build (ESM + CJS dual output) |
| `typescript` | Type checking |
| `@biomejs/biome` | Linting + formatting (single tool, replaces ESLint + Prettier) |
| `@playwright/test` | Testing (dogfood) |

### Rules

- **No runtime dependency on Playwright internals.** Only import from `@playwright/test` and `@playwright/test/reporter` — never from `playwright-core/lib/...` or similar internal paths.
- **Minimize dependencies.** Every new dependency must be justified in a PR description.
- **No polyfills.** Node 18+ baseline means native `fs/promises`, `crypto`, `structuredClone`, etc.

---

## Error Handling Policy

### Zero Errors Tolerance

**There must be ZERO errors in the codebase at all times** — no TypeScript errors, no Biome errors, no test failures, no runtime errors. This applies to:

- Pre-existing errors: fix them immediately
- New errors: never introduce them
- Warnings: Biome strict mode treats all diagnostics as errors

### Validation Strategy

```
1. Config validation (zod): Validate ALL user input at the entry point (defineOrderedConfig / manifestLoader).
   Fail fast with clear error messages that tell the user exactly what's wrong and how to fix it.

2. Runtime guards: Every function that receives external data must validate it.
   Use zod .parse() or manual checks — never trust upstream callers.

3. Type narrowing: Prefer exhaustive switch/case with `never` default over if/else chains.
   This catches missing cases at compile time.

4. Async error boundaries: Every async function must have a top-level try/catch
   that logs the error and re-throws with context. Never let an unhandled promise rejection escape.
```

---

## Logging Policy

### Persistent Activity Logging

**Every significant action must be logged.** The plugin writes structured JSON logs to `.ordertest/activity.log` using pino.

```typescript
// What to log (level: info)
logger.info({ sequence: 'checkout-flow', mode: 'serial', files: 3 }, 'Generating projects for sequence');
logger.info({ project: 'step-1', testMatch: 'auth.spec.ts' }, 'Created project');
logger.info({ shard: '2/5', strategy: 'collapse-to-serial' }, 'Shard detected, collapsing parallel to serial');

// What to log (level: debug)
logger.debug({ projectsArray: [...] }, 'Final generated projects config');
logger.debug({ grep: '/^login test$/' }, 'Applied test-level filter');

// What to log (level: warn)
logger.warn({ file: 'missing.spec.ts' }, 'File in manifest not found on disk — skipping');
logger.warn({ shard: true, mode: 'parallel' }, 'Parallel sequences collapsed to serial under sharding');

// What to log (level: error)
logger.error({ err, config }, 'Config validation failed');
logger.error({ err, file }, 'Manifest file could not be loaded');

// Reporter events (level: info)
logger.info({ test: 'login ok', sequence: 'checkout-flow', position: '1/3' }, 'Test started');
logger.info({ test: 'login ok', status: 'passed', duration: 1234 }, 'Test completed');
```

### Log Location and Rotation

- Default log directory: `.ordertest/` (relative to project root)
- Log file: `.ordertest/activity.log`
- Rotation: configurable, default 10MB max file size, keep 5 rotated files
- Log level: configurable via `ORDERTEST_LOG_LEVEL` env var (default: `info`)
- In CI: also emit to stdout if `ORDERTEST_LOG_STDOUT=true`

### Debug Console Output

In addition to pino file logging, the plugin supports verbose console debug output to stderr.

**Activation** (any of these):
- `ORDERTEST_DEBUG=true` env var
- `orderedTests.debug: true` in config
- `logLevel: 'debug'` (implicitly enables console output)

**Rules for debug output**:
- Use `process.stderr.write()` — NEVER stdout (Playwright owns stdout)
- Prefix every line with `[ordertest:debug]`
- Human-readable indented text, NOT JSON
- Every module must emit debug output at key decision points
- Include timing for config transformation

```typescript
// Debug console helper (in logger.ts)
function debugConsole(msg: string): void {
  if (isDebugEnabled) {
    process.stderr.write(`[ordertest:debug] ${msg}\n`);
  }
}

// Usage in every module:
debugConsole(`Sequence "${name}" (${mode}, ${files.length} files)`);
debugConsole(`  → Step ${i}: ${file} (${tests ? `grep: ${regex}` : 'all tests'})`);
debugConsole(`Shard detected: ${current}/${total} (source: ${source})`);
debugConsole(`Config transformation complete (${duration}ms)`);
```

### Internal Debug-Level Logging

**Every module must have thorough `logger.debug()` calls** at key decision points. These go to the pino log file and are also surfaced via console debug output.

| Module | Must log at debug level |
|--------|------------------------|
| `validator.ts` | Schema parsed, each field validated, defaults applied |
| `manifestLoader.ts` | Search paths tried, file found/not found, parse result |
| `serialStrategy.ts` | Each project created, deps chain, workers/mode set |
| `parallelStrategy.ts` | Each project created, deps chain, workers count |
| `fullyParallelStrategy.ts` | Each project created, fullyParallel flag set |
| `testFilter.ts` | Input test names, generated regex, escaped chars |
| `projectGenerator.ts` | Strategy routing decision, merged project list, unordered files |
| `shardGuard.ts` | Detection source checked, shard values, strategy decision, collapse details |
| `defineOrderedConfig.ts` | Entry, manifest vs inline decision, merge steps, final project count, timing |
| `orderedHtmlReporter.ts` | Sequence mapping built, metadata injected per test, summary generated |
| `sequenceTracker.ts` | Project name parsed, sequence matched, progress updated |

---

## Testing Policy

### Test Structure

```typescript
// tests/unit/serialStrategy.test.ts
import { test, expect } from '@playwright/test';
import { generateSerialProjects } from '../../src/engine/serialStrategy.js';

test.describe('serialStrategy', () => {
  test('should generate single project with workers: 1', () => {
    const result = generateSerialProjects(/* ... */);
    expect(result).toHaveLength(1);
    expect(result[0].workers).toBe(1);
  });

  test('should set testMatch to ordered file list', () => {
    // ...
  });
});
```

### Rules

- **Every exported function must have unit tests.**
- **Every user-facing feature must have integration tests.**
- Integration tests actually run `npx playwright test` on fixture configs and verify output.
- Test file naming: `<module>.test.ts` in the matching `tests/unit/` or `tests/integration/` dir.
- No test should depend on another test's state (except within `test.describe.configure({ mode: 'serial' })` for integration tests that test serial behavior).
- Tests must be fast: unit tests <100ms each, integration tests <10s each.

---

## Git / Commit Conventions

### Commit Between Major Task Groups

> **Agents MUST create a git commit after completing each major task group (batch).** A "major task group"
> is a logical unit of work — e.g., all three strategy files, the config layer, the reporter layer, etc.
> This prevents losing work, makes rollbacks possible, and creates clean history.

**Commit cadence:**

```
Batch 1 (scaffold)        → commit: "build: scaffold project with tsup, biome, pw test"
Batch 2 (types + logger)  → commit: "feat(types): add core type definitions and logger"
Batch 3 (strategies)      → commit: "feat(engine): add serial, parallel, fullyParallel strategies"
Batch 4 (config layer)    → commit: "feat(config): add validator, manifest loader, shard guard"
Batch 5 (entry point)     → commit: "feat(config): add defineOrderedConfig entry point"
Batch 6 (reporters)       → commit: "feat(reporter): add ordered HTML and custom reporters"
Batch 7 (public API)      → commit: "feat: wire up public API in index.ts"
Batch 8 (tests)           → commit: "test: add unit and integration tests"
```

**Rules:**
- NEVER commit code that has TypeScript errors, Biome errors, or test failures.
- Run `pnpm verify` BEFORE every commit. If it fails, fix first.
- Each commit should leave the project in a buildable, testable state.
- If a batch is too large, split it into smaller commits — err on the side of more commits.

### Commit Message Format

```
Format: <type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, build, ci, chore
Scopes: config, engine, reporter, logger, types, tests, examples

Examples:
  feat(engine): add serial strategy project generation
  fix(config): handle missing manifest file gracefully
  test(engine): add unit tests for parallel strategy
  docs: update AGENTS.md with new logging policy
  refactor(reporter): extract sequence tracker into separate module

Rules:
- Subject line: imperative mood, no period, max 72 chars
- Body: explain WHY, not WHAT (the diff shows what)
- Breaking changes: add BREAKING CHANGE: footer
```

---

## Playwright-Specific Knowledge

### How This Plugin Works With Playwright Internals

1. **Project dependencies** (`projects[].dependencies`): Enforces strict project-level execution barriers. Project B doesn't start until ALL tests in Project A pass. This is our primary ordering mechanism.

2. **Shard behavior**: Shards slice tests by `TestGroup` index (alphabetical file order, declaration order within files). Sharding is shard-local — `dependencies` are NOT enforced across shards. Our `shardGuard` handles this by collapsing ordered sequences into atomic projects.

3. **Worker distribution**: Tests are grouped into `TestGroup`s by `(workerHash, requireFile)`. Serial mode keeps all tests in one group on one worker. The `workerHash` is based on `projectId + fixturePoolDigest + repeatEachIndex`.

4. **Serial mode retry**: If a test fails in a serial suite, ALL remaining tests skip. On retry, the ENTIRE serial suite re-runs from the beginning on a fresh worker.

5. **Reporter API**: `onBegin(config, rootSuite)` receives the full test tree (read-only). `Suite.allTests()` returns tests in declaration order. The tree is `Root → Project → File → Describe → TestCase`.

### What NOT to Do

- **Never import from `playwright-core/lib/...`** — these are private internals that change without notice.
- **Never try to mutate the Suite tree in onBegin** — it's read-only after test discovery.
- **Never rely on `PWTEST_*` env vars** — these are internal test-only flags.
- **Never hardcode browser names** — use project configs, not string matching.

---

## Known Gotchas

1. **Config is evaluated multiple times.** `playwright.config.ts` runs once per worker spawn. Our config transformer must be deterministic and idempotent — same input always produces same output. No random values, no timestamps in config generation.

2. **`testMatch` resolves against `testDir`.** When generating `testMatch` patterns, always resolve paths relative to the project's `testDir`, not the config file location.

3. **`grep` on a project filters test titles**, not file names. Use `testMatch` for file-level filtering and `grep` for test-level filtering within a file.

4. **Sharding splits TestGroups, not projects.** A project with many files may be split across shards. Only `workers: 1` + all files in one project guarantees single-shard execution.

5. **`fullyParallel` changes sharding granularity.** Without it: one TestGroup per file. With it: one TestGroup per test. This means fullyParallel sequences may be split across shards at the test level.

6. **ESM + CJS dual publishing.** Our `tsup` config outputs both formats. Always use `.js` extensions in imports (not `.ts`). The `exports` field in `package.json` handles format resolution.

7. **Pino in workers.** Each Playwright worker is a separate process. The logger must handle concurrent writes to the same log file safely. Pino's file transport handles this via `pino.destination({ sync: false })` with atomic writes.

---

## Quick Reference: Common Agent Tasks

```bash
# "Add a new strategy"
# 1. Add the interface to src/config/types.ts
# 2. Create src/engine/newStrategy.ts implementing the interface
# 3. Register it in src/engine/projectGenerator.ts
# 4. Add unit tests in tests/unit/newStrategy.test.ts
# 5. Run: pnpm typecheck && pnpm lint && pnpm test

# "Add a new config option"
# 1. Add the field to the interface in src/config/types.ts
# 2. Add the zod schema field in src/config/validator.ts
# 3. Handle it in src/config/defineOrderedConfig.ts
# 4. Add tests
# 5. Run: pnpm typecheck && pnpm lint && pnpm test

# "Fix a type error"
# 1. Run: pnpm typecheck 2>&1 | head -50
# 2. Fix the error
# 3. Run: pnpm typecheck  (must show 0 errors)

# "Run only the test I'm working on"
# pnpm test tests/unit/myFile.test.ts
# pnpm test -g "my specific test name"

# "Verify everything before commit"
# pnpm verify
```
