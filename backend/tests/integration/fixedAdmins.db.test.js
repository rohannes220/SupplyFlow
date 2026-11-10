import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('fixed administrator identities', () => {
  const schema = `fixed_admin_test_${randomBytes(8).toString('hex')}`;
  let adminPool;
  let pool;
  let firstId;
  let secondId;

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: url });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await pool.query(
      await readFile(new URL('../../db/migrations/002_create_users.sql', import.meta.url), 'utf8'),
    );
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('One', 'one@example.com', 'hash', 'admin'), ('Two', 'two@example.com', 'hash', 'admin'), ('Other', 'other@example.com', 'hash', 'employee') RETURNING id",
    );
    [firstId, secondId] = rows.map((row) => row.id);
    await pool.query(
      "SELECT set_config('supplyflow.admin_email_1', $1, false), set_config('supplyflow.admin_email_2', $2, false)",
      ['one@example.com', 'two@example.com'],
    );
    await pool.query(
      await readFile(new URL('../../db/migrations/004_fixed_admins.sql', import.meta.url), 'utf8'),
    );
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminPool.end();
    }
  });

  it('only allows the designated accounts to be administrators', async () => {
    const result = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id");
    expect(result.rows.map((row) => row.id)).toEqual([firstId, secondId]);
    await expect(
      pool.query("UPDATE users SET role = 'admin' WHERE email = 'other@example.com'"),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ('Other admin', 'third@example.com', 'hash', 'admin')",
      ),
    ).rejects.toThrow();
    const other = await pool.query("SELECT role FROM users WHERE email = 'other@example.com'");
    expect(other.rows[0].role).toBe('employee');
  });

  it('does not allow the configured administrator identities to be replaced', async () => {
    await expect(pool.query('DELETE FROM admin_identities')).rejects.toThrow();
    await expect(pool.query('TRUNCATE admin_identities')).rejects.toThrow();
    await expect(
      pool.query("UPDATE users SET email = 'changed@example.com' WHERE id = $1", [firstId]),
    ).rejects.toThrow();
  });
});
