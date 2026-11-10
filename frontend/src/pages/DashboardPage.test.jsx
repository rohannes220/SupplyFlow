import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import DashboardPage from './DashboardPage.jsx';
import { employeeUser, renderWithAuth } from '../test/authTestUtils.jsx';

const METRICS = {
  totalOrders: 140,
  pendingOrders: 28,
  activeVendors: 130,
  totalSpending: 1234567.8,
  overdueDeliveries: null,
  ordersByStatus: {
    Draft: 0,
    Pending: 28,
    Approved: 0,
    Shipped: 56,
    Delivered: 56,
    Cancelled: 0,
  },
  recentOrders: [
    { id: 5140, vendorId: 12, amount: 1234.5, status: 'Pending' },
    { id: 5139, vendorId: 7, amount: 89.99, status: 'Shipped' },
  ],
};

const EMPTY = {
  totalOrders: 0,
  pendingOrders: 0,
  activeVendors: 0,
  totalSpending: 0,
  overdueDeliveries: null,
  ordersByStatus: { Draft: 0, Pending: 0, Approved: 0, Shipped: 0, Delivered: 0, Cancelled: 0 },
  recentOrders: [],
};

const fakeApi = (metrics = METRICS) => ({ getDashboard: vi.fn().mockResolvedValue(metrics) });

function renderPage(api = fakeApi()) {
  renderWithAuth(<DashboardPage api={api} />, { user: employeeUser });
  return api;
}

const card = (name) => screen.findByRole('group', { name });

beforeEach(() => localStorage.clear());

describe('DashboardPage', () => {
  it('has a Dashboard heading', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  });

  it('loads the metrics once when opened', async () => {
    const api = renderPage();
    await card('Total Orders');
    expect(api.getDashboard).toHaveBeenCalledTimes(1);
  });

  describe('summary cards', () => {
    it.each([
      ['Total Orders', '140'],
      ['Active Vendors', '130'],
      ['Pending Orders', '28'],
      ['Total Spending', '$1,234,567.80'],
    ])('shows %s', async (name, value) => {
      renderPage();
      expect(await card(name)).toHaveTextContent(value);
    });

    it('shows "—" for Overdue Deliveries while delivery dates are not tracked', async () => {
      renderPage();
      const overdue = await card('Overdue Deliveries');
      expect(overdue).toHaveTextContent('—');
      expect(overdue).toHaveTextContent(/not tracked yet/i);
    });

    it('shows the overdue count once the API provides one, including 0', async () => {
      renderPage(fakeApi({ ...METRICS, overdueDeliveries: 0 }));
      const overdue = await card('Overdue Deliveries');
      expect(overdue).toHaveTextContent('0');
      expect(overdue).not.toHaveTextContent('—');
    });
  });

  it('shows how many orders are in each status', async () => {
    renderPage();
    const breakdown = within(await screen.findByRole('region', { name: /orders by status/i }));
    const items = breakdown.getAllByRole('listitem').map((li) => li.textContent);

    expect(items).toHaveLength(6);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Draft\D*0/),
        expect.stringMatching(/Pending\D*28/),
        expect.stringMatching(/Shipped\D*56/),
        expect.stringMatching(/Delivered\D*56/),
      ]),
    );
  });

  it('lists recent orders newest first with id, vendor, amount and status', async () => {
    renderPage();
    const recent = within(await screen.findByRole('region', { name: /recent orders/i }));
    const [first, second] = recent.getAllByRole('listitem');

    expect(first).toHaveTextContent('#5140');
    expect(first).toHaveTextContent(/vendor 12/i);
    expect(first).toHaveTextContent('$1,234.50');
    expect(within(first).getByText('Pending')).toBeInTheDocument();
    expect(second).toHaveTextContent('#5139');
    expect(second).toHaveTextContent('$89.99');
  });

  it('shows a loading state while the metrics load', async () => {
    renderPage({ getDashboard: vi.fn().mockReturnValue(new Promise(() => {})) });
    expect(await screen.findByText(/loading dashboard/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Total Orders' })).not.toBeInTheDocument();
  });

  it('shows the error when the metrics cannot be loaded', async () => {
    renderPage({
      getDashboard: vi.fn().mockRejectedValue(new Error('Could not reach the server')),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
    expect(screen.queryByRole('group', { name: 'Total Orders' })).not.toBeInTheDocument();
  });

  it('shows zeros and an empty state when there are no orders yet', async () => {
    renderPage(fakeApi(EMPTY));
    expect(await card('Total Orders')).toHaveTextContent('0');
    expect(await card('Total Spending')).toHaveTextContent('$0.00');
    const recent = within(screen.getByRole('region', { name: /recent orders/i }));
    expect(recent.getByText(/no orders yet/i)).toBeInTheDocument();
    expect(recent.queryAllByRole('listitem')).toHaveLength(0);
  });
});
