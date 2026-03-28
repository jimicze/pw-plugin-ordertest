# Multiple Sequences Example

Two independent ordered sequences running in a single config.

## What This Shows

- **Multiple sequences**: Each with its own execution mode and file ordering
- **Independent chains**: `checkout-flow` and `profile-flow` don't block each other
- **Mixed modes**: Serial checkout + parallel profile in one config

## Generated Projects

```
checkout-flow (serial):
  ordertest:checkout-flow:0 (auth.spec.ts)
    ↓
  ordertest:checkout-flow:1 (cart.spec.ts)
    ↓
  ordertest:checkout-flow:2 (checkout.spec.ts)

profile-flow (parallel):
  ordertest:profile-flow:0 (settings.spec.ts)
    ↓
  ordertest:profile-flow:1 (avatar.spec.ts)
```

## Run

```bash
npm install
npx playwright test
```
