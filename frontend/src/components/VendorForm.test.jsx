import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VendorForm from './VendorForm.jsx';
import { ApiError } from '../services/orderApi.js';

const existing = {
  id: 7,
  name: 'Stoneham Printing',
  email: 'stonehamprintingorders@example.com',
  phone: '5125556685',
  city: 'Austin',
  state: 'TX',
  status: 'Active',
  createdAt: '2026-11-01T00:00:00.000Z',
};

const field = {
  name: () => screen.getByLabelText(/^name/i),
  email: () => screen.getByLabelText(/^email/i),
  phone: () => screen.getByLabelText(/^phone/i),
  city: () => screen.getByLabelText(/^city/i),
  state: () => screen.getByLabelText(/^state/i),
  status: () => screen.getByLabelText(/^status/i),
};

function setup({ vendor, onSubmit = vi.fn().mockResolvedValue(undefined) } = {}) {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  render(<VendorForm vendor={vendor} onSubmit={onSubmit} onCancel={onCancel} />);
  return { user, onSubmit, onCancel };
}

async function fillValid(user) {
  await user.type(field.name(), 'Acme Supply');
  await user.type(field.email(), 'Orders@Acme.example');
  await user.type(field.phone(), '(555) 123-4567');
  await user.type(field.city(), 'Atlanta');
  await user.selectOptions(field.state(), 'GA');
}

describe('VendorForm', () => {
  describe('add mode', () => {
    it('labels every field and defaults status to Active', () => {
      setup();
      for (const get of Object.values(field)) expect(get()).toBeInTheDocument();
      expect(field.email()).toHaveAttribute('type', 'email');
      expect(field.phone()).toHaveAttribute('type', 'tel');
      expect(field.status()).toHaveValue('Active');
      expect(screen.getByRole('button', { name: /add vendor/i })).toBeInTheDocument();
    });

    it('offers US state, DC and territory codes in the State select', () => {
      setup();
      const values = [...field.state().querySelectorAll('option')]
        .map((o) => o.value)
        .filter(Boolean);
      expect(values).toHaveLength(56);
      expect(values).toEqual(expect.arrayContaining(['GA', 'DC', 'PR']));
      expect(values).not.toContain('ON');
    });

    it('offers only Active and Inactive statuses', () => {
      setup();
      const values = [...field.status().querySelectorAll('option')].map((o) => o.value);
      expect(values).toEqual(['Active', 'Inactive']);
    });

    it('shows the shared validation messages for empty fields and does not submit', async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('Vendor name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Phone number is required')).toBeInTheDocument();
      expect(screen.getByText('City is required')).toBeInTheDocument();
      expect(screen.getByText('State is required')).toBeInTheDocument();
      expect(field.name()).toHaveAttribute('aria-invalid', 'true');
      expect(field.name()).toHaveAccessibleDescription('Vendor name is required');
    });

    it('rejects an invalid email and phone with specific messages', async () => {
      const { user, onSubmit } = setup();
      await fillValid(user);
      await user.clear(field.email());
      await user.type(field.email(), 'not-an-email');
      await user.clear(field.phone());
      await user.type(field.phone(), '555-1234');
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('Email must be a valid email address')).toBeInTheDocument();
      expect(screen.getByText(/phone must be a 10-digit us number/i)).toBeInTheDocument();
      expect(field.name()).toHaveAttribute('aria-invalid', 'false');
    });

    it('submits the vendor normalized by the shared rules', async () => {
      const { user, onSubmit } = setup();
      await fillValid(user);
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Acme Supply',
        email: 'orders@acme.example',
        phone: '5551234567',
        city: 'Atlanta',
        state: 'GA',
        status: 'Active',
      });
    });

    it('shows server field errors next to the right field', async () => {
      const onSubmit = vi
        .fn()
        .mockRejectedValue(
          new ApiError('Validation failed', 400, [
            { field: 'phone', message: 'Phone is not reachable' },
          ]),
        );
      const { user } = setup({ onSubmit });
      await fillValid(user);
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      expect(await screen.findByText('Phone is not reachable')).toBeInTheDocument();
      expect(field.phone()).toHaveAttribute('aria-invalid', 'true');
      expect(field.phone()).toHaveAccessibleDescription('Phone is not reachable');
    });

    it('shows a duplicate email (409) next to the Email field', async () => {
      const onSubmit = vi
        .fn()
        .mockRejectedValue(new ApiError('A vendor with this email already exists', 409));
      const { user } = setup({ onSubmit });
      await fillValid(user);
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      expect(
        await screen.findByText('A vendor with this email already exists'),
      ).toBeInTheDocument();
      expect(field.email()).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows other server errors (e.g. 403) as a general alert', async () => {
      const onSubmit = vi
        .fn()
        .mockRejectedValue(new ApiError('You do not have permission to perform this action', 403));
      const { user } = setup({ onSubmit });
      await fillValid(user);
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/do not have permission/i);
    });

    it('disables the submit button while saving', async () => {
      let finish;
      const onSubmit = vi.fn(() => new Promise((resolve) => (finish = resolve)));
      const { user } = setup({ onSubmit });
      await fillValid(user);
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      finish();
    });

    it('calls onCancel from the Cancel button', async () => {
      const { user, onCancel } = setup();
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    it('prefills the form from the vendor', () => {
      setup({ vendor: existing });
      expect(field.name()).toHaveValue('Stoneham Printing');
      expect(field.email()).toHaveValue('stonehamprintingorders@example.com');
      expect(field.phone()).toHaveValue('(512) 555-6685');
      expect(field.city()).toHaveValue('Austin');
      expect(field.state()).toHaveValue('TX');
      expect(field.status()).toHaveValue('Active');
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('deactivates the vendor by setting status Inactive', async () => {
      const { user, onSubmit } = setup({ vendor: existing });
      await user.selectOptions(field.status(), 'Inactive');
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Stoneham Printing',
        email: 'stonehamprintingorders@example.com',
        phone: '5125556685',
        city: 'Austin',
        state: 'TX',
        status: 'Inactive',
      });
    });

    it('submits edited details', async () => {
      const { user, onSubmit } = setup({ vendor: existing });
      await user.clear(field.city());
      await user.type(field.city(), 'Round Rock');
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ city: 'Round Rock' }));
    });
  });
});
