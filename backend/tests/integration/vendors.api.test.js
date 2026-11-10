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
import {
  createInMemoryVendorModel,
  validVendorBody,
  vendorRow,
} from '../helpers/inMemoryVendorModel.js';

const { admin, employee } = demoUsers;
const bearer = (user) =>
  `Bearer ${jwt.sign({ role: user.role }, TEST_JWT_SECRET, { subject: String(user.id), expiresIn: '1h' })}`;

describe('/api/vendors', () => {
  let app;
  let vendorModel;

  beforeEach(() => {
    vendorModel = createInMemoryVendorModel([
      vendorRow({ id: 1, name: 'Global Parts Co.', email: 'sarah@globalparts.com' }),
      vendorRow({ id: 2, name: 'Tech Supply LLC', email: 'mike@techsupply.com' }),
      vendorRow({
        id: 3,
        name: 'Industrial Hub',
        email: 'lisa@industrialhub.com',
        status: 'Inactive',
      }),
    ]);
    app = createApp({
      orderModel: createInMemoryOrderModel(),
      userModel: createInMemoryUserModel(),
      vendorModel,
      jwtSecret: TEST_JWT_SECRET,
    });
  });

  const as = (user) => ({
    get: (url) => request(app).get(url).set('Authorization', bearer(user)),
    post: (url, body) => request(app).post(url).set('Authorization', bearer(user)).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', bearer(user)).send(body),
    delete: (url) => request(app).delete(url).set('Authorization', bearer(user)),
  });
  const names = (res) => res.body.map((v) => v.name);
  const newVendor = { ...validVendorBody, email: 'orders@newvendor.com' };

  describe('authentication', () => {
    it.each([
      ['GET', '/api/vendors'],
      ['GET', '/api/vendors/1'],
      ['POST', '/api/vendors'],
      ['PUT', '/api/vendors/1'],
    ])('%s %s returns 401 without a token', async (method, url) => {
      const res = await request(app)[method.toLowerCase()](url).send(newVendor);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toEqual(expect.any(String));
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app).get('/api/vendors').set('Authorization', 'Bearer nope');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/vendors', () => {
    it.each([
      ['admin', admin],
      ['employee', employee],
    ])('lists vendors for an %s', async (_role, user) => {
      const res = await as(user).get('/api/vendors');
      expect(res.status).toBe(200);
      expect(names(res)).toEqual(['Global Parts Co.', 'Industrial Hub', 'Tech Supply LLC']);
      expect(res.body[0]).toEqual({
        id: 1,
        name: 'Global Parts Co.',
        email: 'sarah@globalparts.com',
        phone: '5551234567',
        city: 'Atlanta',
        state: 'GA',
        status: 'Active',
        createdAt: expect.any(String),
      });
    });

    it('searches names case-insensitively with ?search=', async () => {
      const res = await as(employee).get('/api/vendors?search=TECH');
      expect(res.status).toBe(200);
      expect(names(res)).toEqual(['Tech Supply LLC']);
    });

    it('filters by ?status=', async () => {
      const res = await as(employee).get('/api/vendors?status=Inactive');
      expect(names(res)).toEqual(['Industrial Hub']);
    });

    it('combines ?search= and ?status=', async () => {
      expect(names(await as(employee).get('/api/vendors?search=hub&status=Active'))).toEqual([]);
      expect(names(await as(employee).get('/api/vendors?search=hub&status=Inactive'))).toEqual([
        'Industrial Hub',
      ]);
    });

    it('returns 400 for an unknown status filter', async () => {
      const res = await as(employee).get('/api/vendors?status=Deleted');
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toEqual(['status']);
    });
  });

  describe('GET /api/vendors/:id', () => {
    it('returns one vendor to any logged-in user', async () => {
      const res = await as(employee).get('/api/vendors/2');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 2, name: 'Tech Supply LLC' });
    });

    it('returns 404 for a missing vendor', async () => {
      const res = await as(employee).get('/api/vendors/99');
      expect(res.status).toBe(404);
      expect(res.body.error.message).toEqual(expect.any(String));
    });

    it('returns 400 for a malformed id', async () => {
      expect((await as(employee).get('/api/vendors/abc')).status).toBe(400);
    });
  });

  describe('POST /api/vendors', () => {
    it('lets an admin create a vendor: 201, Location header, Active by default', async () => {
      const res = await as(admin).post('/api/vendors', newVendor);
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe('/api/vendors/4');
      expect(res.body).toMatchObject({
        id: 4,
        name: 'Global Parts Co.',
        email: 'orders@newvendor.com',
        phone: '5551234567',
        city: 'Atlanta',
        state: 'GA',
        status: 'Active',
      });
    });

    it('returns 403 for an employee and creates nothing', async () => {
      const res = await as(employee).post('/api/vendors', newVendor);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toEqual(expect.any(String));
      expect(await vendorModel.findById(4)).toBeNull();
    });

    it('returns 400 with per-field details for invalid input', async () => {
      const res = await as(admin).post('/api/vendors', {
        name: '',
        email: 'not-an-email',
        phone: '123',
        city: 'Atlanta',
        state: 'Ontario',
        status: 'Paused',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation/i);
      expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
        'email',
        'name',
        'phone',
        'state',
        'status',
      ]);
    });

    it('returns 409 for a duplicate email', async () => {
      const res = await as(admin).post('/api/vendors', {
        ...validVendorBody,
        email: 'SARAH@globalparts.com',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/email/i);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', bearer(admin))
        .set('Content-Type', 'application/json')
        .send('{"name": ');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/vendors/:id', () => {
    const edit = { ...validVendorBody, email: 'sarah@globalparts.com', city: 'Savannah' };

    it('lets an admin update vendor details', async () => {
      const res = await as(admin).put('/api/vendors/1', edit);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, city: 'Savannah', status: 'Active' });
    });

    it('deactivates a vendor by setting status Inactive', async () => {
      const res = await as(admin).put('/api/vendors/1', { ...edit, status: 'Inactive' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Inactive');
      expect(await vendorModel.isActive(1)).toBe(false);
    });

    it('returns 403 for an employee and changes nothing', async () => {
      const res = await as(employee).put('/api/vendors/1', { ...edit, status: 'Inactive' });
      expect(res.status).toBe(403);
      expect(await vendorModel.findById(1)).toMatchObject({ city: 'Atlanta', status: 'Active' });
    });

    it('returns 404 for a missing vendor', async () => {
      expect((await as(admin).put('/api/vendors/99', edit)).status).toBe(404);
    });

    it('returns 400 with per-field details for invalid input', async () => {
      const res = await as(admin).put('/api/vendors/1', { ...edit, state: 'XX' });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toEqual(['state']);
    });

    it("returns 409 when taking another vendor's email", async () => {
      const res = await as(admin).put('/api/vendors/1', { ...edit, email: 'mike@techsupply.com' });
      expect(res.status).toBe(409);
    });
  });

  it('has no DELETE route: vendors are deactivated, not deleted', async () => {
    const res = await as(admin).delete('/api/vendors/1');
    expect(res.status).toBe(404);
    expect(await vendorModel.findById(1)).not.toBeNull();
  });

  it('refuses to build an app without auth, so vendors and orders are never unprotected', () => {
    expect(() => createApp({ orderModel: createInMemoryOrderModel(), vendorModel })).toThrow(
      /userModel/,
    );
  });

  it('does not mount /api/vendors when no vendorModel is given', async () => {
    const withoutVendors = createApp({
      orderModel: createInMemoryOrderModel(),
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
    const res = await request(withoutVendors)
      .get('/api/vendors')
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
  });
});
