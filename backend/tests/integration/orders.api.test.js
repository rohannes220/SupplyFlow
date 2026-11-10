import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';
import jwt from 'jsonwebtoken';

const userModel = createInMemoryUserModel();
const jwtSecret = TEST_JWT_SECRET;
const token = jwt.sign({ role: 'admin' }, jwtSecret, { subject: String(demoUsers.admin.id) });
const asAdmin = (app) => request.agent(app).set('Authorization', `Bearer ${token}`);

describe('/api/orders', () => {
  let app;

  beforeEach(() => {
    app = createApp({ orderModel: createInMemoryOrderModel(), userModel, jwtSecret });
  });

  async function createOrder(body = validOrderBody) {
    return asAdmin(app).post('/api/orders').send(body);
  }

  describe('POST /api/orders', () => {
    it('creates an order and returns 201 with Location header', async () => {
      const res = await createOrder();
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe('/api/orders/1');
      expect(res.body).toMatchObject({
        orderId: 1,
        vendorId: 3,
        orderAmount: 2250.5,
        customerName: 'Sarah Chen',
        customerCity: 'Atlanta',
        customerState: 'GA',
        customerPhone: '4045550123',
        status: 'Draft',
      });
    });

    it('returns 400 with per-field details for invalid input', async () => {
      const res = await createOrder({ vendorId: -1 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation/i);
      expect(res.body.error.details.map((d) => d.field)).toContain('vendorId');
      expect(res.body.error.details.map((d) => d.field)).toContain('customerPhone');
    });

    it('returns 400 for international orders', async () => {
      const res = await createOrder({
        ...validOrderBody,
        customerState: 'Ontario',
        customerCountry: 'CA',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
        'customerCountry',
        'customerState',
      ]);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await asAdmin(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send('{"vendorId": ');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/json/i);
    });
  });

  describe('GET /api/orders', () => {
    it('lists orders', async () => {
      await createOrder();
      await createOrder({ ...validOrderBody, customerName: 'Lisa Wang' });
      const res = await asAdmin(app).get('/api/orders');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].customerName).toBe('Lisa Wang');
    });
  });

  describe('GET /api/orders/:id', () => {
    it('returns the order', async () => {
      await createOrder();
      const res = await asAdmin(app).get('/api/orders/1');
      expect(res.status).toBe(200);
      expect(res.body.orderId).toBe(1);
    });

    it('returns 404 for a missing order', async () => {
      const res = await asAdmin(app).get('/api/orders/99');
      expect(res.status).toBe(404);
    });

    it('returns 400 for a malformed id', async () => {
      const res = await asAdmin(app).get('/api/orders/abc');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('updates the order', async () => {
      await createOrder();
      const res = await asAdmin(app)
        .put('/api/orders/1')
        .send({ ...validOrderBody, orderAmount: 10, customerCity: 'Savannah' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ orderId: 1, orderAmount: 10, customerCity: 'Savannah' });
    });

    it('returns 400 for invalid data', async () => {
      await createOrder();
      const res = await asAdmin(app)
        .put('/api/orders/1')
        .send({ ...validOrderBody, orderAmount: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 404 for a missing order', async () => {
      const res = await asAdmin(app).put('/api/orders/99').send(validOrderBody);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('deletes the order and returns 204', async () => {
      await createOrder();
      const res = await asAdmin(app).delete('/api/orders/1');
      expect(res.status).toBe(204);
      expect((await asAdmin(app).get('/api/orders/1')).status).toBe(404);
    });

    it('returns 404 for a missing order', async () => {
      const res = await asAdmin(app).delete('/api/orders/99');
      expect(res.status).toBe(404);
    });
  });

  it('returns 409 when editing or deleting an order that is no longer Draft', async () => {
    app = createApp({
      userModel,
      jwtSecret,
      orderModel: createInMemoryOrderModel([
        { orderId: 5, ...validOrderBody, customerPhone: '4045550123', status: 'Shipped' },
      ]),
    });
    expect((await asAdmin(app).put('/api/orders/5').send(validOrderBody)).status).toBe(409);
    expect((await asAdmin(app).delete('/api/orders/5')).status).toBe(409);
  });

  it('returns 500 without leaking internals when the database fails', async () => {
    const failingModel = {
      ...createInMemoryOrderModel(),
      findAll: async () => {
        throw new Error('connection refused at 10.0.0.5');
      },
    };
    app = createApp({ orderModel: failingModel, userModel, jwtSecret, logger: { error() {} } });
    const res = await asAdmin(app).get('/api/orders');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.5/);
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBeDefined();
  });
});
