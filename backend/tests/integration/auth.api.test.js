import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel } from '../helpers/inMemoryOrderModel.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';

const { admin, employee } = demoUsers;

describe('/api/auth', () => {
  let app;

  beforeEach(() => {
    app = createApp({
      orderModel: createInMemoryOrderModel(),
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
  });

  const login = (body) => request(app).post('/api/auth/login').send(body);

  describe('POST /api/auth/login', () => {
    it.each([
      ['admin', admin],
      ['employee', employee],
    ])('returns 200 with a JWT and the %s user for valid credentials', async (_role, user) => {
      const res = await login({ email: user.email, password: user.password });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
      expect(jwt.verify(res.body.token, TEST_JWT_SECRET)).toMatchObject({
        sub: String(user.id),
        role: user.role,
      });
    });

    it('does not include the password hash in the response', async () => {
      const res = await login({ email: admin.email, password: admin.password });
      expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/i);
    });

    it('returns 401 with an error message for a wrong password', async () => {
      const res = await login({ email: admin.email, password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toEqual(expect.any(String));
      expect(res.body.token).toBeUndefined();
    });

    it('returns 401 with the same message for an unknown email', async () => {
      const wrongPassword = await login({ email: admin.email, password: 'wrong-password' });
      const unknownEmail = await login({ email: 'ghost@supplyflow.com', password: 'whatever' });

      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
      expect(unknownEmail.body.token).toBeUndefined();
    });

    it.each([
      ['an empty body', {}, ['email', 'password']],
      ['a missing password', { email: admin.email }, ['password']],
      ['a missing email', { password: admin.password }, ['email']],
    ])('returns 400 with per-field details for %s', async (_label, body, fields) => {
      const res = await login(body);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toEqual(expect.any(String));
      expect(res.body.error.details.map((d) => d.field).sort()).toEqual(fields);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user for a valid token', async () => {
      const { body } = await login({ email: employee.email, password: employee.password });
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: 'employee',
      });
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toEqual(expect.any(String));
    });

    it.each([
      ['a malformed token', 'Bearer garbage'],
      [
        'a token signed with another secret',
        `Bearer ${jwt.sign({ sub: String(admin.id), role: 'admin' }, 'other-secret')}`,
      ],
      [
        'an expired token',
        `Bearer ${jwt.sign({ sub: String(admin.id), role: 'admin' }, TEST_JWT_SECRET, { expiresIn: -10 })}`,
      ],
    ])('returns 401 for %s', async (_label, header) => {
      const res = await request(app).get('/api/auth/me').set('Authorization', header);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toEqual(expect.any(String));
    });

    it('returns 401 for a valid token whose user no longer exists', async () => {
      const token = jwt.sign({ sub: '999', role: 'admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });
});
