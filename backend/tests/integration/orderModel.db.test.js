// Runs against a real PostgreSQL database only when TEST_DATABASE_URL is set.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createOrderModel } from '../../models/orderModel.js';
import { randomBytes } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('orderModel (PostgreSQL)', () => {
  let pool;
  let model;
  let adminPool;
  const schema = `order_test_${randomBytes(8).toString('hex')}`;
  const order = {
    vendorId: 3,
    orderAmount: 1234.56,
    customerName: 'Sarah Chen',
    customerCity: 'Atlanta',
    customerState: 'GA',
    customerPhone: '4045550123',
  };

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: url });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    for (const migration of [
      '001_create_orders.sql',
      '002_create_users.sql',
      '003_order_owner.sql',
    ]) {
      await pool.query(
        await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'),
      );
    }
    model = createOrderModel(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE orders RESTART IDENTITY');
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminPool.end();
    }
  });

  it('runs a full create/read/update/delete cycle', async () => {
    const created = await model.create(order);
    expect(created).toMatchObject({ orderId: 1, ...order, status: 'Draft' });
    expect(typeof created.orderAmount).toBe('number');

    expect(await model.findById(1)).toEqual(created);
    expect(await model.findAll()).toEqual([created]);

    const updated = await model.update(
      1,
      { ...order, orderAmount: 5, customerState: 'TX' },
      'Draft',
    );
    expect(updated).toMatchObject({ orderAmount: 5, customerState: 'TX' });

    expect(await model.remove(1, 'Draft')).toBe(true);
    expect(await model.findById(1)).toBeNull();
    expect(await model.remove(1, 'Draft')).toBe(false);
    expect(await model.update(1, order, 'Draft')).toBeNull();
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
