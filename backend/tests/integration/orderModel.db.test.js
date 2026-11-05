// Runs against a real PostgreSQL database only when TEST_DATABASE_URL is set.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createOrderModel } from '../../models/orderModel.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('orderModel (PostgreSQL)', () => {
  let pool;
  let model;
  const order = {
    vendorId: 3,
    orderAmount: 1234.56,
    customerName: 'Sarah Chen',
    customerCity: 'Atlanta',
    customerState: 'GA',
    customerPhone: '4045550123',
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    const sql = await readFile(
      new URL('../../db/migrations/001_create_orders.sql', import.meta.url),
      'utf8',
    );
    await pool.query('DROP TABLE IF EXISTS orders');
    await pool.query(sql);
    model = createOrderModel(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE orders RESTART IDENTITY');
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('runs a full create/read/update/delete cycle', async () => {
    const created = await model.create(order);
    expect(created).toMatchObject({ orderId: 1, ...order, status: 'Draft' });
    expect(typeof created.orderAmount).toBe('number');

    expect(await model.findById(1)).toEqual(created);
    expect(await model.findAll()).toEqual([created]);

    const updated = await model.update(1, { ...order, orderAmount: 5, customerState: 'TX' });
    expect(updated).toMatchObject({ orderAmount: 5, customerState: 'TX' });

    expect(await model.remove(1)).toBe(true);
    expect(await model.findById(1)).toBeNull();
    expect(await model.remove(1)).toBe(false);
    expect(await model.update(1, order)).toBeNull();
  });

  it('enforces domestic-only constraints at the database level', async () => {
    await expect(model.create({ ...order, customerState: 'ON' })).rejects.toThrow();
    await expect(model.create({ ...order, customerPhone: '442079460958' })).rejects.toThrow();
    await expect(model.create({ ...order, orderAmount: 0 })).rejects.toThrow();
  });

  it('accepts orders from US territories', async () => {
    for (const customerState of ['PR', 'GU', 'VI', 'AS', 'MP']) {
      await expect(model.create({ ...order, customerState })).resolves.toMatchObject({
        customerState,
      });
    }
  });
});
