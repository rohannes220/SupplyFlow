import { describe, it, expect, beforeEach } from 'vitest';
import { createVendorService } from '../../services/vendorService.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import {
  createInMemoryVendorModel,
  validVendorBody,
  vendorRow,
} from '../helpers/inMemoryVendorModel.js';

describe('vendorService', () => {
  let model;
  let service;

  beforeEach(() => {
    model = createInMemoryVendorModel([
      vendorRow({ id: 1, name: 'Global Parts Co.', email: 'sarah@globalparts.com' }),
      vendorRow({ id: 2, name: 'Tech Supply LLC', email: 'mike@techsupply.com' }),
      vendorRow({
        id: 3,
        name: 'Industrial Hub',
        email: 'lisa@industrialhub.com',
        status: 'Inactive',
      }),
      vendorRow({ id: 4, name: 'Metro Electronics', email: 'david@metro.com' }),
    ]);
    service = createVendorService(model);
  });

  const names = (vendors) => vendors.map((v) => v.name);

  describe('listVendors', () => {
    it('lists every vendor sorted by name', async () => {
      expect(names(await service.listVendors())).toEqual([
        'Global Parts Co.',
        'Industrial Hub',
        'Metro Electronics',
        'Tech Supply LLC',
      ]);
    });

    it('matches search against the name, ignoring case and surrounding spaces', async () => {
      expect(names(await service.listVendors({ search: '  TECH ' }))).toEqual(['Tech Supply LLC']);
      expect(names(await service.listVendors({ search: 'o' }))).toEqual([
        'Global Parts Co.',
        'Metro Electronics',
      ]);
    });

    it('treats a blank search as no filter', async () => {
      expect(await service.listVendors({ search: '   ' })).toHaveLength(4);
    });

    it('filters by status', async () => {
      expect(names(await service.listVendors({ status: 'Inactive' }))).toEqual(['Industrial Hub']);
      expect(await service.listVendors({ status: 'Active' })).toHaveLength(3);
    });

    it('combines search and status', async () => {
      expect(names(await service.listVendors({ search: 'hub', status: 'Active' }))).toEqual([]);
      expect(names(await service.listVendors({ search: 'hub', status: 'Inactive' }))).toEqual([
        'Industrial Hub',
      ]);
    });

    it.each(['active', 'Deleted', 'all'])('rejects an unknown status filter %s', async (status) => {
      const err = await service.listVendors({ status }).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details.map((d) => d.field)).toEqual(['status']);
    });
  });

  describe('getVendor', () => {
    it('returns one vendor', async () => {
      expect(await service.getVendor('2')).toMatchObject({ id: 2, name: 'Tech Supply LLC' });
    });

    it('throws NotFoundError for a missing vendor', async () => {
      await expect(service.getVendor('99')).rejects.toThrow(NotFoundError);
    });

    it.each(['abc', '0', '-1', '1.5'])('throws ValidationError for id %s', async (id) => {
      await expect(service.getVendor(id)).rejects.toThrow(ValidationError);
    });
  });

  describe('createVendor', () => {
    it('creates a normalized vendor that is Active by default', async () => {
      const vendor = await service.createVendor({
        ...validVendorBody,
        email: 'NEW@Vendor.com',
        phone: '+1 (404) 555-0123',
        state: 'ga',
      });
      expect(vendor).toMatchObject({
        id: 5,
        name: 'Global Parts Co.',
        email: 'new@vendor.com',
        phone: '4045550123',
        state: 'GA',
        status: 'Active',
      });
      expect(vendor.createdAt).toEqual(expect.any(String));
    });

    it('can create an Inactive vendor', async () => {
      const vendor = await service.createVendor({
        ...validVendorBody,
        email: 'paused@vendor.com',
        status: 'Inactive',
      });
      expect(vendor.status).toBe('Inactive');
    });

    it('throws ValidationError and stores nothing for invalid input', async () => {
      await expect(service.createVendor({ ...validVendorBody, state: 'XX' })).rejects.toThrow(
        ValidationError,
      );
      expect(await service.listVendors()).toHaveLength(4);
    });

    it('throws ConflictError for an email that is already used, ignoring case', async () => {
      const err = await service
        .createVendor({ ...validVendorBody, email: 'Sarah@GlobalParts.com' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.message).toMatch(/email/i);
    });

    it('does not hide unexpected model errors', async () => {
      model.create = async () => {
        throw new Error('connection lost');
      };
      await expect(
        service.createVendor({ ...validVendorBody, email: 'x@vendor.com' }),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('updateVendor', () => {
    const update = (id, overrides) =>
      service.updateVendor(id, {
        ...validVendorBody,
        email: 'sarah@globalparts.com',
        ...overrides,
      });

    it('updates the vendor details', async () => {
      const vendor = await update('1', { city: 'Savannah', phone: '404.555.0199' });
      expect(vendor).toMatchObject({ id: 1, city: 'Savannah', phone: '4045550199' });
      expect(await service.getVendor('1')).toMatchObject({ city: 'Savannah' });
    });

    it('deactivates a vendor by setting status Inactive', async () => {
      expect((await update('1', { status: 'Inactive' })).status).toBe('Inactive');
      expect(await model.isActive(1)).toBe(false);
    });

    it('reactivates a vendor by setting status Active', async () => {
      const vendor = await service.updateVendor('3', {
        ...validVendorBody,
        email: 'lisa@industrialhub.com',
        status: 'Active',
      });
      expect(vendor.status).toBe('Active');
    });

    it('keeps the current status when status is omitted', async () => {
      const vendor = await service.updateVendor('3', {
        ...validVendorBody,
        email: 'lisa@industrialhub.com',
      });
      expect(vendor.status).toBe('Inactive');
    });

    it('allows keeping the same email', async () => {
      await expect(update('1', { name: 'Global Parts Company' })).resolves.toMatchObject({
        name: 'Global Parts Company',
      });
    });

    it("throws ConflictError when taking another vendor's email", async () => {
      await expect(update('1', { email: 'mike@techsupply.com' })).rejects.toThrow(ConflictError);
    });

    it('throws NotFoundError for a missing vendor', async () => {
      await expect(update('99')).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError for invalid input', async () => {
      await expect(update('1', { phone: '123' })).rejects.toThrow(ValidationError);
    });
  });
});
