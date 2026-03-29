# HTML Reporter Compatibility Example

Proves that Playwright's **standard HTML reporter** works perfectly with `@jimicze-pw/ordertest-core`, using [saucedemo.com](https://www.saucedemo.com) as the demo site. No custom reporter needed.

## What This Shows

- **Standard `reporter: [['html']]`** — no special reporter configuration
- **Project names in report**: Each ordered step appears as a separate project (e.g., `ordertest:checkout-flow:0`)
- **Full Playwright compatibility**: Traces, screenshots, videos all work as normal
- **Real E2E tests**: Login, cart, and checkout on saucedemo.com

## How It Works

`defineOrderedConfig` generates standard Playwright projects. The HTML report displays them naturally:

| Project | File | Status |
|---------|------|--------|
| `ordertest:checkout-flow:0` | auth.spec.ts | Passed |
| `ordertest:checkout-flow:1` | cart.spec.ts | Passed |
| `ordertest:checkout-flow:2` | checkout.spec.ts | Passed |

## Demo Site

**URL**: https://www.saucedemo.com  
**Login**: `standard_user` / `secret_sauce`

## Run

```bash
npm install
npx playwright test
npx playwright show-report
```

The HTML report opens in your browser. You'll see each ordered step as a separate project with full test details.
