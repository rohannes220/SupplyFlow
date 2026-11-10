import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';

describe('role-based access', () => {
  let app;
  let admin;
  let employee;
  let other;

  beforeEach(async () => {
    app = createApp({
      orderModel: createInMemoryOrderModel(),
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
    const login = async (user) =>
      (await request(app).post('/api/auth/login').send(user)).body.token;
    admin = await login(demoUsers.admin);
    employee = await login(demoUsers.employee);
    other = (
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Another employee', email: 'another@example.com', password: 'password123' })
    ).body.token;
  });

  it('requires authentication and reserves the user list for admins', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
    expect((await request(app).get('/api/users').auth(employee, { type: 'bearer' })).status).toBe(
      403,
    );
    const list = await request(app).get('/api/users').auth(admin, { type: 'bearer' });
    expect(list.status).toBe(200);
    expect(list.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: demoUsers.employee.email })]),
    );
    expect(list.body.every((user) => !('passwordHash' in user))).toBe(true);
  });

  it('protects another employee’s draft and enforces the approval workflow', async () => {
    const created = await request(app)
      .post('/api/orders')
      .auth(employee, { type: 'bearer' })
      .send(validOrderBody);
    expect(created.status).toBe(201);
    expect(created.body.createdBy).toBe(demoUsers.employee.id);
    const path = `/api/orders/${created.body.orderId}`;
    expect(
      (await request(app).put(path).auth(other, { type: 'bearer' }).send(validOrderBody)).status,
    ).toBe(403);
    expect((await request(app).delete(path).auth(other, { type: 'bearer' })).status).toBe(403);
    expect(
      (
        await request(app).patch(`${path}/status`).auth(employee, { type: 'bearer' }).send({
          status: 'Approved',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app).patch(`${path}/status`).auth(employee, { type: 'bearer' }).send({
          status: 'Pending',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app).patch(`${path}/status`).auth(employee, { type: 'bearer' }).send({
          status: 'Approved',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app).patch(`${path}/status`).auth(admin, { type: 'bearer' }).send({
          status: 'Approved',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app).patch(`${path}/status`).auth(admin, { type: 'bearer' }).send({
          status: 'Draft',
        })
      ).status,
    ).toBe(400);
  });

  it('lets the owner edit and cancel a draft but blocks other users', async () => {
    const created = await request(app)
      .post('/api/orders')
      .auth(employee, { type: 'bearer' })
      .send(validOrderBody);
    const path = `/api/orders/${created.body.orderId}`;
    expect(
      (
        await request(app)
          .put(path)
          .auth(employee, { type: 'bearer' })
          .send({
            ...validOrderBody,
            customerCity: 'Boston',
          })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app).patch(`${path}/status`).auth(other, { type: 'bearer' }).send({
          status: 'Cancelled',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app).patch(`${path}/status`).auth(employee, { type: 'bearer' }).send({
          status: 'Cancelled',
        })
      ).status,
    ).toBe(200);
    expect((await request(app).delete(path).auth(employee, { type: 'bearer' })).status).toBe(409);
  });
});
