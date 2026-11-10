import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';
import { createInMemoryVendorModel, vendorRow } from '../helpers/inMemoryVendorModel.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';

const token = jwt.sign({ role: 'employee' }, TEST_JWT_SECRET, {
  subject: String(demoUsers.employee.id),
});

describe('order vendor validation', () => {
  let app;
  let orders;
  let vendors;
  const post = (body) =>
    request(app).post('/api/orders').auth(token, { type: 'bearer' }).send(body);
  const put = (id, body) =>
    request(app).put(`/api/orders/${id}`).auth(token, { type: 'bearer' }).send(body);

  beforeEach(() => {
    vendors = createInMemoryVendorModel([
      vendorRow({ id: 3 }),
      vendorRow({ id: 4, status: 'Inactive', email: 'inactive@example.com' }),
      vendorRow({ id: 5, email: 'other@example.com' }),
    ]);
    orders = createInMemoryOrderModel();
    app = createApp({
      orderModel: orders,
      vendorModel: vendors,
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
  });

  it('accepts an active vendor and rejects inactive and nonexistent vendors', async () => {
    expect((await post(validOrderBody)).status).toBe(201);
    for (const vendorId of [4, 999]) {
      const response = await post({ ...validOrderBody, vendorId });
      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'vendorId' })]),
      );
    }
    expect(await orders.findAll()).toHaveLength(1);
  });

  it('rejects changing the vendor to an inactive or unknown one without changing the order', async () => {
    const created = await post(validOrderBody);
    for (const vendorId of [4, 999]) {
      expect((await put(created.body.orderId, { ...validOrderBody, vendorId })).status).toBe(400);
      expect((await orders.findById(created.body.orderId)).vendorId).toBe(3);
    }
    expect((await put(created.body.orderId, { ...validOrderBody, vendorId: 5 })).status).toBe(200);
  });

  it('preserves an existing vendor reference when that vendor becomes inactive', async () => {
    const created = await post(validOrderBody);
    await vendors.update(3, vendorRow({ id: 3, status: 'Inactive' }));
    const response = await put(created.body.orderId, { ...validOrderBody, customerCity: 'Boston' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ vendorId: 3, customerCity: 'Boston' });
  });
});
