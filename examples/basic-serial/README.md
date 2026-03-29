# Basic Serial Example

The simplest `@jimicze-pw/ordertest-core` setup — a serial checkout flow against [saucedemo.com](https://www.saucedemo.com).

## What This Shows

- **Serial mode**: Files run one after another in strict order
- **Dependency chain**: `auth.spec.ts` → `cart.spec.ts` → `checkout.spec.ts`
- **Single worker**: Serial mode enforces `workers: 1` automatically
- **Real E2E tests**: Login, add to cart, and complete purchase on saucedemo.com

## How It Works

`defineOrderedConfig` transforms the sequence into Playwright projects with dependencies:

```
ordertest:checkout-flow:0 (auth.spec.ts)
  ↓ depends on
ordertest:checkout-flow:1 (cart.spec.ts)
  ↓ depends on
ordertest:checkout-flow:2 (checkout.spec.ts)
```

If `auth.spec.ts` fails (e.g. login is broken), Playwright will skip `cart.spec.ts` and `checkout.spec.ts`.
This is the key value of ordering — failures cascade correctly.

## Demo Site

**URL**: https://www.saucedemo.com  
**Login**: `standard_user` / `secret_sauce`

## Run

```bash
npm install
npx playwright test
```
