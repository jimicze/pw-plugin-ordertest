# External Manifest Example

Sequence definitions loaded from an external `ordertest.config.json` file, running against [saucedemo.com](https://www.saucedemo.com).

## What This Shows

- **External manifest**: Sequences defined in `ordertest.config.json`, not inline in the Playwright config
- **`defineOrderedConfigAsync`**: Async entry point required for external file loading
- **JSON Schema**: The manifest references the JSON schema for editor auto-completion
- **Auto-discovery**: If you omit `manifest:` path, the plugin auto-discovers `ordertest.config.{ts,json,yaml,yml}`
- **Real E2E tests**: Login, add to cart, and complete purchase on saucedemo.com

## Files

```
external-manifest/
├── playwright.config.ts       ← uses defineOrderedConfigAsync
├── ordertest.config.json      ← sequence definitions
└── tests/
    ├── auth.spec.ts
    ├── cart.spec.ts
    └── checkout.spec.ts
```

## Demo Site

**URL**: https://www.saucedemo.com  
**Login**: `standard_user` / `secret_sauce`

## Run

```bash
npm install
npx playwright test
```
