import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersPage from './OrdersPage.jsx';

const auth = vi.hoisted(() => ({ user: { id: 1, role: 'admin' }, token: 'test-token' }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));

const existing = {
  orderId: 1,
  vendorId: 2,
  orderAmount: 1000,
  customerName: 'Mike Johnson',
  customerCity: 'Austin',
  customerState: 'TX',
  customerPhone: '5125550188',
  status: 'Draft',
};

function fakeApi(orders = [existing]) {
  return {
    listOrders: vi.fn().mockResolvedValue(orders),
    createOrder: vi.fn().mockImplementation(async (input) => ({
      orderId: 2,
      ...input,
      status: 'Draft',
    })),
    updateOrder: vi.fn().mockImplementation(async (id, input) => ({
      ...existing,
      ...input,
      orderId: id,
    })),
    updateOrderStatus: vi.fn().mockImplementation(async (id, status) => ({
      ...existing,
      orderId: id,
      status,
    })),
    deleteOrder: vi.fn().mockResolvedValue(undefined),
  };
}

describe('OrdersPage', () => {
  beforeEach(() => {
    auth.user = { id: 1, role: 'admin' };
  });

  it('hides other employees’ controls and does not offer approval to an employee', async () => {
    auth.user = { id: 2, role: 'employee' };
    const user = userEvent.setup();
    render(
      <OrdersPage
        api={fakeApi([
          { ...existing, orderId: 1, createdBy: 2 },
          { ...existing, orderId: 2, createdBy: 3, customerName: 'Another employee' },
        ])}
      />,
    );
    const otherRow = (await screen.findByText('Another employee')).closest('tr');
    expect(within(otherRow).queryByRole('button', { name: /update|delete|edit/i })).toBeNull();
    const ownRow = screen.getByText('#1').closest('tr');
    await user.click(within(ownRow).getByRole('button', { name: /update/i }));
    expect(screen.queryByRole('option', { name: 'Approved' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Pending' })).toBeInTheDocument();
  });

  it('lets an employee edit their own draft', async () => {
    auth.user = { id: 2, role: 'employee' };
    const user = userEvent.setup();
    const api = fakeApi([{ ...existing, createdBy: 2 }]);
    render(<OrdersPage api={api} />);
    await screen.findByText('Mike Johnson');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: /edit order/i });
    const city = within(dialog).getByLabelText(/customer city/i);
    await user.clear(city);
    await user.type(city, 'Dallas');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    expect(api.updateOrder).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ customerCity: 'Dallas' }),
      'test-token',
    );
    expect(await screen.findByText('Dallas')).toBeInTheDocument();
  });
  it('lists orders with every field', async () => {
    render(<OrdersPage api={fakeApi()} />);
    const row = (await screen.findByText('Mike Johnson')).closest('tr');
    const cells = within(row);
    expect(cells.getByText('#1')).toBeInTheDocument();
    expect(cells.getByText('$1,000.00')).toBeInTheDocument();
    expect(cells.getByText('2')).toBeInTheDocument();
    expect(cells.getByText('Austin')).toBeInTheDocument();
    expect(cells.getByText('TX')).toBeInTheDocument();
    expect(cells.getByText('(512) 555-0188')).toBeInTheDocument();
    expect(cells.getByText('Draft')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    render(<OrdersPage api={fakeApi([])} />);
    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    const api = fakeApi();
    api.listOrders.mockRejectedValue(new Error('Could not reach the server'));
    render(<OrdersPage api={api} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('adds an order through the modal and shows it in the table', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<OrdersPage api={api} />);
    await screen.findByText('Mike Johnson');

    await user.click(screen.getByRole('button', { name: /add order/i }));
    const dialog = screen.getByRole('dialog', { name: /add order/i });
    const form = within(dialog);
    await user.type(form.getByLabelText(/vendor id/i), '7');
    await user.type(form.getByLabelText(/order amount/i), '89.99');
    await user.type(form.getByLabelText(/customer name/i), 'Ana Rivera');
    await user.type(form.getByLabelText(/customer city/i), 'San Juan');
    await user.selectOptions(form.getByLabelText(/customer state/i), 'PR');
    await user.type(form.getByLabelText(/customer phone/i), '787-555-0142');
    await user.click(form.getByRole('button', { name: /add order/i }));

    expect(api.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: 7, customerState: 'PR', customerPhone: '7875550142' }),
      'test-token',
    );
    expect(await screen.findByText(/order #2 added/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Ana Rivera')).toBeInTheDocument();
  });

  it('closes the modal with Escape', async () => {
    const user = userEvent.setup();
    render(<OrdersPage api={fakeApi()} />);
    await user.click(screen.getByRole('button', { name: /add order/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('updates an order status via the update modal', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<OrdersPage api={api} />);
    await screen.findByText('Mike Johnson');

    await user.click(screen.getByRole('button', { name: /update/i }));
    const dialog = screen.getByRole('dialog', { name: /update order #1 status/i });
    expect(dialog).toBeInTheDocument();

    const select = within(dialog).getByLabelText(/order status/i);
    await user.selectOptions(select, 'Pending');
    await user.click(within(dialog).getByRole('button', { name: /update status/i }));

    expect(api.updateOrderStatus).toHaveBeenCalledWith(1, 'Pending', 'test-token');
    expect(await screen.findByText(/order #1 status updated to pending/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes an order after the verification process', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<OrdersPage api={api} />);
    await screen.findByText('Mike Johnson');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    const dialog = screen.getByRole('dialog', { name: /verification required/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/permanently deleted from the system/i);

    await user.click(within(dialog).getByRole('button', { name: /yes, delete order/i }));
    expect(api.deleteOrder).toHaveBeenCalledWith(1, 'test-token');
    expect(await screen.findByText(/order #1 was successfully deleted/i)).toBeInTheDocument();
    expect(screen.queryByText('Mike Johnson')).not.toBeInTheDocument();
  });

  it('groups orders from lowest to highest and highest to lowest', async () => {
    const user = userEvent.setup();
    const twoOrders = [
      { ...existing, orderId: 1, orderAmount: 500, customerName: 'Low Amount' },
      { ...existing, orderId: 2, orderAmount: 5000, customerName: 'High Amount' },
    ];
    render(<OrdersPage api={fakeApi(twoOrders)} />);
    await screen.findByText('Low Amount');

    // Click Group Orders ↑ (Lowest to Highest)
    await user.click(screen.getByRole('button', { name: /group orders ↑/i }));
    let rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Low Amount')).toBeInTheDocument();
    expect(within(rows[2]).getByText('High Amount')).toBeInTheDocument();

    // Click Group Orders ↓ (Highest to Lowest)
    await user.click(screen.getByRole('button', { name: /group orders ↓/i }));
    rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('High Amount')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Low Amount')).toBeInTheDocument();

    // Click Show All Orders
    await user.click(screen.getByRole('button', { name: /show all orders/i }));
    expect(screen.getByText(/showing all 2 total orders/i)).toBeInTheDocument();
  });
});
