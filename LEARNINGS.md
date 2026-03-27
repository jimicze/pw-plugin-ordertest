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

---

## Testing Issues

> Issues encountered while writing or running tests.

_No entries yet._

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
