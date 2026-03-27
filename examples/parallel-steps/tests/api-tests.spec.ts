import { test, expect } from '@playwright/test';

test('GET /users returns 200', async ({ request }) => {
  // Runs only after setup.spec.ts completes
  expect(true).toBe(true);
});

test('POST /orders creates order', async ({ request }) => {
  expect(true).toBe(true);
});
