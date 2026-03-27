import { test, expect } from '@playwright/test';

test('seed test database', async () => {
  // Runs first — all files that follow wait for this to complete
  expect(true).toBe(true);
});

test('configure feature flags', async () => {
  expect(true).toBe(true);
});
