import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Layout from './Layout.jsx';
import { TOKEN_STORAGE_KEY } from '../context/AuthContext.jsx';
import { adminUser, employeeUser, renderWithAuth } from '../test/authTestUtils.jsx';

const renderLayout = (user) =>
  renderWithAuth(
    <Layout>
      <p>Page body</p>
    </Layout>,
    { user },
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
