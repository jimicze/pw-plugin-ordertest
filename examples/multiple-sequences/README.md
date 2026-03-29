# Multiple Sequences Example

Two independent ordered sequences running in a single config, both against [saucedemo.com](https://www.saucedemo.com).

## What This Shows

- **Multiple sequences**: Each with its own execution mode and file ordering
- **Independent chains**: `checkout-flow` and `inventory-flow` don't block each other
- **Mixed modes**: Serial checkout + parallel inventory in one config
- **Real E2E tests**: Full saucedemo purchase flow + product browsing and sorting

## Generated Projects

```
checkout-flow (serial):
  ordertest:checkout-flow:0 (auth.spec.ts)
    ↓
  ordertest:checkout-flow:1 (cart.spec.ts)
    ↓
  ordertest:checkout-flow:2 (checkout.spec.ts)

inventory-flow (parallel):
  ordertest:inventory-flow:0 (sort-products.spec.ts)
    ↓
  ordertest:inventory-flow:1 (product-details.spec.ts)
```

The two chains run independently. `inventory-flow` does not wait for `checkout-flow` to complete.

## Demo Site

**URL**: https://www.saucedemo.com  
**Login**: `standard_user` / `secret_sauce`

## Run

```bash
npm install
npx playwright test
```
