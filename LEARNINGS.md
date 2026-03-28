# LEARNINGS.md — Self-Learning Memory

> This file captures issues, errors, bugs, workarounds, and lessons learned during development.
> Agents: READ this file at the start of every session. WRITE to it whenever you encounter a non-obvious issue.
> This prevents repeating the same mistakes across agent sessions.

---

## How to Use This File

1. **Before starting work**: Read the entire file to learn from past issues.
2. **When you hit an unexpected error**: Add an entry under the appropriate category.
3. **When you find a workaround**: Document it with the root cause and the fix.
4. **When you discover a Playwright quirk**: Add it to "Playwright Gotchas".
5. **Format**: Use the template below for consistency.

### Entry Template

```
### [Category] Short description

**Date**: YYYY-MM-DD
**Severity**: low | medium | high | critical
**Context**: What were you trying to do?
**Problem**: What went wrong?
**Root Cause**: Why did it happen?
**Fix/Workaround**: How did you resolve it?
**Prevention**: How to avoid this in the future?
```

---

## Playwright Gotchas

> Non-obvious Playwright behaviors discovered during research/implementation.

### Project dependencies are shard-local

**Date**: 2026-03-27
**Severity**: critical
**Context**: Researching how to enforce test ordering under CI sharding.
**Problem**: `projects[].dependencies` are NOT enforced across shards. Each shard is an independent process.
**Root Cause**: Playwright's shard distribution splits TestGroups across shards, and each shard runs independently with no cross-shard coordination.
**Fix/Workaround**: The `shardGuard` module detects sharding and collapses ordered chains into atomic single-project configs. This ensures the entire sequence lands on one shard.
**Prevention**: Always test ordering features with `--shard` flag. Never assume project dependencies work across shards.

### File ordering is alphabetical, not declaration order

**Date**: 2026-03-27
**Severity**: high
**Context**: Designing the serial execution strategy.
**Problem**: Playwright runs files within a project in alphabetical order (by `localeCompare`), ignoring the order in `testMatch[]`.
**Root Cause**: Playwright's test collector sorts files alphabetically via `readDirAsync` with `entries.sort()`.
**Fix/Workaround**: Use file-per-project chains with `dependencies[]` instead of relying on `testMatch` order. Each file gets its own project, and ordering is enforced via the dependency graph.
**Prevention**: Never assume file order in `testMatch` determines execution order. Always use project dependencies.

### `fullyParallel` changes shard granularity

**Date**: 2026-03-27
**Severity**: high
**Context**: Designing the fullyParallel strategy.
**Problem**: With `fullyParallel: true`, Playwright creates one TestGroup per test (not per file). This means individual tests from a single file may be split across shards.
**Root Cause**: fullyParallel changes the granularity of test distribution from file-level to test-level.
**Fix/Workaround**: Under sharding + fullyParallel, collapse to serial (single project, workers:1) to guarantee atomicity.
**Prevention**: Document this behavior clearly. Test fullyParallel sequences with `--shard`.

### Serial suite retry is atomic

**Date**: 2026-03-27
**Severity**: medium
**Context**: Designing retry behavior for serial sequences.
**Problem**: When a serial suite has a failure, ALL tests in the suite (including already-passed ones) are retried as a group on a fresh worker.
**Root Cause**: Playwright's serial mode treats the entire suite as an atomic unit. Partial retry would leave the test environment in an unknown state.
**Fix/Workaround**: Our project dependency chain naturally handles this — only the failed project retries, and if it passes, the chain continues.
**Prevention**: No action needed — this behavior aligns with our design.

### Config is evaluated per worker spawn

**Date**: 2026-03-27
**Severity**: medium
**Context**: Ensuring config transformer is safe for multi-worker environments.
**Problem**: `playwright.config.ts` is re-evaluated in each worker process.
**Root Cause**: Each worker is a separate Node.js process that `require()`s the config file independently.
**Fix/Workaround**: The config transformer must be pure and deterministic — same input always produces same output. No `Date.now()`, no `Math.random()`, no side effects (except logging, which is append-only and safe).
**Prevention**: Never put non-deterministic logic in the config transformer. Always verify idempotency in tests.

### `test.titlePath()` index 0 is the empty root suite title, NOT the project name

