import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VendorsPage from './VendorsPage.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { ApiError } from '../services/orderApi.js';
import { adminUser, employeeUser, renderWithAuth } from '../test/authTestUtils.jsx';

const VENDORS = [
  {
    id: 1,
    name: 'Global Parts Co.',
    email: 'sarah@globalparts.example',
    phone: '4045550142',
    city: 'Atlanta',
    state: 'GA',
    status: 'Active',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Tech Supply LLC',
    email: 'mike@techsupply.example',
    phone: '5125550187',
    city: 'Austin',
    state: 'TX',
    status: 'Active',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Industrial Hub',
    email: 'lisa@industrialhub.example',
    phone: '3125550119',
    city: 'Chicago',
    state: 'IL',
    status: 'Inactive',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
];

/** Fake vendorApi that filters like the real API (name search ignores case; exact status). */
function fakeApi(vendors = VENDORS) {
  let rows = vendors.map((v) => ({ ...v }));
  return {
    listVendors: vi.fn(async ({ search, status } = {}) =>
      rows
        .filter(
          (v) => !search?.trim() || v.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .filter((v) => !status || v.status === status),
    ),
    getVendor: vi.fn(async (id) => rows.find((v) => v.id === id)),
    createVendor: vi.fn(async (input) => {
      const created = { id: 4, createdAt: '2026-11-09T00:00:00.000Z', ...input };
      rows = [...rows, created];
      return created;
    }),
    updateVendor: vi.fn(async (id, input) => {
      rows = rows.map((v) => (v.id === id ? { ...v, ...input } : v));
      return rows.find((v) => v.id === id);
    }),
  };
}

function renderAs(user, api = fakeApi()) {
  renderWithAuth(
    <ProtectedRoute>
      <VendorsPage api={api} />
    </ProtectedRoute>,
    { user },
  );
  return api;
}

const table = async () => within(await screen.findByRole('table'));
const rowFor = async (name) => within((await (await table()).findByText(name)).closest('tr'));
const visibleNames = async () =>
  (await table())
    .queryAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td')?.textContent?.trim())
    .filter(Boolean);

beforeEach(() => localStorage.clear());

describe('VendorsPage', () => {
  describe('vendor table', () => {
    it('has a Vendors heading and lists every vendor with all fields', async () => {
      renderAs(employeeUser);
      expect(await screen.findByRole('heading', { name: 'Vendors' })).toBeInTheDocument();

      const row = await rowFor('Global Parts Co.');
      expect(row.getByText('sarah@globalparts.example')).toBeInTheDocument();
      expect(row.getByText('(404) 555-0142')).toBeInTheDocument();
      expect(row.getByText('Atlanta')).toBeInTheDocument();
      expect(row.getByText('GA')).toBeInTheDocument();
      expect(row.getByText('Active')).toBeInTheDocument();
      expect((await rowFor('Industrial Hub')).getByText('Inactive')).toBeInTheDocument();
    });

    it('has column headers for name, email, phone, city, state and status', async () => {
      renderAs(employeeUser);
      const headers = (await table()).getAllByRole('columnheader').map((th) => th.textContent);
      expect(headers).toEqual(
        expect.arrayContaining(['Name', 'Email', 'Phone', 'City', 'State', 'Status']),
      );
    });

    it('shows a loading state while vendors load', async () => {
      const api = fakeApi();
      api.listVendors.mockReturnValue(new Promise(() => {}));
      renderAs(employeeUser, api);
      expect(await screen.findByText(/loading vendors/i)).toBeInTheDocument();
    });

    it('shows an empty state when no vendors match', async () => {
      renderAs(employeeUser, fakeApi([]));
      expect(await screen.findByText(/no vendors found/i)).toBeInTheDocument();
    });

    it('shows a load error', async () => {
      const api = fakeApi();
      api.listVendors.mockRejectedValue(new Error('Could not reach the server'));
      renderAs(employeeUser, api);
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
    });
  });

  describe('search and filter', () => {
    it('filters by name as the user types in the search box', async () => {
      const user = userEvent.setup();
      const api = renderAs(employeeUser);
      await rowFor('Global Parts Co.');

      await user.type(screen.getByRole('searchbox', { name: /search vendors/i }), 'TECH');

      await waitFor(async () => expect(await visibleNames()).toEqual(['Tech Supply LLC']));
      expect(api.listVendors).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'TECH' }));
    });

    it('filters by status: All, Active, Inactive', async () => {
      const user = userEvent.setup();
      const api = renderAs(employeeUser);
      await rowFor('Global Parts Co.');
      const filter = screen.getByLabelText(/^status/i);
      expect([...filter.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
        'All',
        'Active',
        'Inactive',
      ]);

      await user.selectOptions(filter, 'Inactive');
      await waitFor(async () => expect(await visibleNames()).toEqual(['Industrial Hub']));
      expect(api.listVendors).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'Inactive' }),
      );

      await user.selectOptions(filter, 'All');
      await waitFor(async () => expect(await visibleNames()).toHaveLength(3));
    });

    it('combines search and status', async () => {
      const user = userEvent.setup();
      renderAs(employeeUser);
      await rowFor('Global Parts Co.');

      await user.type(screen.getByRole('searchbox', { name: /search vendors/i }), 'hub');
      await user.selectOptions(screen.getByLabelText(/^status/i), 'Active');

      expect(await screen.findByText(/no vendors found/i)).toBeInTheDocument();
    });
  });

  describe('vendor details', () => {
    it('opens a details dialog when a vendor is clicked', async () => {
      const user = userEvent.setup();
      const api = renderAs(employeeUser);

      await user.click(
        (await rowFor('Tech Supply LLC')).getByRole('button', { name: 'Tech Supply LLC' }),
      );

      const dialog = within(await screen.findByRole('dialog', { name: /tech supply llc/i }));
      expect(api.getVendor).toHaveBeenCalledWith(2);
      expect(await dialog.findByText('mike@techsupply.example')).toBeInTheDocument();
      expect(dialog.getByText('(512) 555-0187')).toBeInTheDocument();
      expect(dialog.getByText(/austin/i)).toBeInTheDocument();
      expect(dialog.getByText(/tx/i)).toBeInTheDocument();
      expect(dialog.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('role rules', () => {
    it('shows Add Vendor and an Edit button per vendor to admins', async () => {
      renderAs(adminUser);
      expect(await screen.findByRole('button', { name: /add vendor/i })).toBeInTheDocument();
      expect(
        (await rowFor('Global Parts Co.')).getByRole('button', { name: /edit global parts co\./i }),
      ).toBeInTheDocument();
    });

    it('lets employees view and search but hides Add Vendor and Edit', async () => {
      renderAs(employeeUser);
      await rowFor('Global Parts Co.');
      expect(screen.getByRole('searchbox', { name: /search vendors/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add vendor/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument();
    });
  });

  describe('adding and editing (admin)', () => {
    it('adds a vendor through the modal and shows it in the table', async () => {
      const user = userEvent.setup();
      const api = renderAs(adminUser);

      await user.click(await screen.findByRole('button', { name: /add vendor/i }));
      const dialog = within(screen.getByRole('dialog', { name: /add vendor/i }));
      await user.type(dialog.getByLabelText(/^name/i), 'Acme Supply');
      await user.type(dialog.getByLabelText(/^email/i), 'orders@acme.example');
      await user.type(dialog.getByLabelText(/^phone/i), '(555) 123-4567');
      await user.type(dialog.getByLabelText(/^city/i), 'Savannah');
      await user.selectOptions(dialog.getByLabelText(/^state/i), 'GA');
      await user.click(dialog.getByRole('button', { name: /add vendor/i }));

      expect(api.createVendor).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme Supply', phone: '5551234567', status: 'Active' }),
      );
      expect(await screen.findByText(/acme supply added/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await rowFor('Acme Supply')).toBeTruthy();
    });

    it('deactivates a vendor from the Edit modal', async () => {
      const user = userEvent.setup();
      const api = renderAs(adminUser);

      await user.click(
        (await rowFor('Global Parts Co.')).getByRole('button', { name: /edit global parts co\./i }),
      );
      const dialog = within(screen.getByRole('dialog', { name: /edit vendor/i }));
      expect(dialog.getByLabelText(/^name/i)).toHaveValue('Global Parts Co.');
      await user.selectOptions(dialog.getByLabelText(/^status/i), 'Inactive');
      await user.click(dialog.getByRole('button', { name: /save changes/i }));

      expect(api.updateVendor).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'Inactive' }),
      );
      expect(await screen.findByText(/global parts co\. updated/i)).toBeInTheDocument();
      await waitFor(async () =>
        expect((await rowFor('Global Parts Co.')).getByText('Inactive')).toBeInTheDocument(),
      );
    });

    it('keeps the modal open and shows a duplicate-email error from the server', async () => {
      const user = userEvent.setup();
      const api = fakeApi();
      api.createVendor.mockRejectedValue(
        new ApiError('A vendor with this email already exists', 409),
      );
      renderAs(adminUser, api);

      await user.click(await screen.findByRole('button', { name: /add vendor/i }));
      const dialog = within(screen.getByRole('dialog', { name: /add vendor/i }));
      await user.type(dialog.getByLabelText(/^name/i), 'Copycat');
      await user.type(dialog.getByLabelText(/^email/i), 'sarah@globalparts.example');
      await user.type(dialog.getByLabelText(/^phone/i), '(555) 123-4567');
      await user.type(dialog.getByLabelText(/^city/i), 'Atlanta');
      await user.selectOptions(dialog.getByLabelText(/^state/i), 'GA');
      await user.click(dialog.getByRole('button', { name: /add vendor/i }));

      expect(
        await dialog.findByText('A vendor with this email already exists'),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /add vendor/i })).toBeInTheDocument();
    });
  });
});
