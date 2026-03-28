# Migration Guide Example

Shows how to migrate from a standard Playwright `defineConfig` to `defineOrderedConfig`.

## What This Shows

- **Before**: `playwright.config.before.ts` — standard Playwright config, no ordering
- **After**: `playwright.config.ts` — migrated to `@playwright-ordertest/core`
- **Minimal changes**: Only two things change:
  1. Replace `import { defineConfig }` with `import { defineOrderedConfig }`
  2. Add `orderedTests.sequences` section

## Migration Steps

### Step 1: Install the package

```bash
npm install @playwright-ordertest/core
```

### Step 2: Update the import

```diff
- import { defineConfig } from '@playwright/test';
+ import { defineOrderedConfig } from '@playwright-ordertest/core';
```

### Step 3: Replace `defineConfig` with `defineOrderedConfig`

```diff
- export default defineConfig({
+ export default defineOrderedConfig({
    testDir: './tests',
    retries: 1,
+   orderedTests: {
+     sequences: [
+       {
+         name: 'checkout-flow',
+         mode: 'serial',
+         files: ['auth.spec.ts', 'cart.spec.ts', 'checkout.spec.ts'],
+       },
+     ],
+   },
  });
```

That's it! All standard Playwright features (reporters, retries, traces, etc.) continue to work exactly as before.

## Run

```bash
npm install
npx playwright test
```