**Date**: 2026-03-28
**Severity**: critical
**Context**: Reporter `onTestBegin`/`onTestEnd` callbacks use `test.titlePath()` to determine which project a test belongs to, so it can be tracked against ordered sequences.
**Problem**: Both `orderedHtmlReporter.ts` and `customHtmlReporter.ts` used `titlePath()[0]` to get the project name. This returned an empty string for every test, causing all tests to be classified as "untracked". Reports showed 0 tests in all sequences, all steps marked "skipped".
**Root Cause**: `test.titlePath()` returns `['', projectName, fileName, ...describePath, testTitle]`. Index 0 is the root suite title (always empty string `''`). Index 1 is the project name.
**Fix/Workaround**: Changed `titlePath()[0]` → `titlePath()[1]` in both reporter files. Also fixed the unit test mock in `customHtmlReporter.test.ts` to return `['', projectName, ...]` matching the real Playwright API shape.
**Prevention**: Always verify reporter logic with real Playwright subprocess runs, not just unit test mocks. When mocking `titlePath()`, use the full array shape `['', projectName, fileName, ...describes, testTitle]`. Add a comment in reporter code documenting the index meaning.

---

## Build & Tooling Issues

> Issues with TypeScript, tsup, Biome, pnpm, etc.

_No entries yet._

### Biome glob patterns don't expand in pnpm scripts

**Date**: 2026-03-27
**Severity**: low
**Context**: Setting up `pnpm check` and `pnpm lint` scripts in package.json.
**Problem**: Shell glob patterns like `'src/**/*.ts'` passed as arguments to biome in pnpm scripts result in "No such file or directory" errors. Biome receives the literal string `src/**/*.ts` instead of expanded file paths.
**Root Cause**: pnpm scripts run in a shell context that doesn't expand globs inside single quotes, and biome itself doesn't expand shell-quoted globs.
**Fix/Workaround**: Use directory paths instead: `biome check src/ tests/`. Biome handles its own file discovery within directories, respecting `files.ignore` in `biome.json`.
**Prevention**: Always use directory paths (not glob patterns) in biome pnpm scripts.

### pnpm onlyBuiltDependencies for post-install scripts

**Date**: 2026-03-27
**Severity**: low
**Context**: Running `pnpm install` for the first time.
**Problem**: pnpm blocks post-install scripts for `@biomejs/biome` and `esbuild` (used by tsup). The `pnpm approve-builds` command is interactive and can't be used in non-interactive contexts.
**Fix/Workaround**: Add `"pnpm": { "onlyBuiltDependencies": ["@biomejs/biome", "esbuild"] }` to `package.json`.
**Prevention**: Always add this field when using biome and tsup/esbuild with pnpm.

### Missing @types/node causes Node.js API errors

**Date**: 2026-03-27
**Severity**: medium
**Context**: Running `pnpm typecheck` after creating `logger.ts` which uses `node:fs`, `node:path`, and `process`.
**Problem**: TypeScript errors: `Cannot find module 'node:fs'`, `Cannot find name 'process'. Do you need to install type definitions for node?`
**Root Cause**: `@types/node` was not included as a dev dependency in the scaffold. With `verbatimModuleSyntax` and `lib: ["ES2022"]`, Node.js globals and modules are not available without explicit type definitions.
**Fix/Workaround**: `pnpm add -D @types/node`.
**Prevention**: Always include `@types/node` in Node.js projects. Add to scaffold checklist.

### pino.default() does not work with verbatimModuleSyntax

**Date**: 2026-03-27
**Severity**: medium
**Context**: Creating the pino logger with `import pino from 'pino'` under `verbatimModuleSyntax`.
**Problem**: `pino.default()` — Property 'default' does not exist on type 'typeof pino'. With `verbatimModuleSyntax`, the default import `pino` IS the function, not a module object with a `.default` property.
**Fix/Workaround**: Use `pino()` directly, not `pino.default()`.
**Prevention**: With `verbatimModuleSyntax`, default imports are the value directly. Never use `.default` on a default import.

### Biome useLiteralKeys rule for process.env

