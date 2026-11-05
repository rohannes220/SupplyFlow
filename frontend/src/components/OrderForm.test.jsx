import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderForm from './OrderForm.jsx';
import { ApiError } from '../services/orderApi.js';

async function fillValid(user) {
  await user.type(screen.getByLabelText(/vendor id/i), '3');
  await user.type(screen.getByLabelText(/order amount/i), '2250.50');
  await user.type(screen.getByLabelText(/customer name/i), 'Sarah Chen');
  await user.type(screen.getByLabelText(/customer city/i), 'Atlanta');
  await user.selectOptions(screen.getByLabelText(/customer state/i), 'GA');
  await user.type(screen.getByLabelText(/customer phone/i), '(404) 555-0123');
}

function setup(props = {}) {
  const user = userEvent.setup();
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue({ orderId: 1 });
  render(<OrderForm onSubmit={onSubmit} onCancel={props.onCancel ?? vi.fn()} />);
  return { user, onSubmit };
}

describe('OrderForm', () => {
  it('labels every field and explains that Order ID is assigned automatically', () => {
    setup();
    for (const label of [
      /vendor id/i,
      /order amount/i,
      /customer name/i,
      /customer city/i,
      /customer state/i,
      /customer phone/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/order id/i)).toHaveValue('Assigned automatically');
    expect(screen.getByLabelText(/order id/i)).toHaveAttribute('readonly');
  });

  it('offers US states, DC and territories, and nothing international', () => {
    setup();
    const select = screen.getByLabelText(/customer state/i);
    const values = [...select.querySelectorAll('option')].map((o) => o.value).filter(Boolean);
    expect(values).toHaveLength(56);
    expect(values).toEqual(expect.arrayContaining(['CA', 'DC', 'PR', 'GU', 'VI', 'AS', 'MP']));
    expect(values).not.toContain('ON');
  });

  it('shows an error for every empty field and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /add order/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Vendor ID is required')).toBeInTheDocument();
    expect(screen.getByText('Order amount is required')).toBeInTheDocument();
    expect(screen.getByText('Customer name is required')).toBeInTheDocument();
    expect(screen.getByText('Customer city is required')).toBeInTheDocument();
    expect(screen.getByText(/customer state must be a us state/i)).toBeInTheDocument();
    expect(
      screen.getByText(/customer phone must be a valid 10-digit us number/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/vendor id/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects bad values with specific messages', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await user.clear(screen.getByLabelText(/vendor id/i));
    await user.type(screen.getByLabelText(/vendor id/i), '-4');
    await user.clear(screen.getByLabelText(/order amount/i));
    await user.type(screen.getByLabelText(/order amount/i), '10.999');
    await user.clear(screen.getByLabelText(/customer phone/i));
    await user.type(screen.getByLabelText(/customer phone/i), '416-555-0123');
    await user.click(screen.getByRole('button', { name: /add order/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Vendor ID must be a positive whole number')).toBeInTheDocument();
    expect(screen.getByText('Order amount must have at most 2 decimal places')).toBeInTheDocument();
    expect(screen.getByText(/international orders are not accepted/i)).toBeInTheDocument();
  });

  it('clears a field error as soon as it is corrected', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /add order/i }));
    expect(screen.getByText('Customer city is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/customer city/i), 'Boston');
    expect(screen.queryByText('Customer city is required')).not.toBeInTheDocument();
  });

  it('submits a normalized order', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /add order/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      vendorId: 3,
      orderAmount: 2250.5,
      customerName: 'Sarah Chen',
      customerCity: 'Atlanta',
      customerState: 'GA',
      customerPhone: '4045550123',
    });
  });

  it('shows errors returned by the server next to the right field', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError('Validation failed', 400, [
          { field: 'vendorId', message: 'Vendor 3 is inactive' },
        ]),
      );
    const { user } = setup({ onSubmit });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /add order/i }));
    expect(await screen.findByText('Vendor 3 is inactive')).toBeInTheDocument();
  });

  it('shows a general error when the server fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError('Internal server error', 500));
    const { user } = setup({ onSubmit });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /add order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });

  it('calls onCancel', async () => {
    const onCancel = vi.fn();
    const { user } = setup({ onCancel });
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
