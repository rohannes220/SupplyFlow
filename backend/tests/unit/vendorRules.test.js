// Vendor field rules live in shared/ so the API and the vendor form use the same checks.
import { describe, it, expect } from 'vitest';
import { validateVendor, VENDOR_STATUSES } from '@supplyflow/shared/vendorRules';
import { validVendorBody } from '../helpers/inMemoryVendorModel.js';

const fieldsWithErrors = (body) => validateVendor(body).errors.map((e) => e.field);

describe('validateVendor', () => {
  it('accepts and normalizes a valid vendor', () => {
    const { value, errors } = validateVendor({
      name: '  Global Parts Co. ',
      email: ' Sarah@GlobalParts.com ',
      phone: '(555) 123-4567',
      city: ' Atlanta ',
      state: 'ga',
    });
    expect(errors).toEqual([]);
    expect(value).toEqual({
      name: 'Global Parts Co.',
      email: 'sarah@globalparts.com',
      phone: '5551234567',
      city: 'Atlanta',
      state: 'GA',
    });
  });

  it('exposes the allowed statuses', () => {
    expect(VENDOR_STATUSES).toEqual(['Active', 'Inactive']);
  });

  it('leaves status out when not given, so callers can apply the default', () => {
    expect(validateVendor(validVendorBody).value).not.toHaveProperty('status');
  });

  it('never throws and rejects a non-object body', () => {
    for (const body of [null, undefined, [], 'vendor', 42]) {
      expect(fieldsWithErrors(body)).toEqual(['body']);
    }
  });

  it('reports every missing required field', () => {
    expect(fieldsWithErrors({}).sort()).toEqual(['city', 'email', 'name', 'phone', 'state']);
  });

  it.each(['name', 'email', 'phone', 'city', 'state'])('treats a blank %s as missing', (field) => {
    const { errors } = validateVendor({ ...validVendorBody, [field]: '   ' });
    expect(errors).toEqual([{ field, message: expect.stringMatching(/required/i) }]);
  });

  it('rejects unknown fields, including client-supplied id and createdAt', () => {
    expect(fieldsWithErrors({ ...validVendorBody, id: 9 })).toEqual(['id']);
    expect(fieldsWithErrors({ ...validVendorBody, createdAt: '2026-01-01' })).toEqual([
      'createdAt',
    ]);
  });

  it.each(['name', 'city'])('rejects a %s longer than 100 characters', (field) => {
    expect(fieldsWithErrors({ ...validVendorBody, [field]: 'a'.repeat(101) })).toEqual([field]);
    expect(fieldsWithErrors({ ...validVendorBody, [field]: 'a'.repeat(100) })).toEqual([]);
  });

  describe('email', () => {
    it.each(['vendor@example.com', 'first.last+tag@sub.example.co'])('accepts %s', (email) => {
      expect(fieldsWithErrors({ ...validVendorBody, email })).toEqual([]);
    });

    it.each(['not-an-email', 'a@b', '@example.com', 'a b@example.com', 'a@@example.com', 42])(
      'rejects %s',
      (email) => {
        expect(fieldsWithErrors({ ...validVendorBody, email })).toEqual(['email']);
      },
    );

    it('rejects an email longer than 255 characters', () => {
      const email = `${'a'.repeat(250)}@x.com`;
      expect(fieldsWithErrors({ ...validVendorBody, email })).toEqual(['email']);
    });
  });

  describe('phone', () => {
    it.each([
      '(555) 123-4567',
      '555-123-4567',
      '555.123.4567',
      '555 123 4567',
      '5551234567',
      '+1 555 123 4567',
      '1-555-123-4567',
    ])('accepts %s and normalizes it to 10 digits', (phone) => {
      expect(validateVendor({ ...validVendorBody, phone }).value.phone).toBe('5551234567');
    });

    it.each([
      ['too few digits', '123-4567'],
      ['too many digits', '555-123-45678'],
      ['another country code', '+44 20 7946 0958'],
      ['letters', '555-CALL-NOW'],
      ['a number instead of a string', 5551234567],
    ])('rejects %s', (_label, phone) => {
      expect(fieldsWithErrors({ ...validVendorBody, phone })).toEqual(['phone']);
    });
  });

  describe('state', () => {
    it.each(['GA', 'ny', 'DC', 'PR'])('accepts the 2-letter code %s', (state) => {
      expect(validateVendor({ ...validVendorBody, state }).value.state).toBe(state.toUpperCase());
    });

    it.each(['Georgia', 'XX', 'G', 'GAA', 'ON', 12])('rejects %s', (state) => {
      expect(fieldsWithErrors({ ...validVendorBody, state })).toEqual(['state']);
    });
  });

  describe('status', () => {
    it.each(['Active', 'Inactive'])('accepts %s', (status) => {
      expect(validateVendor({ ...validVendorBody, status }).value.status).toBe(status);
    });

    it.each(['active', 'Deleted', '', null, true])('rejects %s', (status) => {
      expect(fieldsWithErrors({ ...validVendorBody, status })).toEqual(['status']);
    });
  });
});
