// US-02: role-based access. Employees don't see admin-only controls.
import { test, expect } from '@playwright/test';
import { E2E_ADMIN, E2E_EMPLOYEE } from './accounts.js';
import {
  addOrder,
  login,
  logout,
  openPage,
  orderRow,
  setStatus,
  statusOptions,
  uniqueName,
} from './helpers.js';

test.describe('Employee role', () => {
  test('sees no Add Vendor or Edit vendor buttons and no Users link', async ({ page }) => {
    await login(page, E2E_EMPLOYEE);
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);

    await openPage(page, 'Vendors');
    await expect(
      page.getByRole('button', { name: 'Highland Plumbing Services', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Vendor' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  });

  test('is offered only non-admin statuses for their own order', async ({ page }) => {
    const customerName = `Role Check ${uniqueName()}`;
    await login(page, E2E_EMPLOYEE);
    await openPage(page, 'Purchase Orders');
    await addOrder(page, { vendorId: 1, customerName });
    const row = orderRow(page, customerName);
    await expect(row).toContainText('Draft');

    let { dialog, options } = await statusOptions(page, row);
    expect(options).toEqual(['Pending', 'Cancelled']);
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await setStatus(page, row, 'Pending');
    ({ dialog, options } = await statusOptions(page, row));
    expect(options).toEqual(['Cancelled']);
    for (const adminOnly of ['Approved', 'Shipped', 'Delivered']) {
      expect(options).not.toContain(adminOnly);
    }
  });

  test("has no status, edit or delete controls on someone else's order", async ({ page }) => {
    const customerName = `Admin Owned ${uniqueName()}`;
    await login(page, E2E_ADMIN);
    await openPage(page, 'Purchase Orders');
    await addOrder(page, { vendorId: 1, customerName });
    await expect(orderRow(page, customerName)).toContainText('Draft');
    await logout(page);

    await login(page, E2E_EMPLOYEE);
    await openPage(page, 'Purchase Orders');
    const row = orderRow(page, customerName);
    await expect(row).toContainText('Draft');
    for (const name of ['Update', 'Edit', 'Delete']) {
      await expect(row.getByRole('button', { name })).toHaveCount(0);
    }
  });
});
