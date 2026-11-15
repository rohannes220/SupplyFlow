// US-06 – US-09: the purchase order workflow across both roles.
import { test, expect } from '@playwright/test';
import { E2E_ADMIN, E2E_EMPLOYEE } from './accounts.js';
import { addOrder, login, logout, openPage, orderRow, setStatus, uniqueName } from './helpers.js';

// Vendor 1 is Active and vendor 7 is Inactive in data/vendors.csv (the in-memory sample data).
const ACTIVE_VENDOR_ID = 1;
const INACTIVE_VENDOR_ID = 7;

test.describe('Purchase orders', () => {
  test('employee creates and submits an order; admin approves, ships and delivers it', async ({
    page,
  }) => {
    const customerName = `Workflow ${uniqueName()}`;

    await login(page, E2E_EMPLOYEE);
    await openPage(page, 'Purchase Orders');
    const dialog = await addOrder(page, { vendorId: ACTIVE_VENDOR_ID, customerName });
    await expect(dialog).toBeHidden();
    const row = orderRow(page, customerName);
    await expect(row).toContainText('Draft');
    await expect(row).toContainText('$1,234.56');

    await setStatus(page, row, 'Pending');
    await logout(page);

    await login(page, E2E_ADMIN);
    await openPage(page, 'Purchase Orders');
    const adminRow = orderRow(page, customerName);
    await expect(adminRow).toContainText('Pending');
    for (const status of ['Approved', 'Shipped', 'Delivered']) {
      await setStatus(page, adminRow, status);
    }
    // Delivered is final: no further status changes are offered.
    await expect(adminRow.getByRole('button', { name: 'Update' })).toHaveCount(0);

    // The status filter shows it among Delivered orders.
    await page.getByLabel('Filter by status').selectOption('Delivered');
    await expect(orderRow(page, customerName)).toBeVisible();
  });

  test('an order for an inactive vendor is refused', async ({ page }) => {
    const customerName = `Inactive Vendor ${uniqueName()}`;

    await login(page, E2E_EMPLOYEE);
    await openPage(page, 'Purchase Orders');
    const dialog = await addOrder(page, { vendorId: INACTIVE_VENDOR_ID, customerName });

    await expect(dialog.getByText('Select an existing active vendor')).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(orderRow(page, customerName)).toHaveCount(0);
  });
});
