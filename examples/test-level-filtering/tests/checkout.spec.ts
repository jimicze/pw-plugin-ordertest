import { test, expect } from '@playwright/test';

test('fill shipping address @smoke', async ({ page }) => {
  // Included — has @smoke tag
  expect(true).toBe(true);
});

test('select payment method @smoke', async ({ page }) => {
  // Included — has @smoke tag
  expect(true).toBe(true);
});

test('apply promo code', async ({ page }) => {
  // EXCLUDED — no @smoke tag
  expect(true).toBe(true);
});

test('gift wrapping option', async ({ page }) => {
  // EXCLUDED — no @smoke tag
  expect(true).toBe(true);
});
