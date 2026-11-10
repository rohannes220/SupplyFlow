import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { createOrderModel } from '../../models/orderModel.js';
import { createVendorModel } from '../../models/vendorModel.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';
import { validOrderBody } from '../helpers/inMemoryOrderModel.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('order vendor validation with PostgreSQL', () => {
  const schema = `order_vendor_test_${randomBytes(8).toString('hex')}`;
  let adminPool;
  let pool;
  let app;
  const token = jwt.sign({ role: 'employee' }, TEST_JWT_SECRET, {
    subject: String(demoUsers.employee.id),
  });
  const post = (body) =>
    request(app).post('/api/orders').auth(token, { type: 'bearer' }).send(body);

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: url });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({
      connectionString: url,
      options: `-c search_path=${schema} -c application_name=${schema}`,
    });
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
      "INSERT INTO vendors (id, name, email, phone, city, state, status) VALUES (3, 'Active Vendor', 'active@example.com', '5551234567', 'Atlanta', 'GA', 'Active'), (4, 'Inactive Vendor', 'inactive@example.com', '5551234568', 'Atlanta', 'GA', 'Inactive')",
    );
    await pool.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [
        demoUsers.employee.id,
        demoUsers.employee.name,
        demoUsers.employee.email,
        'test-hash',
        'employee',
      ],
    );
    app = createApp({
      orderModel: createOrderModel(pool),
      vendorModel: createVendorModel(pool),
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
  });
  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminPool.end();
    }
  });

  it('creates only for active vendors and rejects changing to inactive vendors', async () => {
    const created = await post(validOrderBody);
    expect(created.status).toBe(201);
    expect((await post({ ...validOrderBody, vendorId: 4 })).status).toBe(400);
    expect((await post({ ...validOrderBody, vendorId: 999 })).status).toBe(400);
    const update = await request(app)
      .put(`/api/orders/${created.body.orderId}`)
      .auth(token, { type: 'bearer' })
      .send({ ...validOrderBody, vendorId: 4 });
    expect(update.status).toBe(400);
    const row = await pool.query('SELECT vendor_id FROM orders WHERE order_id = $1', [
      created.body.orderId,
    ]);
    expect(row.rows[0].vendor_id).toBe(3);
    await pool.query("UPDATE vendors SET status = 'Inactive' WHERE id = 3");
    const retained = await request(app)
      .put(`/api/orders/${created.body.orderId}`)
      .auth(token, { type: 'bearer' })
      .send({ ...validOrderBody, customerCity: 'Boston' });
    expect(retained.status).toBe(200);
    expect(retained.body).toMatchObject({ vendorId: 3, customerCity: 'Boston' });
    await pool.query("UPDATE vendors SET status = 'Active' WHERE id = 3");
  });

  it('rechecks vendor state while a concurrent deactivation is in progress', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE vendors SET status = 'Inactive' WHERE id = 3");
      const pending = post(validOrderBody).then((response) => response);
      let waiting = false;
      for (let attempt = 0; attempt < 50 && !waiting; attempt++) {
        const result = await adminPool.query(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock' AND query LIKE '%active_vendor%') AS waiting",
          [schema],
        );
        waiting = result.rows[0].waiting;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      await client.query('COMMIT');
      const response = await pending;
      expect(response.status).toBe(400);
      expect(response.body.error.details[0].field).toBe('vendorId');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
