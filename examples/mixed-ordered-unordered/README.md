# Mixed Ordered + Unordered Example

Ordered sequences coexisting with unordered tests in the same project.

## What This Shows

- **Ordered tests**: `auth.spec.ts` → `cart.spec.ts` (serial checkout flow)
- **Unordered tests**: `homepage.spec.ts`, `search.spec.ts` run with standard Playwright behavior
- **Automatic routing**: Files not in any sequence go to `ordertest:unordered` project

## Generated Projects

```
ordertest:checkout-flow:0 (auth.spec.ts)      ← ordered
  ↓
ordertest:checkout-flow:1 (cart.spec.ts)       ← ordered

ordertest:unordered (homepage.spec.ts, search.spec.ts)  ← standard behavior
```

The unordered project uses `testMatch: '**/*'` with `testIgnore` to exclude ordered files.

## Run

```bash
npm install
npx playwright test
```
