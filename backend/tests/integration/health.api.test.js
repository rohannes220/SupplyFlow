// Render polls GET /api/health to decide whether a deploy is live; it sends no token.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel } from '../helpers/inMemoryOrderModel.js';
import { createInMemoryUserModel, TEST_JWT_SECRET } from '../helpers/inMemoryUserModel.js';

const app = createApp({
  orderModel: createInMemoryOrderModel(),
  userModel: createInMemoryUserModel(),
  jwtSecret: TEST_JWT_SECRET,
});

describe('GET /api/health', () => {
  it('returns 200 { status: "ok" } without a token', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('is never cached, so a health check always reaches the server', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('does not open up the protected routes', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
  });
});
