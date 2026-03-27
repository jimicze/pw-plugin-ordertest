# TASKS.md — Implementation Task Breakdown

> Auto-generated from PRD.md. Agents: update task status as you work.
> See [PROGRESS.md](./PROGRESS.md) for history and [LEARNINGS.md](./LEARNINGS.md) for issues encountered.

**Legend**: `[ ]` = not started | `[~]` = in progress | `[x]` = done | `[-]` = cancelled/deferred

---

## Batch 0: Project Scaffolding

**Priority**: P0 | **Estimate**: 30 min | **Depends on**: nothing

| # | Task | Est. | Status |
|---|------|------|--------|
| 0.1 | Initialize pnpm project (`package.json` with name, version, exports, engines, peer deps) | 10m | `[x]` |
| 0.2 | Create `tsconfig.json` (strict mode, ESM, paths) | 5m | `[x]` |
| 0.3 | Create `tsup.config.ts` (ESM + CJS dual output, dts) | 5m | `[x]` |
| 0.4 | Create `biome.json` (lint + format config per AGENTS.md) | 5m | `[x]` |
| 0.5 | Create `playwright.config.ts` for tests (dogfood) | 5m | `[x]` |
| 0.6 | Create `.gitignore`, `.npmignore`, directory structure (`src/`, `tests/`, `examples/`) | 5m | `[x]` |
| 0.7 | Add pnpm scripts: build, typecheck, lint, format, test, verify, clean, ci:check | 5m | `[x]` |
| 0.8 | Run `pnpm install` and verify `pnpm build` produces output | 5m | `[x]` |

**Commit**: `build: scaffold project with tsup, biome, pw test`

---

## Batch 1: Core Types + Logger (No Dependencies)

**Priority**: P0 | **Estimate**: 45 min | **Depends on**: Batch 0