**Date**: 2026-03-27
**Severity**: low
**Context**: Biome check after creating logger.ts with `process.env['ORDERTEST_LOG_LEVEL']`.
**Problem**: Biome flags bracket notation `process.env['KEY']` as `lint/complexity/useLiteralKeys` — "The computed expression can be simplified without the use of a string literal."
**Fix/Workaround**: Use dot notation: `process.env.ORDERTEST_LOG_LEVEL`. This works fine with TypeScript's `noUncheckedIndexedAccess` — the type is still `string | undefined`.
**Prevention**: Always use dot notation for env var access: `process.env.VAR_NAME` not `process.env['VAR_NAME']`.

---

## Testing Issues

> Issues encountered while writing or running tests.

### process.env.VAR = undefined sets env to the string 'undefined', not undefined

**Date**: 2026-03-27
**Severity**: high
**Context**: Writing `logger.test.ts` — clearing env vars in `beforeEach` to prevent test interference.
**Problem**: `process.env.ORDERTEST_LOG_DIR = undefined` does NOT unset the variable. In Node.js, `process.env` coerces all values to strings, so this sets `ORDERTEST_LOG_DIR` to the string `'undefined'`. When `resolveLogDir` reads it back with `process.env.ORDERTEST_LOG_DIR ?? configLogDir ?? DEFAULT_LOG_DIR`, the string `'undefined'` is truthy/non-nullish and gets returned as the log dir, causing `ensureLogDir` to try to create a directory literally named `undefined` instead of the intended path.
**Root Cause**: `process.env` in Node.js is a `Record<string, string>` at runtime — values are always coerced to strings. Setting to `undefined` coerces to `'undefined'`.
**Fix/Workaround**: Use `Reflect.deleteProperty(process.env, 'VAR_NAME')` to truly unset a variable. For restoring to a previously saved value, conditionally restore only when the saved value was not undefined:
```typescript
if (savedValue !== undefined) {
  process.env.MY_VAR = savedValue;
} else {
  Reflect.deleteProperty(process.env, 'MY_VAR');
}
```
Biome allows `Reflect.deleteProperty` (it only forbids `delete` operator).
**Prevention**: NEVER use `process.env.VAR = undefined` to clear an env var. Always use `Reflect.deleteProperty(process.env, 'VAR')`.

### Shard guard collapse causes "Project not found in worker process" error

