// US-01: secure login.
import { test, expect } from '@playwright/test';
import { E2E_ADMIN, E2E_EMPLOYEE } from './accounts.js';
import { login, logout } from './helpers.js';

test.describe('Login', () => {
  test('a wrong password shows an error and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMPLOYEE.email);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an employee logs in, keeps the session on refresh, and logs out', async ({ page }) => {
    await login(page, E2E_EMPLOYEE);
    const signedIn = page.getByRole('region', { name: `Signed in as ${E2E_EMPLOYEE.name}` });
    await expect(signedIn.getByText('Employee', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login$/);

    await logout(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an admin logs in and sees the admin-only Users page', async ({ page }) => {
    await login(page, E2E_ADMIN);
    const signedIn = page.getByRole('region', { name: `Signed in as ${E2E_ADMIN.name}` });
    await expect(signedIn.getByText('Admin', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page.getByRole('cell', { name: E2E_EMPLOYEE.email })).toBeVisible();
  });

  for (const path of ['/', '/orders', '/vendors', '/users']) {
    test(`${path} redirects to /login when logged out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    });
  }
});
