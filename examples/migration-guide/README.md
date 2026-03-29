# Migration Guide Example

Shows how to migrate from a standard Playwright `defineConfig` to `defineOrderedConfig`, using [saucedemo.com](https://www.saucedemo.com) as the demo site.

## What This Shows

- **Before**: `playwright.config.before.ts` — standard Playwright config, no ordering
- **After**: `playwright.config.ts` — migrated to `@jimicze-pw/ordertest-core`
- **Minimal changes**: Only two things change:
  1. Replace `import { defineConfig }` with `import { defineOrderedConfig }`
  2. Add `orderedTests.sequences` section

## Migration Steps

### Step 1: Install the package

```bash
npm install @jimicze-pw/ordertest-core
```

### Step 2: Update the import

```diff
- import { defineConfig } from '@playwright/test';
+ import { defineOrderedConfig } from '@jimicze-pw/ordertest-core';
```

### Step 3: Replace `defineConfig` with `defineOrderedConfig`

```diff
- export default defineConfig({
+ export default defineOrderedConfig({
    testDir: './tests',
    retries: 1,
    use: {
      baseURL: 'https://www.saucedemo.com',
    },
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

That's it! All standard Playwright features (reporters, retries, traces, `baseURL`, etc.) continue to work exactly as before.

## Demo Site

**URL**: https://www.saucedemo.com  
**Login**: `standard_user` / `secret_sauce`

## Run

```bash
npm install
npx playwright test
```
