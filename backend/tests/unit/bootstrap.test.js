import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { resolveDependencies } from '../../bootstrap.js';
import { createAuthService } from '../../services/authService.js';

const quiet = { log() {}, warn: vi.fn() };
const dbModels = { orderModel: { kind: 'pg-orders' }, userModel: { kind: 'pg-users' } };
const connectOk = vi.fn(async () => dbModels);
const connectDown = vi.fn(async () => {
  throw new Error('connect ECONNREFUSED');
});
const PROD = { NODE_ENV: 'production', DATABASE_URL: 'postgres://db', JWT_SECRET: 's3cret' };

describe('resolveDependencies', () => {
  describe('in production', () => {
    it('uses the database and the configured secret', async () => {
      const deps = await resolveDependencies(PROD, { connect: connectOk, logger: quiet });
      expect(deps).toEqual({ ...dbModels, jwtSecret: 's3cret' });
    });

    it('fails when DATABASE_URL is missing', async () => {
      const env = { ...PROD, DATABASE_URL: undefined };
      await expect(resolveDependencies(env, { connect: connectOk, logger: quiet })).rejects.toThrow(
        /DATABASE_URL is required in production/,
      );
    });

    it('fails when the database is unreachable instead of falling back to memory', async () => {
      await expect(
        resolveDependencies(PROD, { connect: connectDown, logger: quiet }),
      ).rejects.toThrow(/Cannot connect to PostgreSQL: connect ECONNREFUSED/);
    });

    it('fails when JWT_SECRET is missing instead of generating one', async () => {
      const env = { ...PROD, JWT_SECRET: '' };
      await expect(resolveDependencies(env, { connect: connectOk, logger: quiet })).rejects.toThrow(
        /JWT_SECRET is required in production/,
      );
    });
  });

  describe('outside production', () => {
    it('falls back to in-memory models and a random secret without any setup', async () => {
      const connect = vi.fn(async () => dbModels);
      const deps = await resolveDependencies({}, { connect, logger: quiet });

      expect(connect).not.toHaveBeenCalled();
      expect(deps.jwtSecret).toMatch(/^[0-9a-f]{64}$/);
      expect((await deps.orderModel.findAll()).length).toBe(140);
      expect(await deps.userModel.findByEmail('admin@supplyflow.com')).toBeNull();
    });

    it('loads the in-memory vendors from data/vendors.csv with their IDs', async () => {
      const { vendorModel, orderModel } = await resolveDependencies({}, { logger: quiet });

      const vendors = await vendorModel.findAll();
      expect(vendors).toHaveLength(140);
      expect(await vendorModel.findById(1)).toMatchObject({
        id: 1,
        name: 'Highland Plumbing Services',
        phone: '7815559024',
        state: 'MA',
        status: 'Active',
        createdAt: expect.any(String),
      });
      expect(await vendorModel.findAll({ status: 'Inactive' })).toHaveLength(10);
      // Every sample order points at a vendor that exists.
      for (const order of await orderModel.findAll()) {
        expect(await vendorModel.findById(order.vendorId)).not.toBeNull();
      }
    });

    it('provides an in-memory dashboard model over the same orders and vendors', async () => {
      const { dashboardModel, orderModel } = await resolveDependencies({}, { logger: quiet });

      const metrics = await dashboardModel.getMetrics({ today: '2026-11-10' });
      expect(metrics).toMatchObject({ totalOrders: 140, pendingOrders: 28, activeVendors: 130 });
      expect(metrics.overdueDeliveries).toBeNull();

      await orderModel.create({
        vendorId: 1,
        orderAmount: 10,
        customerName: 'Sarah Chen',
        customerCity: 'Atlanta',
        customerState: 'GA',
        customerPhone: '4045550123',
      });
      expect((await dashboardModel.getMetrics({ today: '2026-11-10' })).totalOrders).toBe(141);
    });

    it('generates a different secret each start', async () => {
      const a = await resolveDependencies({}, { logger: quiet });
      const b = await resolveDependencies({}, { logger: quiet });
      expect(a.jwtSecret).not.toBe(b.jwtSecret);
    });

    it('falls back to memory with a warning when the database is unreachable', async () => {
      const logger = { log() {}, warn: vi.fn() };
      const deps = await resolveDependencies(
        { NODE_ENV: 'development', DATABASE_URL: 'postgres://db', JWT_SECRET: 'dev' },
        { connect: connectDown, logger },
      );
      expect(deps.jwtSecret).toBe('dev');
      expect(deps.orderModel).not.toBe(dbModels.orderModel);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/PostgreSQL unavailable/));
    });

    it('uses the database when it is reachable', async () => {
      const deps = await resolveDependencies(
        { DATABASE_URL: 'postgres://db', JWT_SECRET: 'dev' },
        { connect: connectOk, logger: quiet },
      );
      expect(deps).toEqual({ ...dbModels, jwtSecret: 'dev' });
    });
  });

  // Dev/test-only option (used by the Playwright suite): in-memory mode with a known admin and
  // employee, so admin flows can run without a database.
  describe('IN_MEMORY_DEMO_USERS', () => {
    const DEMO = {
      IN_MEMORY_DEMO_USERS: 'true',
      DEMO_ADMIN_PASSWORD: 'e2e-admin-password',
      DEMO_EMPLOYEE_PASSWORD: 'e2e-employee-password',
      JWT_SECRET: 'e2e-secret',
    };

    it('seeds the demo admin and employee with the given passwords', async () => {
      const { userModel } = await resolveDependencies(DEMO, { logger: quiet });

      const admin = await userModel.findByEmail('admin@supplyflow.com');
      const employee = await userModel.findByEmail('employee@supplyflow.com');
      expect(admin).toMatchObject({ name: 'Demo Admin', role: 'admin' });
      expect(employee).toMatchObject({ name: 'Demo Employee', role: 'employee' });
      expect(await bcrypt.compare('e2e-admin-password', admin.passwordHash)).toBe(true);
      expect(await bcrypt.compare('e2e-employee-password', employee.passwordHash)).toBe(true);
      expect(await bcrypt.compare('e2e-admin-password', employee.passwordHash)).toBe(false);
    });

    it('lets the seeded accounts log in and new accounts register alongside them', async () => {
      const deps = await resolveDependencies(DEMO, { logger: quiet });
      const auth = createAuthService({ userModel: deps.userModel, jwtSecret: deps.jwtSecret });

      const { user } = await auth.login({
        email: 'admin@supplyflow.com',
        password: 'e2e-admin-password',
      });
      expect(user.role).toBe('admin');
      const registered = await auth.register({
        name: 'New Person',
        email: 'new@example.com',
        password: 'a-new-password',
      });
      expect(registered.user).toMatchObject({ role: 'employee' });
      expect((await deps.userModel.listPublic()).map((u) => u.id)).toHaveLength(3);
      expect(new Set((await deps.userModel.listPublic()).map((u) => u.id)).size).toBe(3);
    });

    it('keeps the in-memory sample orders and vendors', async () => {
      const { orderModel, vendorModel } = await resolveDependencies(DEMO, { logger: quiet });
      expect(await orderModel.findAll()).toHaveLength(140);
      expect(await vendorModel.findAll()).toHaveLength(140);
    });

    it('is refused in production, before touching any database', async () => {
      const connect = vi.fn(async () => dbModels);
      await expect(
        resolveDependencies(
          { ...DEMO, NODE_ENV: 'production', DATABASE_URL: 'postgres://db' },
          { connect, logger: quiet },
        ),
      ).rejects.toThrow(/IN_MEMORY_DEMO_USERS.*production/);
      expect(connect).not.toHaveBeenCalled();
    });

    it('is refused when DATABASE_URL is set, so it never connects to a real database', async () => {
      const connect = vi.fn(async () => dbModels);
      await expect(
        resolveDependencies({ ...DEMO, DATABASE_URL: 'postgres://db' }, { connect, logger: quiet }),
      ).rejects.toThrow(/IN_MEMORY_DEMO_USERS.*DATABASE_URL/);
      expect(connect).not.toHaveBeenCalled();
    });

    it.each(['DEMO_ADMIN_PASSWORD', 'DEMO_EMPLOYEE_PASSWORD'])('requires %s', async (key) => {
      await expect(resolveDependencies({ ...DEMO, [key]: '' }, { logger: quiet })).rejects.toThrow(
        new RegExp(key),
      );
    });

    it('leaves in-memory mode without users unless set to "true"', async () => {
      for (const value of [undefined, '', 'false', '0']) {
        const { userModel } = await resolveDependencies(
          { ...DEMO, IN_MEMORY_DEMO_USERS: value },
          { logger: quiet },
        );
        expect(await userModel.listPublic()).toEqual([]);
      }
    });
  });
});