### 1A — `src/config/types.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 1.1 | Define `ExecutionMode` type (`'serial' \| 'parallel' \| 'fullyParallel'`) | 2m | `[x]` |
| 1.2 | Define `FileSpecification` interface (`file`, `tests?`, `tags?`) | 3m | `[x]` |
| 1.3 | Define `SequenceDefinition` interface (name, mode, files, browser?, retries?, timeout?, workers?, tags?) | 5m | `[x]` |
| 1.4 | Define `ShardStrategy` type (`'collapse' \| 'warn' \| 'fail'`) | 2m | `[x]` |
| 1.5 | Define `LogRotationConfig` interface (maxSize, maxFiles) | 2m | `[x]` |
| 1.6 | Define `OrderedTestPluginConfig` interface (sequences?, manifest?, logLevel?, logDir?, logStdout?, logRotation?, shardStrategy?) | 5m | `[x]` |
| 1.7 | Define `OrderedTestManifest` interface (for external manifest files) | 3m | `[x]` |
| 1.8 | Define `GeneratedProjectConfig` type (extends PW's project type with plugin metadata) | 5m | `[x]` |
| 1.9 | Define `ShardInfo` interface (current, total, source) | 2m | `[x]` |
| 1.10 | Define `SequenceMetadata` interface (for reporter: name, position, total, mode, isCollapsed) | 3m | `[x]` |
| 1.11 | Export all types with JSDoc comments | 3m | `[x]` |

### 1B — `src/errors/errors.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 1.12 | Create `OrderTestConfigError` class (with context field) | 3m | `[x]` |
| 1.13 | Create `OrderTestShardError` class | 3m | `[x]` |
| 1.14 | Create `OrderTestManifestError` class | 3m | `[x]` |
| 1.15 | Create `OrderTestValidationError` class (wraps Zod errors) | 3m | `[x]` |

### 1C — `src/logger/logger.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 1.16 | Create `createLogger()` factory function (accepts logLevel, logDir, logStdout) | 10m | `[x]` |
| 1.17 | Configure pino file transport to `.ordertest/activity.log` | 5m | `[x]` |
| 1.18 | Handle log rotation (maxSize, maxFiles via pino-roll or manual) | 10m | `[x]` |
| 1.19 | Support `ORDERTEST_LOG_LEVEL` and `ORDERTEST_LOG_STDOUT` env vars | 5m | `[x]` |
| 1.20 | Ensure concurrent-write safety for multi-worker environments | 5m | `[x]` |
| 1.21 | Export `Logger` type alias for the pino logger instance | 2m | `[x]` |
| 1.22 | Add `debugConsole()` helper — writes `[ordertest:debug]` prefixed lines to stderr | 5m | `[x]` |
| 1.23 | Wire debug mode activation: `ORDERTEST_DEBUG` env var, `debug: true` config, or `logLevel: 'debug'` | 5m | `[x]` |
| 1.24 | Ensure debug console output does NOT go to stdout (use stderr only) | 2m | `[x]` |

**Commit**: `feat(types): add core type definitions, errors, and logger`

---

## Batch 2: Independent Modules (Depend Only on Types)

**Priority**: P0/P1 | **Estimate**: 2h 30m | **Depends on**: Batch 1

### 2A — `src/config/validator.ts` (P0)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.1 | Create Zod schema for `FileSpecification` (string or object with file/tests/tags) | 5m | `[x]` |
| 2.2 | Create Zod schema for `SequenceDefinition` (with all fields + mode validation) | 10m | `[x]` |
| 2.3 | Create Zod schema for `OrderedTestPluginConfig` (full plugin config) | 10m | `[x]` |
| 2.4 | Create Zod schema for `OrderedTestManifest` (external manifest) | 5m | `[x]` |
| 2.5 | Add custom validations: unique sequence names, non-empty files array | 5m | `[x]` |
| 2.6 | Create `validateConfig()` function — returns validated config or throws `OrderTestValidationError` | 5m | `[x]` |
| 2.7 | Create `validateManifest()` function — same for manifest files | 5m | `[x]` |
| 2.8 | Format Zod errors into human-readable messages with paths | 5m | `[x]` |
| 2.8a | Add debug logging: schema parsed, fields validated, defaults applied | 3m | `[x]` |

### 2B — `src/engine/serialStrategy.ts` (P0)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.9 | Create `generateSerialProjects()` — one project per file, chained with dependencies | 10m | `[x]` |
| 2.10 | Set `workers: 1` on each generated project | 2m | `[x]` |
| 2.11 | Set `fullyParallel: false` on each generated project | 2m | `[x]` |
| 2.12 | Apply test-level grep filters (delegate to testFilter) | 5m | `[x]` |
| 2.13 | Generate `ordertest:<sequence>:<index>` naming | 3m | `[x]` |
| 2.14 | Propagate sequence-level overrides (retries, timeout, browser) | 5m | `[x]` |
| 2.14a | Add debug logging: each project created, deps chain, workers/mode set | 3m | `[x]` |

### 2C — `src/engine/parallelStrategy.ts` (P0)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.15 | Create `generateParallelProjects()` — one project per file, chained, default workers | 10m | `[x]` |
| 2.16 | Set `fullyParallel: false` (PW default — tests within file are sequential) | 2m | `[x]` |
| 2.17 | Allow user-configured `workers` override per sequence | 3m | `[x]` |
| 2.18 | Apply test-level grep filters | 5m | `[x]` |
| 2.19 | Propagate sequence-level overrides | 5m | `[x]` |
| 2.19a | Add debug logging: each project created, deps chain, workers count | 3m | `[x]` |

### 2D — `src/engine/fullyParallelStrategy.ts` (P0)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.20 | Create `generateFullyParallelProjects()` — one project per file, chained, fullyParallel:true | 10m | `[x]` |
| 2.21 | Set `fullyParallel: true` on each project | 2m | `[x]` |
| 2.22 | Apply test-level grep filters | 5m | `[x]` |
| 2.23 | Propagate sequence-level overrides | 5m | `[x]` |
| 2.23a | Add debug logging: each project created, fullyParallel flag set | 3m | `[x]` |

### 2E — `src/engine/testFilter.ts` (P1)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.24 | Create `buildGrepPattern()` — generates regex from test name list | 10m | `[x]` |
| 2.25 | Escape regex special characters in test names | 5m | `[x]` |
| 2.26 | Handle tag-based filtering (combine with grep) | 5m | `[x]` |
| 2.27 | Handle edge cases: empty tests array, single test, special chars | 5m | `[x]` |
| 2.27a | Add debug logging: input test names, generated regex, escaped chars | 3m | `[x]` |

### 2F — `src/reporter/sequenceTracker.ts` (P0)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.28 | Create `SequenceTracker` class — tracks which tests belong to which sequence | 10m | `[x]` |
| 2.29 | Parse project names to extract sequence info (`ordertest:<name>:<index>`) | 5m | `[x]` |
| 2.30 | Track execution progress per sequence (started, completed, pass/fail/skip counts) | 5m | `[x]` |
| 2.31 | Provide `getSequenceMetadata(testCase)` method for reporters | 5m | `[x]` |
| 2.31a | Add debug logging: project name parsed, sequence matched, progress updated | 3m | `[x]` |

### 2G — `src/reporter/orderedHtmlReporter.ts` (P0)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.32 | Create reporter class wrapping PW's HTML reporter | 15m | `[x]` |
| 2.33 | Forward all reporter events to the wrapped HTML reporter | 5m | `[x]` |
| 2.34 | Inject sequence metadata as test attachments | 10m | `[x]` |
| 2.35 | Add sequence summary at `onEnd` | 5m | `[x]` |
| 2.36 | Support reporter configuration options (passthrough + plugin-specific) | 5m | `[x]` |
| 2.37 | Handle passthrough mode (no sequences → pure PW HTML reporter) | 5m | `[x]` |
| 2.37a | Add debug logging: sequence mapping built, metadata injected per test, summary generated | 3m | `[x]` |

### 2H — `src/reporter/customHtmlReporter.ts` (P2 — deferred to v1.1)

| # | Task | Est. | Status |
|---|------|------|--------|
| 2.38 | Create standalone HTML reporter with sequence timeline (Gantt chart) | 30m | `[ ]` |
| 2.39 | Add sequence summary table | 15m | `[ ]` |
| 2.40 | Add dependency graph visualization | 20m | `[ ]` |
| 2.41 | Add shard distribution view | 15m | `[ ]` |
| 2.42 | Generate self-contained HTML (embedded CSS/JS, no external deps) | 10m | `[ ]` |

**Commit**: `feat(engine): add strategies, validator, test filter, reporters`

---

## Batch 3: Composite Modules (Depend on Batch 2)

**Priority**: P0 | **Estimate**: 1h | **Depends on**: Batch 2

### 3A — `src/engine/projectGenerator.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 3.1 | Create `generateProjects()` — routes each sequence to correct strategy by mode | 10m | `[x]` |
| 3.2 | Aggregate all generated projects across all sequences | 5m | `[x]` |
| 3.3 | Generate unordered passthrough project (`testIgnore` for all ordered files) | 10m | `[x]` |
| 3.4 | Merge with user-defined projects (preserve without modification) | 5m | `[x]` |
| 3.5 | Validate no circular dependencies in generated project graph | 5m | `[x]` |
| 3.6 | Log all generated projects at info level | 3m | `[x]` |
| 3.6a | Add debug logging: strategy routing decision, merged project list, unordered project files | 3m | `[x]` |

### 3B — `src/config/manifestLoader.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 3.7 | Create `loadManifest()` — load from explicit path or auto-discover | 10m | `[x]` |
| 3.8 | Support JSON format (via `JSON.parse`) | 3m | `[x]` |
| 3.9 | Support YAML format (via `yaml` package) | 5m | `[x]` |
| 3.10 | Support TypeScript format (via dynamic `import()`) | 10m | `[x]` |
| 3.11 | Auto-discovery: search for ordertest.config.{ts,json,yaml} in project root | 5m | `[x]` |
| 3.12 | Validate loaded manifest via `validateManifest()` | 3m | `[x]` |
| 3.13 | Log manifest loading events (found path, format, sequence count) | 3m | `[x]` |
| 3.13a | Add debug logging: search paths tried, file found/not found, parse result | 3m | `[x]` |

**Commit**: `feat(engine): add project generator and manifest loader`

---

## Batch 4: Shard Guard (Depends on Project Generator)

**Priority**: P0 | **Estimate**: 30 min | **Depends on**: Batch 3

### 4A — `src/config/shardGuard.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 4.1 | Create `detectShardConfig()` — check config.shard, process.argv, env var | 10m | `[x]` |
| 4.2 | Implement `'collapse'` strategy — merge chain into single project | 10m | `[x]` |
| 4.3 | Implement `'warn'` strategy — log warning, keep config unchanged | 3m | `[x]` |
| 4.4 | Implement `'fail'` strategy — throw `OrderTestShardError` with remediation instructions | 3m | `[x]` |
| 4.5 | Support `ORDERTEST_SHARD_STRATEGY` env var override | 3m | `[x]` |
| 4.6 | Ensure non-ordered projects are NOT affected by shard guard | 3m | `[x]` |
| 4.6a | Add debug logging: detection source checked, shard values, strategy decision, collapse details | 3m | `[x]` |

**Commit**: `feat(config): add shard guard with collapse/warn/fail strategies`

---

## Batch 5: Entry Point (Depends on Everything)

**Priority**: P0 | **Estimate**: 30 min | **Depends on**: Batch 4

### 5A — `src/config/defineOrderedConfig.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 5.1 | Create `defineOrderedConfig()` — main entry point wrapping PW's `defineConfig()` | 10m | `[x]` |
| 5.2 | Extract `orderedTests` from user config, pass remainder to PW | 5m | `[x]` |
| 5.3 | Load manifest if `orderedTests.manifest` specified or auto-discover | 5m | `[x]` |
| 5.4 | Validate config (inline takes precedence over manifest with warning) | 3m | `[x]` |
| 5.5 | Run shard guard on generated projects | 3m | `[x]` |
| 5.6 | Inject reporter config if not already configured | 3m | `[x]` |
| 5.7 | Handle passthrough mode (no sequences → return config as-is) | 3m | `[x]` |
| 5.8 | Ensure idempotency — same input always produces same output | 3m | `[x]` |
| 5.8a | Add debug logging: entry, manifest vs inline decision, merge steps, final project count, timing | 5m | `[x]` |
| 5.8b | Emit console debug summary: sequence list, generated projects, shard status, transformation time | 5m | `[x]` |

**Commit**: `feat(config): add defineOrderedConfig entry point`

---

## Batch 6: Public API

**Priority**: P0 | **Estimate**: 15 min | **Depends on**: Batch 5

### 6A — `src/index.ts`

| # | Task | Est. | Status |
|---|------|------|--------|
| 6.1 | Export `defineOrderedConfig` (main API) | 2m | `[x]` |
| 6.2 | Export all public types (OrderedTestPluginConfig, SequenceDefinition, etc.) | 3m | `[x]` |
| 6.3 | Export `OrderedTestManifest` type (for external manifest files) | 2m | `[x]` |
| 6.4 | Export reporter paths as subpath exports | 3m | `[x]` |
| 6.5 | Verify `package.json` exports field matches | 3m | `[x]` |
| 6.6 | Add package-level JSDoc comment | 2m | `[x]` |

**Commit**: `feat: wire up public API in index.ts`

---

## Batch 7: Tests (All Parallel)

**Priority**: P0 | **Estimate**: 3h | **Depends on**: Batch 6

### 7A — Unit Tests

| # | Task | Est. | Status |
|---|------|------|--------|
| 7.1 | `tests/unit/validator.test.ts` — valid configs, invalid configs, edge cases, error messages | 20m | `[x]` |
| 7.2 | `tests/unit/serialStrategy.test.ts` — project generation, workers:1, deps chain, grep filters | 20m | `[x]` |
| 7.3 | `tests/unit/parallelStrategy.test.ts` — project generation, default workers, deps chain | 20m | `[x]` |
| 7.4 | `tests/unit/fullyParallelStrategy.test.ts` — fullyParallel:true, deps chain | 20m | `[x]` |
| 7.5 | `tests/unit/testFilter.test.ts` — grep patterns, regex escaping, tags, edge cases | 15m | `[x]` |
| 7.6 | `tests/unit/shardGuard.test.ts` — detection from 3 sources, collapse/warn/fail strategies | 20m | `[x]` |
| 7.7 | `tests/unit/projectGenerator.test.ts` — routing, merging, unordered passthrough | 20m | `[x]` |
| 7.8 | `tests/unit/manifestLoader.test.ts` — JSON/YAML/TS loading, auto-discovery, errors | 20m | `[x]` |
| 7.9 | `tests/unit/logger.test.ts` — file creation, level filtering, env var overrides | 15m | `[x]` |

### 7B — Integration Tests

| # | Task | Est. | Status |
|---|------|------|--------|
| 7.10 | Create test fixtures: sample spec files, manifest files, config files | 20m | `[x]` |
| 7.11 | `tests/integration/serial-execution.test.ts` — verify ordering via execution timestamps | 25m | `[x]` |
| 7.12 | `tests/integration/parallel-execution.test.ts` — verify file order + within-file parallelism | 25m | `[x]` |
| 7.13 | `tests/integration/fullyParallel-execution.test.ts` — verify file order + full parallelism | 25m | `[x]` |
| 7.14 | `tests/integration/shard-safety.test.ts` — run with --shard, verify no chain breakage | 25m | `[x]` |
| 7.15 | `tests/integration/reporter.test.ts` — verify HTML report contains sequence metadata | 20m | `[x]` |

**Commit**: `test: add unit and integration tests`

---

## Batch 8: Documentation & Examples

**Priority**: P1 | **Estimate**: 1h | **Depends on**: Batch 7

| # | Task | Est. | Status |
|---|------|------|--------|
| 8.1 | Create `README.md` — quick start, API reference, config reference, examples | 30m | `[x]` |
| 8.2 | Create `examples/serial-flow/` — minimal serial ordering example | 10m | `[x]` |
| 8.3 | Create `examples/parallel-steps/` — parallel mode example | 10m | `[x]` |
| 8.4 | Create `examples/sharded-ci/` — CI sharding example with GitHub Actions | 10m | `[x]` |
| 8.5 | Generate JSON schema file for manifest auto-completion | 10m | `[x]` |

**Commit**: `docs: add README, examples, and JSON schema`

---

## Batch 9: CI & Release

**Priority**: P1 | **Estimate**: 45 min | **Depends on**: Batch 8

| # | Task | Est. | Status |
|---|------|------|--------|
| 9.1 | Create `.github/workflows/ci.yml` — test matrix (OS x Node x PW versions) | 15m | `[ ]` |
| 9.2 | Create `.github/workflows/release.yml` — npm publish on tag | 10m | `[ ]` |
| 9.3 | Add `CHANGELOG.md` | 5m | `[ ]` |
| 9.4 | Add `LICENSE` (MIT) | 2m | `[ ]` |
| 9.5 | Final `pnpm verify` and manual smoke test | 10m | `[ ]` |

**Commit**: `ci: add CI/CD workflows and release config`

---

## Summary

| Batch | Description | Priority | Est. | Tasks | Status |
|-------|-------------|----------|------|-------|--------|
| 0 | Project scaffolding | P0 | 30m | 8 | `[x]` |
| 1 | Types + errors + logger | P0 | 45m | 24 | `[x]` |
| 2 | Strategies, validator, filter, reporters | P0/P1/P2 | 2h30m | 50 | `[x]` |
| 3 | Project generator + manifest loader | P0 | 1h | 15 | `[x]` |
| 4 | Shard guard | P0 | 30m | 7 | `[x]` |
| 5 | Entry point (defineOrderedConfig) | P0 | 30m | 10 | `[x]` |
| 6 | Public API (index.ts) | P0 | 15m | 6 | `[x]` |
| 7 | Tests (unit + integration) | P0 | 3h | 15 | `[x]` |
| 8 | Docs & examples | P1 | 1h | 5 | `[x]` |
| 9 | CI & release | P1 | 45m | 5 | `[ ]` |
| **Total** | | | **~11h** | **145** | |

---

## Notes for Agents

1. **Always update this file** when starting (`[~]`) or completing (`[x]`) a task.
2. **Batch ordering is strict** — do not start Batch N+1 until Batch N is fully complete and verified.
3. **Within a batch**, tasks can be parallelized per the AGENTS.md dependency graph.
4. **Time estimates are for a single agent** — parallel agents reduce wall-clock time significantly.
5. **P2 tasks (Batch 2H: customHtmlReporter)** are deferred to v1.1. Skip them for v1.0.
6. **Run `pnpm verify` after every batch** before committing.
