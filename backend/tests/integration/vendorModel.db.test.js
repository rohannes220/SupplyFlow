// Runs against a real PostgreSQL database only when TEST_DATABASE_URL is set.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createVendorModel } from '../../models/vendorModel.js';
import { seedDemoVendors } from '../../db/seeds/demoVendors.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('vendorModel (PostgreSQL)', () => {
  let pool;
  let model;
  const vendor = (overrides = {}) => ({
    name: 'Global Parts Co.',
    email: 'sarah@globalparts.com',
    phone: '5551234567',
    city: 'Atlanta',
    state: 'GA',
    status: 'Active',
    ...overrides,
  });

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    const sql = await readFile(
      new URL('../../db/migrations/003_create_vendors.sql', import.meta.url),
      'utf8',
    );
    await pool.query('DROP TABLE IF EXISTS vendors CASCADE');
    await pool.query(sql);
    model = createVendorModel(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE vendors RESTART IDENTITY');
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('creates, reads and updates a vendor, mapping columns to camelCase', async () => {
    const created = await model.create(vendor());
    expect(created).toEqual({
      id: 1,
      ...vendor(),
      createdAt: expect.any(Date),
    });
    expect(await model.findById(1)).toEqual(created);

    const updated = await model.update(1, vendor({ city: 'Savannah', status: 'Inactive' }));
    expect(updated).toMatchObject({ id: 1, city: 'Savannah', status: 'Inactive' });
    expect(updated.createdAt).toEqual(created.createdAt);
  });

  it('returns null for a missing vendor', async () => {
    expect(await model.findById(99)).toBeNull();
    expect(await model.update(99, vendor())).toBeNull();
  });

  it('defaults status to Active at the database level', async () => {
    const { rows } = await pool.query(
      `INSERT INTO vendors (name, email, phone, city, state)
       VALUES ('A', 'a@x.com', '5551234567', 'Atlanta', 'GA') RETURNING status`,
    );
    expect(rows[0].status).toBe('Active');
  });

  it('rejects a duplicate email with a unique_violation', async () => {
    await model.create(vendor());
    await expect(model.create(vendor({ name: 'Other' }))).rejects.toMatchObject({
      code: '23505',
    });
  });

  it.each([
    ['status', { status: 'Deleted' }],
    ['state', { state: 'XX' }],
    ['phone', { phone: '555-1234' }],
  ])('rejects an invalid %s with a check_violation', async (_field, overrides) => {
    await expect(model.create(vendor(overrides))).rejects.toMatchObject({ code: '23514' });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await model.create(vendor({ name: 'Tech Supply LLC', email: 't@x.com' }));
      await model.create(vendor({ name: 'Industrial Hub', email: 'i@x.com', status: 'Inactive' }));
      await model.create(vendor({ name: 'Global Parts Co.', email: 'g@x.com' }));
      await model.create(vendor({ name: '100% Steel_Works', email: 's@x.com' }));
    });

    const names = async (filters) => (await model.findAll(filters)).map((v) => v.name);

    it('returns all vendors sorted by name', async () => {
      expect(await names()).toEqual([
        '100% Steel_Works',
        'Global Parts Co.',
        'Industrial Hub',
        'Tech Supply LLC',
      ]);
    });

    it('searches names case-insensitively', async () => {
      expect(await names({ search: 'SUPPLY' })).toEqual(['Tech Supply LLC']);
    });

    it('treats % and _ in the search as literal characters', async () => {
      expect(await names({ search: '%' })).toEqual(['100% Steel_Works']);
      expect(await names({ search: '_' })).toEqual(['100% Steel_Works']);
    });

    it('filters by status and combines with search', async () => {
      expect(await names({ status: 'Inactive' })).toEqual(['Industrial Hub']);
      expect(await names({ search: 'hub', status: 'Active' })).toEqual([]);
    });
  });

  describe('isActive', () => {
    it('is true only for an existing Active vendor', async () => {
      await model.create(vendor());
      await model.create(vendor({ email: 'off@x.com', status: 'Inactive' }));

      expect(await model.isActive(1)).toBe(true);
      expect(await model.isActive(2)).toBe(false);
      expect(await model.isActive(99)).toBe(false);
    });
  });

  describe('seedDemoVendors (data/vendors.csv)', () => {
    it('inserts the 140 CSV vendors with their IDs and statuses', async () => {
      expect(await seedDemoVendors(pool)).toBe(140);

      expect(await model.findById(1)).toMatchObject({
        id: 1,
        name: 'Highland Plumbing Services',
        phone: '7815559024',
        status: 'Active',
      });
      expect(await model.findAll({ status: 'Inactive' })).toHaveLength(10);
      expect(await model.isActive(7)).toBe(false);
    });

    it('is safe to re-run and keeps edits made in the app', async () => {
      await seedDemoVendors(pool);
      await model.update(1, vendor({ email: 'edited@example.com', name: 'Edited Name' }));

      expect(await seedDemoVendors(pool)).toBe(0);
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM vendors');
      expect(rows[0].n).toBe(140);
      expect(await model.findById(1)).toMatchObject({ name: 'Edited Name' });
    });

    it('moves the id sequence past the seeded IDs so new vendors get 141', async () => {
      await seedDemoVendors(pool);
      const created = await model.create(vendor({ email: 'new@example.com' }));
      expect(created.id).toBe(141);
    });
  });
});
