import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { createAuthService } from '../../services/authService.js';
import { createErrorHandler } from '../../middleware/errorHandler.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';

const { admin, employee } = demoUsers;

function tokenFor(user, secret = TEST_JWT_SECRET, options = { expiresIn: '1h' }) {
  return jwt.sign({ sub: String(user.id), role: user.role }, secret, options);
}

/** Minimal app: one route guarded by the given middleware that echoes req.user. */
function buildApp(...guards) {
  const app = express();
  app.get('/protected', ...guards, (req, res) => res.json({ user: req.user }));
  app.use(createErrorHandler({ error() {} }));
  return app;
}

describe('requireAuth', () => {
  let app;

  beforeEach(() => {
    const authService = createAuthService({
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
    app = buildApp(requireAuth(authService));
  });

  it('attaches the user id and role and calls next for a valid Bearer token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor(employee)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: employee.id, role: 'employee' });
  });

  it.each([
    ['no Authorization header', undefined],
    ['an empty Bearer token', 'Bearer '],
    ['a non-Bearer scheme', `Basic ${Buffer.from('admin:pw').toString('base64')}`],
    ['a bare token without the Bearer scheme', tokenFor(admin)],
    ['a malformed token', 'Bearer not.a.jwt'],
    ['a token signed with another secret', `Bearer ${tokenFor(admin, 'other-secret')}`],
    ['an expired token', `Bearer ${tokenFor(admin, TEST_JWT_SECRET, { expiresIn: -10 })}`],
  ])('returns 401 with an error message for %s', async (_label, header) => {
    const req = request(app).get('/protected');
    if (header !== undefined) req.set('Authorization', header);
    const res = await req;

    expect(res.status).toBe(401);
    expect(res.body.error.message).toEqual(expect.any(String));
    expect(res.body.user).toBeUndefined();
  });
});

describe('requireRole', () => {
  // Stands in for requireAuth so these tests isolate the role check.
  const as = (user) => (req, _res, next) => {
    req.user = user && { id: user.id, role: user.role };
    next();
  };

  it("passes an admin through requireRole('admin')", async () => {
    const res = await request(buildApp(as(admin), requireRole('admin'))).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it("returns 403 with an error message for an employee on requireRole('admin')", async () => {
    const res = await request(buildApp(as(employee), requireRole('admin'))).get('/protected');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it('accepts any of several allowed roles', async () => {
    const app = buildApp(as(employee), requireRole('admin', 'employee'));
    expect((await request(app).get('/protected')).status).toBe(200);
  });

  it('returns 401 when no authenticated user is present', async () => {
    const res = await request(buildApp(as(null), requireRole('admin'))).get('/protected');
    expect(res.status).toBe(401);
  });

  it('works end to end behind requireAuth', async () => {
    const authService = createAuthService({
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
    const app = buildApp(requireAuth(authService), requireRole('admin'));

    const asAdmin = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    const asEmployee = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor(employee)}`);
    const anonymous = await request(app).get('/protected');

    expect(asAdmin.status).toBe(200);
    expect(asEmployee.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });
});
