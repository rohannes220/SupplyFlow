// US-03 – US-05: vendor management as an admin.
import { test, expect } from '@playwright/test';
import { E2E_ADMIN } from './accounts.js';
import { login, openPage, unique } from './helpers.js';

const vendorRows = (page) => page.getByRole('row').filter({ has: page.getByRole('cell') });

test.describe('Vendors (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E_ADMIN);
    await openPage(page, 'Vendors');
    await expect(page.getByRole('heading', { name: 'Vendors', level: 1 })).toBeVisible();
  });

  test('searches vendors by name', async ({ page }) => {
    await page.getByLabel('Search vendors').fill('highland');

    await expect(
      page.getByRole('button', { name: 'Highland Plumbing Services', exact: true }),
    ).toBeVisible();
    const rows = vendorRows(page);
    for (const name of await rows.locator('td:first-child').allTextContents()) {
      expect(name.toLowerCase()).toContain('highland');
    }

    await page.getByLabel('Search vendors').fill('no-vendor-has-this-name');
    await expect(page.getByText('No vendors found.')).toBeVisible();
  });

  test('filters to Inactive vendors', async ({ page }) => {
    await page.getByLabel('Status').selectOption('Inactive');

    const rows = vendorRows(page);
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasText: /\bActive\b/ })).toHaveCount(0);
    expect(await rows.filter({ hasText: 'Inactive' }).count()).toBe(await rows.count());
  });

  test('adds a vendor, then deactivates it', async ({ page }) => {
    const id = unique();
    const name = `E2E Supplies ${id}`;

    await page.getByRole('button', { name: '+ Add Vendor' }).click();
    const addDialog = page.getByRole('dialog', { name: 'Add vendor' });
    await addDialog.getByLabel('Name').fill(name);
    await addDialog.getByLabel('Email').fill(`e2e-${id}@example.com`);
    await addDialog.getByLabel('Phone').fill('(617) 555-0199');
    await addDialog.getByLabel('City').fill('Boston');
    await addDialog.getByLabel('State').selectOption('MA');
    await addDialog.getByRole('button', { name: 'Add vendor', exact: true }).click();
    await expect(addDialog).toBeHidden();

    await page.getByLabel('Search vendors').fill(name);
    const row = vendorRows(page).filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Active');

    await row.getByRole('button', { name: `Edit ${name}` }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit vendor' });
    await editDialog.getByLabel('Status').selectOption('Inactive');
    await editDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(editDialog).toBeHidden();
    await expect(row).toContainText('Inactive');

    await page.getByLabel('Status').selectOption('Inactive');
    await expect(vendorRows(page).filter({ hasText: name })).toHaveCount(1);
  });
});
