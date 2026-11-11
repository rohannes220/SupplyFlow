import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createOrderModel } from '../../models/orderModel.js';
import { createUserModel } from '../../models/userModel.js';
import { createVendorModel } from '../../models/vendorModel.js';
import { validOrderBody } from '../helpers/inMemoryOrderModel.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('order tracking with PostgreSQL', () => {
  const schema = `tracking_test_${randomBytes(8).toString('hex')}`;
  let adminPool;
  let pool;
  let app;

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: url });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    for (const migration of [
      '001_create_orders.sql',
      '002_create_users.sql',
      '003_create_vendors.sql',
      '003_order_owner.sql',
    ]) {
      await pool.query(
        await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'),
      );
    }
    await pool.query(
      "INSERT INTO vendors (id, name, email, phone, city, state, status) VALUES (3, 'Vendor', 'vendor@example.com', '5551234567', 'Atlanta', 'GA', 'Active')",
    );
    app = createApp({
      orderModel: createOrderModel(pool),
      vendorModel: createVendorModel(pool),
      userModel: createUserModel(pool),
      jwtSecret: 'test-only-secret',
    });
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminPool.end();
    }
  });

  it('persists employee submission and admin approval through delivery', async () => {
    const employee = await request(app).post('/api/auth/register').send({
      name: 'Employee',
      email: 'employee@example.com',
      password: 'a-test-password',
    });
    const administrator = await request(app).post('/api/auth/register').send({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'a-test-password',
    });
    expect(employee.status).toBe(201);
    expect(administrator.status).toBe(201);
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [administrator.body.user.id]);
    const created = await request(app)
      .post('/api/orders')
      .auth(employee.body.token, { type: 'bearer' })
      .send(validOrderBody);
    expect(created.status).toBe(201);
    const path = `/api/orders/${created.body.orderId}/status`;
    const move = (token, status) =>
      request(app).patch(path).auth(token, { type: 'bearer' }).send({ status });
    expect((await move(employee.body.token, 'Pending')).status).toBe(200);
    expect((await move(employee.body.token, 'Approved')).status).toBe(403);
    for (const status of ['Approved', 'Shipped', 'Delivered']) {
      expect((await move(administrator.body.token, status)).body.status).toBe(status);
    }
    expect((await move(administrator.body.token, 'Pending')).status).toBe(400);
    const result = await pool.query('SELECT status FROM orders WHERE order_id = $1', [
      created.body.orderId,
    ]);
    expect(result.rows[0].status).toBe('Delivered');
  });
});
