# Test-Level Filtering Example

Run specific tests within files using `FileSpecification` objects.

## What This Shows

- **`tests[]` filter**: Select specific tests by exact name match
- **`tags[]` filter**: Select tests by Playwright tag (e.g., `@smoke`)
- **Mixed entries**: Combine simple string paths with detailed `FileSpecification` objects

## How Filtering Works

| File | Filter | Result |
|------|--------|--------|
| `auth.spec.ts` | `tests: ['login...', 'session...']` | Only 2 of 4 tests run |
| `cart.spec.ts` | (none — string entry) | All 3 tests run |
| `checkout.spec.ts` | `tags: ['@smoke']` | Only 2 of 4 tests run |

Under the hood, the plugin generates `grep` patterns on each project to filter test titles.

## Run

```bash
npm install
npx playwright test
```
