import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';
import { createInMemoryVendorModel, vendorRow } from '../helpers/inMemoryVendorModel.js';
import { createInMemoryDashboardModel } from '../helpers/inMemoryDashboardModel.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';

const { admin, employee } = demoUsers;
const bearer = (user) =>
  `Bearer ${jwt.sign({ role: user.role }, TEST_JWT_SECRET, { subject: String(user.id), expiresIn: '1h' })}`;

const order = (orderId, status, orderAmount) => ({
  orderId,
  ...validOrderBody,
  customerPhone: '4045550123',
  orderAmount,
  status,
});

describe('GET /api/dashboard', () => {
  let app;
  let orderModel;

  beforeEach(() => {
    orderModel = createInMemoryOrderModel([
      order(1, 'Pending', 100),
      order(2, 'Shipped', 250.5),
      order(3, 'Cancelled', 1000),
    ]);
    const vendorModel = createInMemoryVendorModel([
      vendorRow({ id: 1, email: 'a@x.com' }),
      vendorRow({ id: 2, email: 'b@x.com', status: 'Inactive' }),
    ]);
    app = createApp({
      orderModel,
      vendorModel,
      dashboardModel: createInMemoryDashboardModel({ orderModel, vendorModel }),
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', 'Bearer forged');
    expect(res.status).toBe(401);
  });

  it.each([
    ['admin', admin],
    ['employee', employee],
  ])('returns the metrics to a logged-in %s', async (_role, user) => {
    const res = await request(app).get('/api/dashboard').set('Authorization', bearer(user));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalOrders: 3,
      pendingOrders: 1,
      activeVendors: 1,
      totalSpending: 350.5,
      overdueDeliveries: null,
      ordersByStatus: {
        Draft: 0,
        Pending: 1,
        Approved: 0,
        Shipped: 1,
        Delivered: 0,
        Cancelled: 1,
      },
      recentOrders: [
        { id: 3, vendorId: 3, amount: 1000, status: 'Cancelled' },
        { id: 2, vendorId: 3, amount: 250.5, status: 'Shipped' },
        { id: 1, vendorId: 3, amount: 100, status: 'Pending' },
      ],
    });
  });

  it('is computed fresh on every request', async () => {
    const auth = bearer(employee);
    await request(app)
      .post('/api/orders')
      .set('Authorization', auth)
      .send({ ...validOrderBody, orderAmount: 49.5 });

    const res = await request(app).get('/api/dashboard').set('Authorization', auth);
    expect(res.body.totalOrders).toBe(4);
    expect(res.body.ordersByStatus.Draft).toBe(1);
    expect(res.body.totalSpending).toBe(400);
    expect(res.body.recentOrders[0]).toMatchObject({ id: 4, amount: 49.5, status: 'Draft' });
  });

  it('returns 500 without leaking internals when the model fails', async () => {
    const failing = createApp({
      orderModel,
      dashboardModel: {
        getMetrics: async () => {
          throw new Error('connection refused at 10.0.0.5');
        },
      },
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
      logger: { error() {} },
    });
    const res = await request(failing).get('/api/dashboard').set('Authorization', bearer(admin));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.5/);
  });

  it('is not mounted without a dashboardModel', async () => {
    const withoutDashboard = createApp({
      orderModel,
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
    const res = await request(withoutDashboard)
      .get('/api/dashboard')
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
  });
});