**Date**: 2026-03-27
**Severity**: high
**Context**: Running integration test with `--shard 1/2` on serial-flow fixture config.
**Problem**: When shard guard collapses `ordertest:checkout-flow:0/1/2` into `ordertest:checkout-flow`, Playwright's runner process sees `ordertest:checkout-flow` in its project list. But when a worker process spawns, it re-evaluates `playwright.config.js`. If `process.argv` in the worker does NOT contain `--shard`, `detectShardFromArgv()` returns `undefined`, so no collapse happens — the worker generates the original un-collapsed project names `ordertest:checkout-flow:0/1/2`. The runner then can't match its `ordertest:checkout-flow` project to any worker-registered project, causing: `Error: Project "ordertest:checkout-flow" not found in the worker process`.
**Root Cause**: `playwright.config.ts` is re-evaluated per worker spawn (LEARNINGS.md gotcha #5 in Playwright docs). Worker processes don't receive `--shard` in their `argv`, so shard detection via `argv` fails, and the config produces different project names in the main process vs worker processes.
**Fix/Workaround**: For the `collapse` strategy to work correctly, shard detection must be reliable in worker processes. Options:
  1. Set the `PLAYWRIGHT_SHARD` env var explicitly (workers inherit env vars from the runner), OR
  2. Use `shard` in the playwright config object itself (workers re-evaluate the full config including the `shard` field), OR
  3. Change the collapse strategy to keep individual project names (named `ordertest:checkout-flow:0`, etc.) but merge their `testMatch` and remove `dependencies` — this way names are stable across runner/worker evaluation.
  Currently, using `--shard N/M` via CLI with `collapse` strategy is broken. Using `PLAYWRIGHT_SHARD=N/M` env var OR `config.shard: { current: N, total: M }` will work correctly because env vars and config fields are available in worker processes.
**Prevention**: Always test shard guard with `PLAYWRIGHT_SHARD` env var in integration tests, not `--shard` CLI arg. Document that `collapse` strategy requires `PLAYWRIGHT_SHARD` env var or `config.shard` for reliable worker process detection.

**Date**: 2026-03-27
**Severity**: medium
**Context**: Designing integration tests that spawn child `npx playwright test` processes.
**Problem**: Fixture `playwright.config.ts` files can't be executed by Playwright in a temp dir without a tsconfig and tsx/ts-node setup. The child process has no TS transpilation context.
**Fix/Workaround**: Write fixture playwright configs as `.js` files (ESM) that import from the built `dist/` output using the absolute path to the package root. Use `createRequire` or direct ESM import with `file://` URL for the dist entry point. Alternatively, keep fixture configs in `tests/fixtures/configs/` within the project root so they can resolve deps via the project's `node_modules`.
**Prevention**: Integration test fixtures that spawn child processes must use plain JS configs or a config within the project that can resolve deps normally.

---

## Runtime Bugs

> Bugs found during manual testing or integration testing.

_No entries yet._

---

## Design Decisions

> Important decisions and their rationale (for future reference).

### File-per-project chain over alphabetical prefix injection

**Date**: 2026-03-27
**Context**: Two options for enforcing custom file order in serial mode.
**Decision**: Use file-per-project chains with `dependencies[]` (Option A).
**Rejected**: Alphabetical prefix injection (renaming files at runtime) (Option B).
**Rationale**: Option B is too invasive — breaks source maps, confuses reporters, and requires file system manipulation. Option A uses native Playwright project dependencies, is non-invasive, and is guaranteed to enforce order.

### Biome over ESLint + Prettier

**Date**: 2026-03-27
**Context**: Choosing a linter and formatter for the project.
**Decision**: Use Biome (single tool for both linting and formatting).
**Rationale**: Faster, simpler configuration, consistent behavior, single dependency instead of ESLint + Prettier + configs + plugins.

### Dual debug output: pino file + stderr console

**Date**: 2026-03-27
**Context**: Users need to debug ordering issues locally and in CI. Pino JSON logs are great for structured analysis but hard to read in real-time.
**Decision**: Two debug channels — (1) `logger.debug()` for structured pino JSON logs to file, (2) `debugConsole()` for human-readable `[ordertest:debug]`-prefixed lines to stderr.
**Rationale**: JSON logs serve post-mortem analysis and CI artifact inspection. Console stderr output serves real-time debugging. Using stderr (not stdout) avoids interfering with Playwright's own output. Both are activated by `ORDERTEST_DEBUG=true`, `debug: true` config, or `logLevel: 'debug'`.
**Rule**: Every module must have both — `logger.debug()` calls for pino AND `debugConsole()` calls for the human-readable channel. They should emit at the same decision points but in different formats.

### Pino over Winston/Bunyan for logging

**Date**: 2026-03-27
**Context**: Choosing a logging library for persistent activity logs.
**Decision**: Use pino with file transport.
**Rationale**: Fastest JSON logger for Node.js, built-in file transport, handles concurrent writes from multiple worker processes safely, minimal overhead.

### Reporters removed — plugin is a pure config transformer

**Date**: 2026-03-28
**Context**: After implementing both `orderedHtmlReporter` and `customHtmlReporter`, user evaluation determined reporters were unnecessary.
**Decision**: Remove both reporters entirely. The plugin is now a pure config transformer.
**Rationale**: The standard Playwright HTML reporter already works perfectly with ordered test projects because project names (e.g., `ordertest:checkout-flow:0`) appear naturally in the report. Custom reporters added complexity without meaningful value. The generated project names and dependency chains give users full visibility into execution order via any standard Playwright reporter.
**Impact**: Removed `src/reporter/` directory, subpath exports, and all reporter-related types/tests. Kept `SequenceMetadata` and `OrderTestProjectMetadata` as public API types for potential custom tooling.

---

## Performance Notes

> Performance-related observations and optimizations.

_No entries yet._

---

## Notes for Agents

1. **READ this file at the start of every session** — it may save you hours of debugging.
2. **Add entries immediately** when you encounter a non-obvious issue — don't wait until later.
3. **Be specific** — include error messages, stack traces, config snippets if relevant.
4. **Include the fix** — future agents need the solution, not just the problem.
5. **Categorize correctly** — use the right section for the type of issue.
