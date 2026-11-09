import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import RegisterPage from './RegisterPage.jsx';
import { TOKEN_STORAGE_KEY } from '../context/AuthContext.jsx';
import { employeeUser, fakeAuthApi, renderWithAuth } from '../test/authTestUtils.jsx';

function renderRegister(api = fakeAuthApi(employeeUser)) {
  return renderWithAuth(null, {
    api,
    route: '/register',
    routes: (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<p>Login screen</p>} />
        <Route path="/" element={<p>Dashboard home</p>} />
      </Routes>
    ),
  });
}

async function fill(
  user,
  { name = 'Eli Employee', email = 'eli@example.com', password = 'Str0ng#Pass' } = {},
) {
  if (name) await user.type(screen.getByLabelText(/name/i), name);
  if (email) await user.type(screen.getByLabelText(/email/i), email);
  if (password) await user.type(screen.getByLabelText(/^password/i), password);
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

beforeEach(() => localStorage.clear());

describe('RegisterPage', () => {
  it('has name, email and password fields and a Create account button', () => {
    renderRegister();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });

  it('validates fields without calling the API', async () => {
    const user = userEvent.setup();
    const { api } = renderRegister();

    await fill(user, { name: '', email: 'nope', password: 'short' });

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('registers, stores the session and goes to the main page', async () => {
    const user = userEvent.setup();
    const { api } = renderRegister();

    await fill(user);

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
    expect(api.register).toHaveBeenCalledWith('Eli Employee', 'eli@example.com', 'Str0ng#Pass');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('new-token');
  });

  it("shows the server's error (e.g. duplicate email) and stays on the page", async () => {
    const user = userEvent.setup();
    const api = fakeAuthApi(employeeUser);
    api.register.mockRejectedValue(
      Object.assign(new Error('An account with this email already exists'), { status: 409 }),
    );
    renderRegister(api);

    await fill(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.queryByText('Dashboard home')).not.toBeInTheDocument();
  });

  it('links back to the login page', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('link', { name: /log in/i }));
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });
});
