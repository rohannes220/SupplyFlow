import { describe, it, expect, vi } from 'vitest';
import { resolveDependencies } from '../../bootstrap.js';

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
});
