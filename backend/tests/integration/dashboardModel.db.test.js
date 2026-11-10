// Runs against a real PostgreSQL database only when TEST_DATABASE_URL is set.
// Uses its own schema so it can't collide with other *.db.test.js files that recreate the
// orders and vendors tables while test files run in parallel.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createDashboardModel } from '../../models/dashboardModel.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'dashboard_test';
const TODAY = '2026-11-10';

const migration = (file) =>
  readFile(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8');

describe.skipIf(!url)('dashboardModel (PostgreSQL)', () => {
  let pool;
  let model;
  let queries;

  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: url });
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    await admin.end();

    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${SCHEMA}` });
    await pool.query(await migration('001_create_orders.sql'));
    await pool.query(await migration('003_create_vendors.sql'));

    // Records every statement the model runs, to check it only uses aggregates.
    queries = [];
    model = createDashboardModel({
      query: (sql, params) => {
        queries.push(sql);
        return pool.query(sql, params);
      },
    });
  });

  beforeEach(async () => {
    await pool.query('ALTER TABLE orders DROP COLUMN IF EXISTS expected_delivery_date');
    await pool.query('TRUNCATE orders, vendors RESTART IDENTITY');
    queries.length = 0;
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool?.end();
  });

  async function insertOrder(status, amount, createdAt, vendorId = 1) {
    const { rows } = await pool.query(
      `INSERT INTO orders (vendor_id, order_amount, customer_name, customer_city, customer_state,
         customer_phone, status, created_at)
       VALUES ($1, $2, 'Sarah Chen', 'Atlanta', 'GA', '4045550123', $3, $4)
       RETURNING order_id`,
      [vendorId, amount, status, createdAt],
    );
    return rows[0].order_id;
  }

  async function insertVendor(email, status) {
    await pool.query(
      `INSERT INTO vendors (name, email, phone, city, state, status)
       VALUES ('Vendor', $1, '5551234567', 'Atlanta', 'GA', $2)`,
      [email, status],
    );
  }

  it('computes counts, spending and the status breakdown', async () => {
    await insertOrder('Draft', '10.10', '2026-11-01');
    await insertOrder('Pending', '20.20', '2026-11-02');
    await insertOrder('Pending', '30.30', '2026-11-03');
    await insertOrder('Delivered', '40.40', '2026-11-04');
    await insertOrder('Cancelled', '500.00', '2026-11-05');
    await insertVendor('a@x.com', 'Active');
    await insertVendor('b@x.com', 'Active');
    await insertVendor('c@x.com', 'Inactive');

    const m = await model.getMetrics({ today: TODAY });

    expect(m.totalOrders).toBe(5);
    expect(m.pendingOrders).toBe(2);
    expect(m.activeVendors).toBe(2);
    expect(m.totalSpending).toBeCloseTo(101, 2); // NUMERIC string converted to a number
    expect(typeof m.totalSpending).toBe('number');
    expect(m.ordersByStatus).toEqual({ Draft: 1, Pending: 2, Delivered: 1, Cancelled: 1 });
  });

  it('returns the 5 most recent orders as { id, vendorId, amount, status }', async () => {
    const ids = [];
    for (let day = 1; day <= 7; day += 1) {
      ids.push(await insertOrder('Pending', `${day}.50`, `2026-11-0${day}`, day));
    }

    const { recentOrders } = await model.getMetrics({ today: TODAY });

    expect(recentOrders.map((o) => o.id)).toEqual(ids.slice(2).reverse());
    expect(recentOrders[0]).toEqual({ id: ids[6], vendorId: 7, amount: 7.5, status: 'Pending' });
  });

  it('reports zeros, an empty breakdown and no recent orders for an empty database', async () => {
    expect(await model.getMetrics({ today: TODAY })).toEqual({
      totalOrders: 0,
      pendingOrders: 0,
      activeVendors: 0,
      totalSpending: 0,
      ordersByStatus: {},
      recentOrders: [],
      overdueDeliveries: null,
    });
  });

  it('returns null overdue deliveries while orders.expected_delivery_date does not exist', async () => {
    await insertOrder('Pending', '10', '2026-11-01');
    expect((await model.getMetrics({ today: TODAY })).overdueDeliveries).toBeNull();
  });

  it('counts overdue deliveries once the expected_delivery_date column is added', async () => {
    await pool.query('ALTER TABLE orders ADD COLUMN expected_delivery_date DATE');
    const add = async (status, due) => {
      const id = await insertOrder(status, '10', '2026-11-01');
      await pool.query('UPDATE orders SET expected_delivery_date = $1 WHERE order_id = $2', [
        due,
        id,
      ]);
    };
    await add('Pending', '2026-11-09'); // overdue
    await add('Shipped', '2026-10-01'); // overdue
    await add('Approved', TODAY); // due today: not overdue
    await add('Shipped', '2026-11-20'); // future
    await add('Delivered', '2026-11-01'); // done
    await add('Cancelled', '2026-11-01'); // done
    await add('Draft', null); // no date

    expect((await model.getMetrics({ today: TODAY })).overdueDeliveries).toBe(2);
  });

  it('only runs aggregate or LIMITed queries, never loading every row', async () => {
    for (let i = 0; i < 12; i += 1) await insertOrder('Pending', '1', '2026-11-01');
    await model.getMetrics({ today: TODAY });

    expect(queries.length).toBeGreaterThan(0);
    for (const sql of queries) {
      expect(sql).toMatch(/count\(|sum\(|\bLIMIT\b|information_schema/i);
    }
  });
});
