# HTML Reporter Compatibility Example

Proves that Playwright's **standard HTML reporter** works perfectly with `@jimicze-pw/ordertest-core`. No custom reporter needed.

## What This Shows

- **Standard `reporter: [['html']]`** — no special reporter configuration
- **Project names in report**: Each ordered step appears as a separate project (e.g., `ordertest:checkout-flow:0`)
- **Full Playwright compatibility**: Traces, screenshots, videos all work as normal

## How It Works

`defineOrderedConfig` generates standard Playwright projects. The HTML report displays them naturally:

| Project | File | Status |
|---------|------|--------|
| `ordertest:checkout-flow:0` | auth.spec.ts | Passed |
| `ordertest:checkout-flow:1` | cart.spec.ts | Passed |
| `ordertest:checkout-flow:2` | checkout.spec.ts | Passed |

## Run

```bash
npm install
npx playwright test
npx playwright show-report
```

The HTML report opens in your browser. You'll see each ordered step as a separate project with full test details.
