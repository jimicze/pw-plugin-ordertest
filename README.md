# @jimicze-pw/ordertest-core

A Playwright Test plugin that enforces deterministic, user-defined test execution ordering across files and test methods. Uses Playwright's native project dependency mechanism — no monkey-patching.

[![npm version](https://img.shields.io/npm/v/@jimicze-pw/ordertest-core)](https://www.npmjs.com/package/@jimicze-pw/ordertest-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Playwright >=1.40.0](https://img.shields.io/badge/playwright-%3E%3D1.40.0-green)](https://playwright.dev)

---

## Why this plugin

- Playwright runs files in **alphabetical order** by default. There is no built-in way to specify custom file execution order.
- This plugin generates a Playwright `projects[]` array with `dependencies` chains, so each file waits for the previous one to complete before starting.
- Works correctly under **CI sharding** via the shard guard — ordered sequences are collapsed into an atomic project so they always land on the same shard.

---

## Quick Start

```bash
pnpm add -D @jimicze-pw/ordertest-core
```

```typescript
// playwright.config.ts
import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

export default defineOrderedConfig({
  testDir: './tests',
  orderedTests: {
    sequences: [
      {
        name: 'checkout-flow',
        mode: 'serial',
        files: ['auth.spec.ts', 'cart.spec.ts', 'checkout.spec.ts'],
      },
    ],
  },
});
```

That's it. Playwright will now run `auth.spec.ts` → `cart.spec.ts` → `checkout.spec.ts` in order. If any file fails, the chain stops.

---

## Execution Modes

| Mode | Behavior | Use case |
|------|----------|----------|
| `serial` | `workers: 1`, strict file ordering | End-to-end flows where tests share state |
| `parallel` | Default workers, file-level ordering (within-file tests are sequential) | Independent files that must run in a set order |
| `fullyParallel` | Full parallelism within each file, file-level ordering enforced | Maximum throughput with guaranteed file ordering |

---

## API Reference

### `defineOrderedConfig(config)`

Synchronous entry point. Use when all sequences are defined inline.

```typescript
import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

export default defineOrderedConfig({
  testDir: './tests',
  orderedTests: { /* OrderedTestPluginConfig */ },
  // ...any other Playwright config options
});
```

### `defineOrderedConfigAsync(config)`

Async entry point. Required when loading an external manifest file.

```typescript
import { defineOrderedConfigAsync } from '@jimicze-pw/ordertest-core';

export default defineOrderedConfigAsync({
  testDir: './tests',
  orderedTests: {
    manifest: './ordertest.config.json',
  },
});
```

### `OrderedTestPluginConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sequences` | `SequenceDefinition[]` | — | Inline sequence definitions |
| `manifest` | `string` | — | Path to external manifest file (JSON/YAML/TS) |
| `logLevel` | `'silent' \| 'error' \| 'warn' \| 'info' \| 'debug'` | `'info'` | Pino log level |
| `logDir` | `string` | `.ordertest/` | Directory for activity log |
| `logStdout` | `boolean` | `false` | Also emit logs to stdout |
| `logRotation` | `{ maxSize?: string; maxFiles?: number }` | — | Log rotation config |
| `shardStrategy` | `'collapse' \| 'warn' \| 'fail'` | `'collapse'` | Behavior when sharding is detected |
| `debug` | `boolean` | `false` | Enable `[ordertest:debug]` stderr output |

### `SequenceDefinition`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique sequence identifier |
| `mode` | `'serial' \| 'parallel' \| 'fullyParallel'` | Yes | Execution mode |
| `files` | `FileSpecification[]` | Yes | Ordered list of files |
| `workers` | `number` | No | Worker count override (ignored in serial mode) |
| `retries` | `number` | No | Retry count for all files in the sequence |
| `timeout` | `number` | No | Test timeout in ms for all files |
| `tags` | `string[]` | No | Tag filter applied to all files |
| `browser` | `string` | No | Browser project name override |

### `FileSpecification`

Either a plain file path string, or an object for per-file filtering:

```typescript
// String form
'auth.spec.ts'

// Object form — run only specific tests within the file
{ file: 'auth.spec.ts', tests: ['user logs in', 'session is active'] }

// Object form — filter by tag
{ file: 'auth.spec.ts', tags: ['@smoke'] }
```

---

## Shard Guard

When Playwright shards are detected, ordered sequences need special handling because `projects[].dependencies` are **not enforced across shards**. Each shard is an independent process — if a dependency chain is split across shards, ordering breaks silently.

| Strategy | Behavior |
|----------|----------|
| `collapse` (default) | Merges the chain into a single atomic project — the whole sequence lands on one shard |
| `warn` | Logs a warning and keeps the config unchanged (ordering may break) |
| `fail` | Throws `OrderTestShardError` — use this to enforce that sharding is never used with ordered sequences |

Set the strategy in your config:

```typescript
orderedTests: {
  shardStrategy: 'collapse',  // default — can be omitted
  sequences: [/* ... */],
}
```

### How collapse works

Without sharding, the plugin generates a chained project per file:

```
Generated projects (normal run):

  ordertest:checkout-flow:0   testMatch: [auth.spec.ts]       workers: 1
    -> depends on
  ordertest:checkout-flow:1   testMatch: [cart.spec.ts]        workers: 1
    -> depends on
  ordertest:checkout-flow:2   testMatch: [checkout.spec.ts]    workers: 1

  ordertest:unordered          testMatch: [homepage.spec.ts, search.spec.ts]
```

When sharding is detected, collapse merges the chain into one atomic project:

```
Generated projects (with --shard, after collapse):

  ordertest:checkout-flow     testMatch: [auth.spec.ts, cart.spec.ts, checkout.spec.ts]
                              workers: 1, fullyParallel: false
                              (no dependencies — single atomic unit)

  ordertest:unordered         testMatch: [homepage.spec.ts, search.spec.ts]
```

The 3-step dependency chain becomes 1 project. Playwright's shard scheduler treats it as an indivisible unit — the entire sequence lands on one shard. Unordered tests distribute across shards normally.

### Strategy + mode combinations

What happens when sharding is active, for each `shardStrategy` and `mode` combination:

| shardStrategy | serial | parallel | fullyParallel |
|---------------|--------|----------|---------------|
| `collapse` (default) | Chain merged into 1 project, `workers: 1`, `fullyParallel: false`. Entire sequence atomic on one shard. | Chain merged into 1 project, `workers: 1`, `fullyParallel: false`. Intra-file parallelism lost — forced serial for shard safety. | Chain merged into 1 project, `workers: 1`, `fullyParallel: false`. Per-test parallelism lost — forced serial for shard safety. |
| `warn` | Projects unchanged. Dependency chain may be split across shards — **ordering can break**. | Projects unchanged. Dependency chain may be split across shards — **ordering can break**. | Projects unchanged. Individual tests may scatter across shards — **ordering can break at test level**. |
| `fail` | Throws `OrderTestShardError` immediately. | Throws `OrderTestShardError` immediately. | Throws `OrderTestShardError` immediately. |

Key takeaway: `collapse` always forces `workers: 1` and `fullyParallel: false` regardless of the original mode. This is the price of shard safety — intra-file parallelism is sacrificed to guarantee the sequence is indivisible. If your CI has enough shards, the time saved from distributing unordered tests across shards typically outweighs the loss of intra-file parallelism on the ordered sequence.

### PLAYWRIGHT_SHARD environment variable

**Important**: Set the `PLAYWRIGHT_SHARD` environment variable in addition to `--shard` when running in CI. Worker processes re-evaluate `playwright.config.ts` but do **not** receive `--shard` in their `process.argv`. Without the env var, the runner and workers produce different project names, causing errors.

```yaml
# GitHub Actions CI matrix
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          PLAYWRIGHT_SHARD: ${{ matrix.shard }}/4
```

```bash
# Local sharded run
PLAYWRIGHT_SHARD=1/2 npx playwright test --shard=1/2
PLAYWRIGHT_SHARD=2/2 npx playwright test --shard=2/2
```

See the full [CI sharding example](./examples/ci-sharding/) for a complete working setup with a run script and detailed explanation.

---

## External Manifest

Move sequences out of `playwright.config.ts` into a separate file for cleaner configs.

**JSON** (`ordertest.config.json`):
```json
{
  "sequences": [
    {
      "name": "checkout-flow",
      "mode": "serial",
      "files": ["auth.spec.ts", "cart.spec.ts", "checkout.spec.ts"]
    }
  ]
}
```

**YAML** (`ordertest.config.yaml`):
```yaml
sequences:
  - name: checkout-flow
    mode: serial
    files:
      - auth.spec.ts
      - cart.spec.ts
      - checkout.spec.ts
```

**Auto-discovery**: If `orderedTests.manifest` is not set, the plugin automatically searches for `ordertest.config.{ts,json,yaml,yml}` in the project root.

```typescript
export default defineOrderedConfigAsync({
  testDir: './tests',
  orderedTests: {
    // No manifest field — auto-discovers ordertest.config.* in project root
  },
});
```

---

## Works with all Playwright reporters

`defineOrderedConfig` returns a standard Playwright config object. It works with **any** Playwright reporter — HTML, JSON, JUnit, dot, list, or custom.

```typescript
// Works perfectly with Playwright's built-in HTML reporter
export default defineOrderedConfig({
  testDir: './tests',
  reporter: [['html', { open: 'never' }]],
  orderedTests: {
    sequences: [
      { name: 'checkout', mode: 'serial', files: ['auth.spec.ts', 'cart.spec.ts'] },
    ],
  },
});
```

```typescript
// Multiple reporters — HTML + JUnit for CI
export default defineOrderedConfig({
  testDir: './tests',
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'results.xml' }],
  ],
  orderedTests: { /* ... */ },
});
```

The HTML report shows your tests organized by the generated project names (e.g., `ordertest:checkout-flow:0`, `ordertest:checkout-flow:1`) with the correct execution order. No special reporter needed.

---

## Logging

The plugin writes structured JSON logs to `.ordertest/activity.log` via pino.

---

## Environment Variables

| Env var | Description |
|---------|-------------|
| `ORDERTEST_LOG_LEVEL` | Override log level (`silent`, `error`, `warn`, `info`, `debug`) |
| `ORDERTEST_LOG_DIR` | Override log directory (default: `.ordertest/`) |
| `ORDERTEST_LOG_STDOUT` | Set to `true` to also emit logs to stdout |
| `ORDERTEST_DEBUG` | Set to `true` to enable `[ordertest:debug]` human-readable output on stderr |
| `ORDERTEST_MANIFEST` | Override manifest file path (takes priority over `orderedTests.manifest` and auto-discovery). Requires `defineOrderedConfigAsync`. |
| `ORDERTEST_SHARD_STRATEGY` | Override shard strategy (`collapse`, `warn`, `fail`). Takes priority over the `shardStrategy` config option. |
| `PLAYWRIGHT_SHARD` | Set to `current/total` (e.g., `2/5`) for reliable shard detection in worker processes. Required because `--shard` CLI args are not forwarded to workers. |

---

## Error Handling

All plugin errors extend `OrderTestError`, which provides a `context` field with structured metadata. You can catch all plugin errors with a single `instanceof OrderTestError` check, or target specific error types.

```typescript
import {
  OrderTestError,
  OrderTestConfigError,
  OrderTestValidationError,
  OrderTestShardError,
  OrderTestManifestError,
} from '@jimicze-pw/ordertest-core';

try {
  const config = defineOrderedConfig({ /* ... */ });
} catch (error) {
  if (error instanceof OrderTestConfigError) {
    console.error('Config error:', error.message);
    console.error('Context:', error.context);
    // error.context may include: { filePath, sequenceName, testDir, absolutePath }
  }
}
```

| Error class | When thrown |
|-------------|------------|
| `OrderTestError` | Base class for all plugin errors. Has `context: Record<string, unknown>`. |
| `OrderTestConfigError` | Invalid plugin configuration (e.g., missing files, conflicting options, sync API used with manifest). |
| `OrderTestValidationError` | Zod schema validation failure on config or manifest. `context` includes `zodErrors`. |
| `OrderTestShardError` | Shard strategy is `'fail'` and sharding was detected. `context` includes `shard` and `strategy`. |
| `OrderTestManifestError` | Manifest file not found, unreadable, unparseable, or has invalid content. `context` includes `filePath` and `format`. |

### File existence validation

`defineOrderedConfig` validates that every file referenced in your sequences actually exists on disk before generating projects. If a file is missing, it throws `OrderTestConfigError` with a message that includes:
- The file path
- The sequence name
- The testDir it searched in
- The resolved absolute path

```
OrderTestConfigError: File "missing.spec.ts" in sequence "checkout-flow" does not exist.
  Searched in testDir: "./tests" (resolved to: "/absolute/path/tests/missing.spec.ts")
```

---

## Advanced API

Beyond `defineOrderedConfig` and `defineOrderedConfigAsync`, the package exports lower-level utilities for building custom tooling.

### Engine

```typescript
import {
  generateProjects,
  collectOrderedFiles,
  generateUnorderedProject,
} from '@jimicze-pw/ordertest-core';
```

| Export | Description |
|--------|-------------|
| `generateProjects(sequences, logger)` | Generate Playwright project configs from sequence definitions |
| `collectOrderedFiles(sequences)` | Collect all file paths claimed by ordered sequences |
| `generateUnorderedProject(sequences, logger)` | Build a passthrough project for files not in any sequence |

### Shard Guard

```typescript
import {
  detectShardConfig,
  resolveShardStrategy,
  applyShardGuard,
} from '@jimicze-pw/ordertest-core';
```

| Export | Description |
|--------|-------------|
| `detectShardConfig(configShard?)` | Detect sharding from config and/or environment variables |
| `resolveShardStrategy(configStrategy?)` | Resolve the effective shard strategy (config + env var) |
| `applyShardGuard(options)` | Apply shard protection to generated projects |

### Test Filter

```typescript
import { buildGrepPattern, escapeRegex } from '@jimicze-pw/ordertest-core';
```

| Export | Description |
|--------|-------------|
| `buildGrepPattern(tests)` | Build a Playwright `grep` regex from test name strings |
| `escapeRegex(str)` | Escape special regex characters in a string |

### Validation

```typescript
import { validateConfig, validateManifest } from '@jimicze-pw/ordertest-core';
```

| Export | Description |
|--------|-------------|
| `validateConfig(config, logger?)` | Validate an `OrderedTestPluginConfig` object against the Zod schema |
| `validateManifest(data, logger?)` | Validate raw manifest data against the manifest Zod schema |

### Manifest Loading

```typescript
import { loadManifest, discoverManifest } from '@jimicze-pw/ordertest-core';
```

| Export | Description |
|--------|-------------|
| `loadManifest(options)` | Load and validate a manifest file (JSON/YAML/TS). Respects `ORDERTEST_MANIFEST` env var. |
| `discoverManifest(rootDir, logger?)` | Auto-discover a manifest file in a directory |

### Logger

```typescript
import {
  createLogger,
  createSilentLogger,
  debugConsole,
  isDebugEnabled,
} from '@jimicze-pw/ordertest-core';
```

| Export | Description |
|--------|-------------|
| `createLogger(options)` | Create a pino logger instance with file transport |
| `createSilentLogger()` | Create a no-op logger (for testing or suppressing output) |
| `debugConsole(msg)` | Write a `[ordertest:debug]` message to stderr (when debug is enabled) |
| `isDebugEnabled()` | Check whether debug console output is active |

### Constants

```typescript
import {
  PROJECT_NAME_PREFIX,       // 'ordertest'
  UNORDERED_PROJECT_NAME,    // 'ordertest:unordered'
  DEBUG_PREFIX,              // '[ordertest:debug]'
  DEFAULT_LOG_DIR,           // '.ordertest'
  DEFAULT_LOG_FILE,          // 'activity.log'
  DEFAULT_LOG_LEVEL,         // 'info'
  DEFAULT_LOG_MAX_SIZE,      // '10m'
  DEFAULT_LOG_MAX_FILES,     // 5
  DEFAULT_SHARD_STRATEGY,    // 'collapse'
} from '@jimicze-pw/ordertest-core';
```

### Types

All TypeScript types are exported for consumers building typed integrations:

```typescript
import type {
  ExecutionMode,
  FileEntry,
  FileSpecification,
  LogLevel,
  LogRotationConfig,
  OrderedTestManifest,
  OrderedTestPluginConfig,
  OrderTestProjectMetadata,
  SequenceDefinition,
  SequenceMetadata,
  ShardDetectionSource,
  ShardInfo,
  ShardStrategy,
  PlaywrightConfigWithOrderedTests,
  TransformedConfig,
  GeneratedProject,
  ShardGuardOptions,
  Logger,
} from '@jimicze-pw/ordertest-core';
```

---

## Migration Guide

### From standard `defineConfig` to `defineOrderedConfig`

**Before** (standard Playwright config with manual project dependencies):

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  projects: [
    {
      name: 'auth',
      testMatch: 'auth.spec.ts',
    },
    {
      name: 'cart',
      testMatch: 'cart.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'checkout',
      testMatch: 'checkout.spec.ts',
      dependencies: ['cart'],
    },
  ],
});
```

**After** (using `defineOrderedConfig`):

```typescript
// playwright.config.ts
import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';

