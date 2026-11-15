import { expect } from '@playwright/test';

/** Logs in through the login page and waits for the dashboard. */
export async function login(page, { email, password }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
}

export async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** A short suffix that keeps names unique across tests and runs. */
export const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/**
 * A letters-only unique word, for customer names (which allow only letters, spaces, periods,
 * apostrophes and hyphens).
 */
export const uniqueName = () => unique().replace(/[0-9]/g, (digit) => 'abcdefghij'[Number(digit)]);

export async function openPage(page, linkName) {
  await page.getByRole('link', { name: linkName, exact: true }).click();
}

/** Fills and submits the Add Order form; returns the dialog for follow-up assertions. */
export async function addOrder(page, { vendorId, amount = '1234.56', customerName }) {
  await page.getByRole('button', { name: '+ Add Order' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Order' });
  await dialog.getByLabel('Vendor ID').fill(String(vendorId));
  await dialog.getByLabel('Order Amount (USD)').fill(amount);
  await dialog.getByLabel('Customer Name').fill(customerName);
  await dialog.getByLabel('Customer Phone Number').fill('(404) 555-0123');
  await dialog.getByLabel('Customer City').fill('Atlanta');
  await dialog.getByLabel('Customer State / Territory').selectOption('GA');
  await dialog.getByRole('button', { name: 'Add Order', exact: true }).click();
  return dialog;
}

/** The orders-table row for a customer name. */
export const orderRow = (page, customerName) =>
  page.getByRole('row').filter({ hasText: customerName });

/** Opens the status dialog for a row and returns the option labels it offers. */
export async function statusOptions(page, row) {
  await row.getByRole('button', { name: 'Update' }).click();
  const dialog = page.getByRole('dialog', { name: /Update Order #\d+ Status/ });
  const options = await dialog.getByLabel('Order Status').locator('option').allTextContents();
  return { dialog, options };
}

/** Moves an order to `status` through the Update dialog and waits for the table to show it. */
export async function setStatus(page, row, status) {
  const { dialog } = await statusOptions(page, row);
  await dialog.getByLabel('Order Status').selectOption(status);
  await dialog.getByRole('button', { name: 'Update Status' }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText(status);
}

/** Reads the number shown on a dashboard summary card. */
export async function metricValue(page, label) {
  const card = page.getByRole('group', { name: label });
  const value = card.locator('p').nth(1);
  // Wait for the loaded number (the card shows a placeholder while metrics load).
  await expect(value).toHaveText(/^\d[\d,]*$/);
  return Number((await value.textContent()).replace(/,/g, ''));
}
