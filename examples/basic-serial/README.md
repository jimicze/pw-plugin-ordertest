# Basic Serial Example

The simplest `@jimicze-pw/ordertest-core` setup — a serial checkout flow.

## What This Shows

- **Serial mode**: Files run one after another in strict order
- **Dependency chain**: `auth.spec.ts` → `cart.spec.ts` → `checkout.spec.ts`
- **Single worker**: Serial mode enforces `workers: 1` automatically

## How It Works

`defineOrderedConfig` transforms the sequence into Playwright projects with dependencies:

```
ordertest:checkout-flow:0 (auth.spec.ts)
  ↓ depends on
ordertest:checkout-flow:1 (cart.spec.ts)
  ↓ depends on
ordertest:checkout-flow:2 (checkout.spec.ts)
```

## Run

```bash
npm install
npx playwright test
```
