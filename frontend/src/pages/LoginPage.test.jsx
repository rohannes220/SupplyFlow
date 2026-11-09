import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import { TOKEN_STORAGE_KEY } from '../context/AuthContext.jsx';
import { adminUser, fakeAuthApi, renderWithAuth } from '../test/authTestUtils.jsx';

function renderLogin(api = fakeAuthApi(adminUser)) {
  return renderWithAuth(null, {
    api,
    route: '/login',
    routes: (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<p>Register screen</p>} />
        <Route path="/" element={<p>Dashboard home</p>} />
      </Routes>
    ),
  });
}

async function fillAndSubmit(user, { email = 'admin@supplyflow.com', password = 'secret' } = {}) {
  if (email) await user.type(screen.getByLabelText(/email/i), email);
  if (password) await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole('button', { name: /log in/i }));
}

beforeEach(() => localStorage.clear());

describe('LoginPage', () => {
  it('has labeled email and password fields and a Log in button', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
  });

  it('shows validation messages for empty fields without calling the API', async () => {
    const user = userEvent.setup();
    const { api } = renderLogin();

    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('only flags the field that is empty', async () => {
    const user = userEvent.setup();
    const { api } = renderLogin();

    await fillAndSubmit(user, { password: '' });

    expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it("shows the server's error message on 401 and stays on the page", async () => {
    const user = userEvent.setup();
    const api = fakeAuthApi(adminUser);
    api.login.mockRejectedValue(
      Object.assign(new Error('Invalid email or password'), { status: 401 }),
    );
    renderLogin(api);

    await fillAndSubmit(user, { password: 'wrong' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
    expect(screen.queryByText('Dashboard home')).not.toBeInTheDocument();
  });

  it('disables the button and shows a loading state while submitting', async () => {
    const user = userEvent.setup();
    const api = fakeAuthApi(adminUser);
    let finishLogin;
    api.login.mockReturnValue(new Promise((resolve) => (finishLogin = resolve)));
    renderLogin(api);

    await fillAndSubmit(user);

    const button = screen.getByRole('button', { name: /logging in/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(api.login).toHaveBeenCalledTimes(1);

    finishLogin({ token: 'new-token', user: adminUser });
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
  });

  it('logs in with the entered credentials and navigates to "/"', async () => {
    const user = userEvent.setup();
    const { api } = renderLogin();

    await fillAndSubmit(user);

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith('admin@supplyflow.com', 'secret');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('new-token');
  });

  it('links to the registration page', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('link', { name: /create an account/i }));
    expect(await screen.findByText('Register screen')).toBeInTheDocument();
  });
});
