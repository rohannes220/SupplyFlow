import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import RoleGate from './RoleGate.jsx';
import { adminUser, employeeUser, renderWithAuth } from '../test/authTestUtils.jsx';

function renderGate(user, props = { roles: ['admin'] }) {
  return renderWithAuth(
    <>
      <p>Page content</p>
      <RoleGate {...props}>
        <button type="button">Approve order</button>
      </RoleGate>
    </>,
    { user },
  );
}

beforeEach(() => localStorage.clear());

describe('RoleGate', () => {
  it('renders admin-only controls for an admin', async () => {
    renderGate(adminUser);
    expect(await screen.findByRole('button', { name: 'Approve order' })).toBeInTheDocument();
  });

  it('hides admin-only controls from an employee', async () => {
    renderWithAuth(
      <>
        <RoleGate roles={['employee']}>
          <p>Employee area</p>
        </RoleGate>
        <RoleGate roles={['admin']}>
          <button type="button">Approve order</button>
        </RoleGate>
      </>,
      { user: employeeUser },
    );
    // Proves the employee session has been restored before asserting absence.
    expect(await screen.findByText('Employee area')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve order' })).not.toBeInTheDocument();
  });

  it('hides controls when nobody is logged in', () => {
    renderGate(null);
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve order' })).not.toBeInTheDocument();
  });

  it('accepts several allowed roles', async () => {
    renderGate(employeeUser, { roles: ['admin', 'employee'] });
    expect(await screen.findByRole('button', { name: 'Approve order' })).toBeInTheDocument();
  });

  it('renders the fallback for roles that are not allowed', async () => {
    renderGate(employeeUser, { roles: ['admin'], fallback: <p>Admins only</p> });
    expect(await screen.findByText('Admins only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve order' })).not.toBeInTheDocument();
  });
});
