// OrdersPage follows the AGENTS.md status workflow and hides admin-only controls (#3, #5).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersPage from './OrdersPage.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { adminUser, employeeUser, renderWithAuth } from '../test/authTestUtils.jsx';

const order = (orderId, status) => ({
  orderId,
  vendorId: 2,
  orderAmount: 1000,
  customerName: `${status} Customer`,
  customerCity: 'Austin',
  customerState: 'TX',
  customerPhone: '5125550188',
  status,
  createdBy: employeeUser.id,
});

const ALL_STATUSES = ['Draft', 'Pending', 'Approved', 'Shipped', 'Delivered', 'Cancelled'];
const ONE_OF_EACH = ALL_STATUSES.map((status, i) => order(i + 1, status));

function fakeApi(orders = ONE_OF_EACH) {
  return {
    listOrders: vi.fn().mockResolvedValue(orders),
    createOrder: vi.fn(),
    updateOrderStatus: vi.fn().mockImplementation(async (orderId, status) => ({
      ...orders.find((o) => o.orderId === orderId),
      status,
    })),
    deleteOrder: vi.fn().mockResolvedValue(undefined),
  };
}

function renderAs(user, api = fakeApi()) {
  renderWithAuth(
    <ProtectedRoute>
      <OrdersPage api={api} />
    </ProtectedRoute>,
    { user },
  );
  return api;
}

// Scoped to the table: an open dialog also shows the customer's name.
// Waits for the row to load (the table itself renders while orders are still loading).
const rowFor = async (status) => {
  const table = within(await screen.findByRole('table'));
  return within((await table.findByText(`${status} Customer`)).closest('tr'));
};

async function statusOptionsFor(status) {
  const user = userEvent.setup();
  await user.click((await rowFor(status)).getByRole('button', { name: /^update$/i }));
  const dialog = screen.getByRole('dialog', { name: /update order #\d+ status/i });
  const options = within(dialog)
    .getAllByRole('option')
    .map((o) => o.value);
  return options;
}

beforeEach(() => localStorage.clear());

describe('OrdersPage delete rules', () => {
  it('shows Delete only for Draft orders', async () => {
    renderAs(adminUser);
    expect((await rowFor('Draft')).getByRole('button', { name: /delete/i })).toBeInTheDocument();
    for (const status of ALL_STATUSES.filter((s) => s !== 'Draft')) {
      expect((await rowFor(status)).queryByRole('button', { name: /delete/i })).toBeNull();
    }
  });

  it('never changes the status before deleting', async () => {
    const user = userEvent.setup();
    const api = renderAs(adminUser);

    await user.click((await rowFor('Draft')).getByRole('button', { name: /delete/i }));
    const dialog = screen.getByRole('dialog', { name: /verification required/i });
    await user.click(within(dialog).getByRole('button', { name: /yes, delete order/i }));

    expect(api.deleteOrder).toHaveBeenCalledWith(1, 'stored-token');
    expect(api.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('shows the server error and keeps the order when delete is rejected', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.deleteOrder.mockRejectedValue(
      Object.assign(new Error('Only Draft orders can be deleted; order is Pending'), {
        status: 409,
      }),
    );
    renderAs(adminUser, api);

    await user.click((await rowFor('Draft')).getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete order/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/only draft orders/i);
    expect((await rowFor('Draft')).getByText('Draft')).toBeInTheDocument();
    expect(api.updateOrderStatus).not.toHaveBeenCalled();
  });
});

describe('OrdersPage status options', () => {
  it.each([
    ['Draft', ['Pending', 'Cancelled']],
    ['Pending', ['Approved', 'Cancelled']],
    ['Approved', ['Shipped']],
    ['Shipped', ['Delivered']],
  ])('offers an admin only the valid next statuses from %s', async (status, expected) => {
    renderAs(adminUser);
    expect(await statusOptionsFor(status)).toEqual(expected);
  });

  it.each([
    ['Draft', ['Pending', 'Cancelled']],
    ['Pending', ['Cancelled']],
  ])('hides admin-only statuses from an employee (%s)', async (status, expected) => {
    renderAs(employeeUser);
    expect(await statusOptionsFor(status)).toEqual(expected);
  });

  it.each(['Approved', 'Shipped'])(
    'gives an employee no Update button on a %s order (only admins can move it)',
    async (status) => {
      renderAs(employeeUser);
      expect((await rowFor(status)).queryByRole('button', { name: /^update$/i })).toBeNull();
    },
  );

  it.each(['Delivered', 'Cancelled'])(
    'has no Update button on a final %s order',
    async (status) => {
      renderAs(adminUser);
      expect((await rowFor(status)).queryByRole('button', { name: /^update$/i })).toBeNull();
    },
  );

  it('lets an employee submit a Draft order for approval', async () => {
    const user = userEvent.setup();
    const api = renderAs(employeeUser);

    await user.click((await rowFor('Draft')).getByRole('button', { name: /^update$/i }));
    const dialog = screen.getByRole('dialog', { name: /update order #1 status/i });
    await user.selectOptions(within(dialog).getByLabelText(/order status/i), 'Pending');
    await user.click(within(dialog).getByRole('button', { name: /update status/i }));

    expect(api.updateOrderStatus).toHaveBeenCalledWith(1, 'Pending', 'stored-token');
    expect(await screen.findByText(/order #1 status updated to pending/i)).toBeInTheDocument();
  });

  it('shows the server error when a status change is rejected', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.updateOrderStatus.mockRejectedValue(
      Object.assign(new Error('Only admins can approve orders'), { status: 403 }),
    );
    renderAs(adminUser, api);

    await user.click((await rowFor('Pending')).getByRole('button', { name: /^update$/i }));
    await user.click(screen.getByRole('button', { name: /update status/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can approve orders');
    expect((await rowFor('Pending')).getByText('Pending')).toBeInTheDocument();
  });
});
