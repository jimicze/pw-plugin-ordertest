# Test-Level Filtering Example

Run specific tests within files using `FileSpecification` objects, against [saucedemo.com](https://www.saucedemo.com).

## What This Shows

- **`tests[]` filter**: Select specific tests by exact name match
- **`tags[]` filter**: Select tests by Playwright tag (e.g., `@smoke`)
- **Mixed entries**: Combine simple string paths with detailed `FileSpecification` objects
- **Real E2E tests**: Saucedemo login, cart, and checkout with selective test execution

## How Filtering Works

| File | Filter | Result |
|------|--------|--------|
| `auth.spec.ts` | `tests: ['login with valid credentials', 'verify inventory page loads']` | Only 2 of 4 tests run |
| `cart.spec.ts` | (none — string entry) | All 3 tests run |
| `checkout.spec.ts` | `tags: ['@smoke']` | Only 2 of 4 tests run (those with `@smoke` in their title) |

Under the hood, the plugin generates `grep` patterns on each project to filter test titles.

## Demo Site

**URL**: https://www.saucedemo.com  
**Login**: `standard_user` / `secret_sauce`

## Run

```bash
npm install
npx playwright test
```
