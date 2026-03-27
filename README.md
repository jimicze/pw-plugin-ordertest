# @playwright-ordertest/core

A Playwright Test plugin that enforces deterministic, user-defined test execution ordering across files and test methods. Uses Playwright's native project dependency mechanism — no monkey-patching.

[![npm version](https://img.shields.io/npm/v/@playwright-ordertest/core)](https://www.npmjs.com/package/@playwright-ordertest/core)
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
pnpm add -D @playwright-ordertest/core
```

```typescript
// playwright.config.ts
import { defineOrderedConfig } from '@playwright-ordertest/core';

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
import { defineOrderedConfig } from '@playwright-ordertest/core';

export default defineOrderedConfig({
  testDir: './tests',
  orderedTests: { /* OrderedTestPluginConfig */ },
  // ...any other Playwright config options
});
```

### `defineOrderedConfigAsync(config)`

Async entry point. Required when loading an external manifest file.

```typescript
import { defineOrderedConfigAsync } from '@playwright-ordertest/core';

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

When Playwright shards are detected, ordered sequences need special handling because `projects[].dependencies` are **not enforced across shards**.

| Strategy | Behavior |
|----------|----------|
| `collapse` (default) | Merges the chain into a single atomic project — the whole sequence lands on one shard |
| `warn` | Logs a warning and keeps the config unchanged (ordering may break) |
| `fail` | Throws `OrderTestShardError` — use this to enforce that sharding is never used with ordered sequences |

**Important**: Set the `PLAYWRIGHT_SHARD` environment variable in addition to `--shard` when running in CI. Worker processes do not receive `--shard` in their argv, so shard detection requires the env var.

```yaml
# GitHub Actions example
- run: npx playwright test --shard=${{ matrix.shard }}/4
  env:
    PLAYWRIGHT_SHARD: ${{ matrix.shard }}/4
```

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

## Logging

The plugin writes structured JSON logs to `.ordertest/activity.log` via pino.

| Env var | Description |
|---------|-------------|
| `ORDERTEST_LOG_LEVEL` | Override log level (`silent`, `error`, `warn`, `info`, `debug`) |
| `ORDERTEST_LOG_DIR` | Override log directory |
| `ORDERTEST_LOG_STDOUT` | Set to `true` to also emit logs to stdout |
| `ORDERTEST_DEBUG` | Set to `true` to enable `[ordertest:debug]` human-readable output on stderr |

---

## Node.js & Playwright Requirements

- **Node.js**: `>=18.0.0`
- **Playwright**: `>=1.40.0` (peer dependency)

---

## License

MIT
