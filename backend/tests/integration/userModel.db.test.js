// Runs against a real PostgreSQL database only when TEST_DATABASE_URL is set.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { createUserModel } from '../../models/userModel.js';
import { seedDemoUsers } from '../../db/seeds/demoUsers.js';
import { randomBytes } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('userModel (PostgreSQL)', () => {
  let pool;
  let model;
  let adminPool;
  const schema = `user_test_${randomBytes(8).toString('hex')}`;
  const insert = (email, role = 'employee') =>
    pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Test User', email, 'not-a-real-hash', role],
    );

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: url });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    const sql = await readFile(
      new URL('../../db/migrations/002_create_users.sql', import.meta.url),
      'utf8',
    );
    await pool.query(sql);
    model = createUserModel(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE users RESTART IDENTITY');
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminPool.end();
    }
  });

  it('finds a user by email and by id, mapping columns to camelCase', async () => {
    const { rows } = await insert('sam@supplyflow.com', 'admin');
    const byEmail = await model.findByEmail('sam@supplyflow.com');

    expect(byEmail).toEqual({
      id: rows[0].id,
      name: 'Test User',
      email: 'sam@supplyflow.com',
      role: 'admin',
      passwordHash: 'not-a-real-hash',
    });
    expect(await model.findById(rows[0].id)).toEqual(byEmail);
  });

  it('returns null for unknown users', async () => {
    expect(await model.findByEmail('nobody@supplyflow.com')).toBeNull();
    expect(await model.findById(999)).toBeNull();
  });

  it('enforces unique emails', async () => {
    await insert('dup@supplyflow.com');
    await expect(insert('dup@supplyflow.com')).rejects.toMatchObject({ code: '23505' });
  });

  it("only allows the 'admin' and 'employee' roles", async () => {
    await expect(insert('boss@supplyflow.com', 'superuser')).rejects.toMatchObject({
      code: '23514',
    });
  });

  describe('seedDemoUsers', () => {
    const passwords = { adminPassword: 'Seed#Admin1', employeePassword: 'Seed#Employee1' };

    it('creates the admin and employee demo accounts with bcrypt-hashed passwords', async () => {
      await seedDemoUsers(pool, passwords);

      const seededAdmin = await model.findByEmail('admin@supplyflow.com');
      const seededEmployee = await model.findByEmail('employee@supplyflow.com');
      expect(seededAdmin.role).toBe('admin');
      expect(seededEmployee.role).toBe('employee');
      expect(await bcrypt.compare(passwords.adminPassword, seededAdmin.passwordHash)).toBe(true);
      expect(await bcrypt.compare(passwords.employeePassword, seededEmployee.passwordHash)).toBe(
        true,
      );
    });

    it('is safe to run more than once', async () => {
      await seedDemoUsers(pool, passwords);
      await seedDemoUsers(pool, passwords);
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
      expect(rows[0].n).toBe(2);
    });

    it('refuses to seed without passwords', async () => {
      await expect(seedDemoUsers(pool, {})).rejects.toThrow(/password/i);
    });
  });
});
