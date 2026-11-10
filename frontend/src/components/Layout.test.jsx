import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Layout from './Layout.jsx';
import { TOKEN_STORAGE_KEY } from '../context/AuthContext.jsx';
import { adminUser, employeeUser, renderWithAuth } from '../test/authTestUtils.jsx';

const renderLayout = (user, route = '/') =>
  renderWithAuth(
    <Layout>
      <p>Page body</p>
    </Layout>,
    { user, route },
  );

beforeEach(() => localStorage.clear());

describe('Layout', () => {
  it.each([
    ['admin', adminUser, /^admin$/i],
    ['employee', employeeUser, /^employee$/i],
  ])("shows the logged-in %s's name and role", async (_label, user, role) => {
    renderLayout(user);
    const account = await screen.findByRole('region', { name: /signed in as/i });
    expect(within(account).getByText(user.name)).toBeInTheDocument();
    expect(within(account).getByText(role)).toBeInTheDocument();
  });

  it('has Purchase Orders and Vendors links in the sidebar', async () => {
    renderLayout(employeeUser);
    const nav = within(await screen.findByRole('navigation', { name: /main/i }));
    expect(nav.getByRole('link', { name: 'Purchase Orders' })).toHaveAttribute('href', '/orders');
    expect(nav.getByRole('link', { name: 'Vendors' })).toHaveAttribute('href', '/vendors');
  });

  it.each([
    ['/vendors', 'Vendors', 'Purchase Orders'],
    ['/orders', 'Purchase Orders', 'Vendors'],
    ['/', 'Purchase Orders', 'Vendors'],
  ])('marks the current section on %s', async (route, current, other) => {
    renderLayout(employeeUser, route);
    const nav = within(await screen.findByRole('navigation', { name: /main/i }));
    expect(nav.getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: other })).not.toHaveAttribute('aria-current');
  });

  it('renders the page content', async () => {
    renderLayout(adminUser);
    expect(await screen.findByText('Page body')).toBeInTheDocument();
  });

  it('logs out and returns to the login page when Logout is clicked', async () => {
    const user = userEvent.setup();
    renderLayout(adminUser);

    await user.click(await screen.findByRole('button', { name: /log ?out/i }));

    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
