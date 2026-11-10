// Order security per AGENTS.md Decisions (#2 login, #3 roles, #5 status workflow).
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';

const { admin, employee } = demoUsers;
const STATUSES = ['Draft', 'Pending', 'Approved', 'Shipped', 'Delivered', 'Cancelled'];
const bearer = (user) =>
  `Bearer ${jwt.sign({ role: user.role }, TEST_JWT_SECRET, { subject: String(user.id), expiresIn: '1h' })}`;

// One order per status: order 1 is Draft, 2 is Pending, ... 6 is Cancelled.
const idOf = (status) => STATUSES.indexOf(status) + 1;

describe('/api/orders security', () => {
  let app;
  let orderModel;

  beforeEach(() => {
    orderModel = createInMemoryOrderModel(
      STATUSES.map((status, i) => ({
        orderId: i + 1,
        ...validOrderBody,
        customerPhone: '4045550123',
        status,
      })),
    );
    app = createApp({
      orderModel,
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
  });

  const patchStatus = (status, as, id) =>
    request(app)
      .patch(`/api/orders/${id}/status`)
      .set('Authorization', bearer(as))
      .send({ status });
  const statusOf = async (id) => (await orderModel.findById(id)).status;

  describe('login is required (401)', () => {
    it.each([
      ['GET', '/api/orders'],
      ['GET', '/api/orders/1'],
      ['POST', '/api/orders'],
      ['PUT', '/api/orders/1'],
      ['PATCH', '/api/orders/1/status'],
      ['DELETE', '/api/orders/1'],
    ])('%s %s without a token', async (method, url) => {
      const res = await request(app)[method.toLowerCase()](url).send({ status: 'Pending' });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toEqual(expect.any(String));
    });

    it('rejects an invalid token', async () => {
      const res = await request(app).get('/api/orders').set('Authorization', 'Bearer forged');
      expect(res.status).toBe(401);
    });

    it('changes nothing when an anonymous request tries to update or delete', async () => {
      await request(app).patch('/api/orders/2/status').send({ status: 'Approved' });
      await request(app).delete('/api/orders/1');
      expect(await statusOf(2)).toBe('Pending');
      expect(await orderModel.findById(1)).not.toBeNull();
    });

    it('refuses to build an app whose orders would be unprotected', () => {
      expect(() => createApp({ orderModel })).toThrow(/userModel/);
    });
  });

  it.each([
    ['admin', admin],
    ['employee', employee],
  ])('lets a logged-in %s list, create and edit orders', async (_role, user) => {
    const auth = bearer(user);
    expect((await request(app).get('/api/orders').set('Authorization', auth)).status).toBe(200);
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', auth)
      .send(validOrderBody);
    expect(created.status).toBe(201);
    const edited = await request(app)
      .put(`/api/orders/${created.body.orderId}`)
      .set('Authorization', auth)
      .send({ ...validOrderBody, customerCity: 'Savannah' });
    expect(edited.status).toBe(200);
  });

  describe('PATCH /api/orders/:id/status', () => {
    it.each([
      ['Draft', 'Pending', employee],
      ['Draft', 'Cancelled', employee],
      ['Pending', 'Cancelled', employee],
      ['Pending', 'Approved', admin],
      ['Pending', 'Cancelled', admin],
      ['Approved', 'Shipped', admin],
      ['Shipped', 'Delivered', admin],
    ])('%s -> %s succeeds (200)', async (from, to, user) => {
      const res = await patchStatus(to, user, idOf(from));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ orderId: idOf(from), status: to });
      expect(await statusOf(idOf(from))).toBe(to);
    });

    it('walks an order through the whole workflow', async () => {
      const id = idOf('Draft');
      expect((await patchStatus('Pending', employee, id)).status).toBe(200);
      expect((await patchStatus('Approved', admin, id)).status).toBe(200);
      expect((await patchStatus('Shipped', admin, id)).status).toBe(200);
      expect((await patchStatus('Delivered', admin, id)).status).toBe(200);
      expect(await statusOf(id)).toBe('Delivered');
    });

    it.each([
      ['Draft', 'Shipped'],
      ['Draft', 'Delivered'],
      ['Draft', 'Approved'],
      ['Pending', 'Draft'],
      ['Approved', 'Pending'],
      ['Approved', 'Cancelled'],
      ['Shipped', 'Cancelled'],
      ['Delivered', 'Draft'],
      ['Delivered', 'Cancelled'],
      ['Cancelled', 'Pending'],
      ['Cancelled', 'Draft'],
    ])(
      '%s -> %s is an invalid transition: 400, unchanged (even for an admin)',
      async (from, to) => {
        const res = await patchStatus(to, admin, idOf(from));
        expect(res.status).toBe(400);
        expect(res.body.error.details.map((d) => d.field)).toEqual(['status']);
        expect(await statusOf(idOf(from))).toBe(from);
      },
    );

    it.each([
      ['Pending', 'Approved'],
      ['Approved', 'Shipped'],
      ['Shipped', 'Delivered'],
    ])('%s -> %s is admin-only: 403 for an employee, unchanged', async (from, to) => {
      const res = await patchStatus(to, employee, idOf(from));
      expect(res.status).toBe(403);
      expect(res.body.error.message).toEqual(expect.any(String));
      expect(await statusOf(idOf(from))).toBe(from);
    });

    it.each([{}, { status: 'Archived' }, { status: '' }])(
      'returns 400 for body %j',
      async (body) => {
        const res = await request(app)
          .patch('/api/orders/1/status')
          .set('Authorization', bearer(admin))
          .send(body);
        expect(res.status).toBe(400);
      },
    );

    it('returns 404 for a missing order', async () => {
      expect((await patchStatus('Pending', admin, 99)).status).toBe(404);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('deletes a Draft order (204)', async () => {
      const res = await request(app).delete('/api/orders/1').set('Authorization', bearer(employee));
      expect(res.status).toBe(204);
      expect(await orderModel.findById(1)).toBeNull();
    });

    it.each(STATUSES.filter((s) => s !== 'Draft'))(
      'returns 409 for a %s order and keeps it',
      async (status) => {
        const res = await request(app)
          .delete(`/api/orders/${idOf(status)}`)
          .set('Authorization', bearer(admin));
        expect(res.status).toBe(409);
        expect(await statusOf(idOf(status))).toBe(status);
      },
    );
  });
});
