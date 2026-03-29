# CI Sharding Example

Demonstrates how `@jimicze-pw/ordertest-core` protects ordered test sequences when running with Playwright's `--shard` flag, using [saucedemo.com](https://www.saucedemo.com).

## The Problem

Playwright distributes tests across shards by splitting TestGroups. Project `dependencies` are **not enforced across shard boundaries** -- each shard is an independent process. Without protection, an ordered sequence like:

```
ordertest:checkout-flow:0 (auth.spec.ts)
  -> depends on
ordertest:checkout-flow:1 (cart.spec.ts)
  -> depends on
ordertest:checkout-flow:2 (checkout.spec.ts)
```

...could be split across shards. Shard 1 might get steps 0 and 2, shard 2 gets step 1. The dependency chain breaks, and tests fail or run out of order.

## How Collapse Solves It

The `shardStrategy: 'collapse'` setting (the default) merges all chained projects in a sequence into a single atomic project. This guarantees the entire sequence lands on one shard.

### Without sharding (normal run)

```
npx playwright test
```

Generated projects:

```
ordertest:checkout-flow:0   testMatch: [auth.spec.ts]       workers: 1
  -> depends on
ordertest:checkout-flow:1   testMatch: [cart.spec.ts]        workers: 1
  -> depends on
ordertest:checkout-flow:2   testMatch: [checkout.spec.ts]    workers: 1

ordertest:unordered          testMatch: [homepage.spec.ts, search.spec.ts]
```

4 projects. The checkout flow is a 3-step dependency chain. Unordered tests run independently.

### With sharding + collapse

```
PLAYWRIGHT_SHARD=1/2 npx playwright test --shard=1/2
```

Generated projects after collapse:

```
ordertest:checkout-flow     testMatch: [auth.spec.ts, cart.spec.ts, checkout.spec.ts]
                            workers: 1, fullyParallel: false
                            metadata.isCollapsed: true

ordertest:unordered         testMatch: [homepage.spec.ts, search.spec.ts]
```

2 projects. The 3-step chain has been merged into a single atomic project. Playwright's shard scheduler treats it as one unit -- it cannot be split. The unordered project distributes normally across shards.

## The PLAYWRIGHT_SHARD Requirement

You **must** set the `PLAYWRIGHT_SHARD` environment variable alongside `--shard`:

```bash
PLAYWRIGHT_SHARD=1/2 npx playwright test --shard=1/2
```

Why? Playwright worker processes re-evaluate `playwright.config.ts` but do **not** receive `--shard` in their `process.argv`. Without the env var:

1. The runner process detects `--shard` from argv, collapses projects -> `ordertest:checkout-flow`
2. A worker spawns, re-evaluates the config, sees no shard -> generates un-collapsed names (`ordertest:checkout-flow:0`, `:1`, `:2`)
3. The runner can't match its collapsed project name to the worker's un-collapsed names
4. Error: `"Project not found in worker process"`

The env var is inherited by worker processes, so shard detection works consistently.

## Running This Example

### Locally with the shell script

```bash
npm install
bash run-sharded.sh
```

The script runs all shards sequentially and shows output for each.

### Locally, individual shards

```bash
# Run shard 1 of 2
PLAYWRIGHT_SHARD=1/2 npx playwright test --shard=1/2

# Run shard 2 of 2
PLAYWRIGHT_SHARD=2/2 npx playwright test --shard=2/2
```

### Without sharding (normal run)

```bash
npx playwright test
```

### GitHub Actions CI Matrix

```yaml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          PLAYWRIGHT_SHARD: ${{ matrix.shard }}/4
```

## What to Observe

- **Ordered tests stay together**: The checkout flow (auth -> cart -> checkout) always runs on a single shard. It is never split.
- **Unordered tests distribute**: `homepage.spec.ts` and `search.spec.ts` may end up on different shards -- this is normal and expected.
- **Collapse is transparent**: Standard Playwright reporters work normally. The collapsed project appears as `ordertest:checkout-flow` instead of the usual `ordertest:checkout-flow:0/1/2` step names.

## Demo Site

**URL**: https://www.saucedemo.com
**Login**: `standard_user` / `secret_sauce`
