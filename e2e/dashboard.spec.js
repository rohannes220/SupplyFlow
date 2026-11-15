// US-10: dashboard metrics reflect order changes.
import { test, expect } from '@playwright/test';
import { E2E_ADMIN } from './accounts.js';
import { login, metricValue, openPage, setStatus } from './helpers.js';

test('the Pending Orders count drops after an admin approves a pending order', async ({ page }) => {
  await login(page, E2E_ADMIN);
  const pendingBefore = await metricValue(page, 'Pending Orders');
  expect(pendingBefore).toBeGreaterThan(0);

  // Approve the first Pending order. No status filter: a filtered table would hide the row as
  // soon as it becomes Approved.
  await openPage(page, 'Purchase Orders');
  const firstPending = page
    .getByRole('row')
    .filter({ hasText: 'Pending' })
    .filter({ has: page.getByRole('button', { name: 'Update' }) })
    .first();
  const orderNumber = (await firstPending.getByRole('cell').first().textContent()).trim();
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: orderNumber, exact: true }) });
  await setStatus(page, row, 'Approved');

  await openPage(page, 'Dashboard');
  await expect.poll(() => metricValue(page, 'Pending Orders')).toBe(pendingBefore - 1);
});