export default defineOrderedConfig({
  testDir: './tests',
  orderedTests: {
    sequences: [
      {
        name: 'checkout-flow',
        mode: 'serial',
        files: ['auth.spec.ts', 'cart.spec.ts', 'checkout.spec.ts'],
      },
    ],
  },
});
```

### Key differences

| Aspect | Before (manual) | After (plugin) |
|--------|-----------------|----------------|
| **Ordering** | Manually chain `dependencies` | Declare file order in `files` array |
| **Adding a file** | Add project + wire up dependencies | Add one entry to `files` |
| **Shard safety** | Manual handling required | Built-in shard guard (auto-collapse) |
| **Execution mode** | Set `workers`/`fullyParallel` per project | Set `mode` once per sequence |
| **Unordered tests** | Must manually exclude ordered files | Automatic passthrough project |
| **File validation** | No validation | Files checked at config time |

### Step-by-step migration

1. **Install the plugin**:
   ```bash
   pnpm add -D @jimicze-pw/ordertest-core
   ```

2. **Replace `defineConfig` with `defineOrderedConfig`**:
   ```typescript
   // Before
   import { defineConfig } from '@playwright/test';
   export default defineConfig({ ... });

   // After
   import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';
   export default defineOrderedConfig({ ... });
   ```

3. **Move project chains into sequences**: Replace your manual `projects` array with `orderedTests.sequences`. Each chain of dependent projects becomes one sequence.

4. **Remove manual `testMatch`/`dependencies`**: The plugin generates these automatically from the `files` array.

5. **Keep unordered tests as-is**: Any test files not listed in a sequence are automatically picked up by the `ordertest:unordered` passthrough project.

6. **Add shard protection for CI**: If you use `--shard`, set the `PLAYWRIGHT_SHARD` env var:
   ```yaml
   - run: npx playwright test --shard=${{ matrix.shard }}/4
     env:
       PLAYWRIGHT_SHARD: ${{ matrix.shard }}/4
   ```

### Using an external manifest

For large test suites, move sequences out of `playwright.config.ts`:

```typescript
// playwright.config.ts
import { defineOrderedConfigAsync } from '@jimicze-pw/ordertest-core';

export default defineOrderedConfigAsync({
  testDir: './tests',
  orderedTests: {
    manifest: './ordertest.config.json',
  },
});
```

```json
// ordertest.config.json
{
  "sequences": [
    { "name": "checkout-flow", "mode": "serial", "files": ["auth.spec.ts", "cart.spec.ts", "checkout.spec.ts"] },
    { "name": "profile-flow", "mode": "parallel", "files": ["profile.spec.ts", "settings.spec.ts"] }
  ]
}
```

Or override the manifest path via environment variable:

```bash
ORDERTEST_MANIFEST=./custom-manifest.json npx playwright test
```

---

## Node.js & Playwright Requirements

- **Node.js**: `>=18.0.0`
- **Playwright**: `>=1.40.0` (peer dependency)

---

## License

MIT
