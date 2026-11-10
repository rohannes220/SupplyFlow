import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createOrderModel } from '../../models/orderModel.js';
import { createUserModel } from '../../models/userModel.js';
import { validOrderBody } from '../helpers/inMemoryOrderModel.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('RBAC with PostgreSQL', () => {
  const schema = `rbac_test_${randomBytes(8).toString('hex')}`;
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
      '003_order_owner.sql',
    ]) {
      await pool.query(
        await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'),
      );
    }
    app = createApp({
      orderModel: createOrderModel(pool),
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

  it('persists users and ownership and uses current database roles', async () => {
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Test employee',
      email: 'rbac-test@example.com',
      password: 'a-test-password',
    });
    expect(registration.status).toBe(201);
    const { token, user } = registration.body;
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Second', 'second@example.com', 'hash', 'employee')",
    );
    await pool.query(
      "SELECT set_config('supplyflow.admin_email_1', $1, false), set_config('supplyflow.admin_email_2', $2, false)",
      [user.email, 'second@example.com'],
    );
    await pool.query(
      await readFile(new URL('../../db/migrations/004_fixed_admins.sql', import.meta.url), 'utf8'),
    );
    const created = await request(app)
      .post('/api/orders')
      .auth(token, { type: 'bearer' })
      .send(validOrderBody);
    expect(created.status).toBe(201);
    expect(created.body.createdBy).toBe(user.id);
    expect((await request(app).get('/api/users').auth(token, { type: 'bearer' })).status).toBe(403);
    await promisify(execFile)(
      process.execPath,
      [fileURLToPath(new URL('../../db/grantAdmin.js', import.meta.url)), user.email],
      { env: { ...process.env, DATABASE_URL: url, PGOPTIONS: `-c search_path=${schema}` } },
    );
    const list = await request(app).get('/api/users').auth(token, { type: 'bearer' });
    expect(list.status).toBe(200);
    expect(list.body).toEqual(
      expect.arrayContaining([{ id: user.id, name: user.name, email: user.email, role: 'admin' }]),
    );
  });
});
