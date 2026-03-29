# Mixed Ordered + Unordered Example

Ordered sequences coexisting with unordered tests in the same project, running against [saucedemo.com](https://www.saucedemo.com).

## What This Shows

- **Ordered tests**: `auth.spec.ts` → `cart.spec.ts` (serial checkout flow — login then add to cart)
- **Unordered tests**: `homepage.spec.ts`, `search.spec.ts` run with standard Playwright behavior (inventory browsing and product sorting)
- **Automatic routing**: Files not in any sequence go to `ordertest:unordered` project

## Generated Projects

```
ordertest:checkout-flow:0 (auth.spec.ts)      ← ordered
  ↓
ordertest:checkout-flow:1 (cart.spec.ts)       ← ordered

ordertest:unordered (homepage.spec.ts, search.spec.ts)  ← standard behavior
```

The unordered project runs `homepage.spec.ts` and `search.spec.ts` independently — they may run in parallel or in any order, since they don't depend on each other.

## Demo Site

**URL**: https://www.saucedemo.com  
**Login**: `standard_user` / `secret_sauce`

## Run

```bash
npm install
npx playwright test
```
