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
      pool
        .query(
          "INSERT INTO users (name, email, password_hash, role) VALUES ('Other', 'late@example.com', 'hash', 'employee') RETURNING id",
        )
        .then(async ({ rows }) =>
          pool.query('INSERT INTO admin_identities (user_id, email) VALUES ($1, $2)', [
            rows[0].id,
            'late@example.com',
          ]),
        ),
    ).rejects.toThrow();
    await expect(
      pool.query("UPDATE users SET email = 'changed@example.com' WHERE id = $1", [firstId]),
    ).rejects.toThrow();
  });

  it('can demote and restore only a designated account and reapply the migration', async () => {
    await pool.query("UPDATE users SET role = 'employee' WHERE id = $1", [secondId]);
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [secondId]);
    await pool.query(
      await readFile(new URL('../../db/migrations/004_fixed_admins.sql', import.meta.url), 'utf8'),
    );
    const result = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id");
    expect(result.rows.map((row) => row.id)).toEqual([firstId, secondId]);
  });

  it('refuses to initialize if another account is already an admin', async () => {
    const otherSchema = `extra_admin_test_${randomBytes(8).toString('hex')}`;
    await adminPool.query(`CREATE SCHEMA "${otherSchema}"`);
    const otherPool = new pg.Pool({
      connectionString: url,
      options: `-c search_path=${otherSchema}`,
    });
    try {
      await otherPool.query(
        await readFile(
          new URL('../../db/migrations/002_create_users.sql', import.meta.url),
          'utf8',
        ),
      );
      await otherPool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ('One', 'one@example.com', 'hash', 'employee'), ('Two', 'two@example.com', 'hash', 'employee'), ('Third', 'third@example.com', 'hash', 'admin')",
      );
      await otherPool.query(
        "SELECT set_config('supplyflow.admin_email_1', $1, false), set_config('supplyflow.admin_email_2', $2, false)",
        ['one@example.com', 'two@example.com'],
      );
      await expect(
        otherPool.query(
          await readFile(
            new URL('../../db/migrations/004_fixed_admins.sql', import.meta.url),
            'utf8',
          ),
        ),
      ).rejects.toThrow(/existing administrator/i);
      const { rows } = await otherPool.query(
        "SELECT role FROM users WHERE email = 'third@example.com'",
      );
      expect(rows[0].role).toBe('admin');
    } finally {
      await otherPool.end();
      await adminPool.query(`DROP SCHEMA IF EXISTS "${otherSchema}" CASCADE`);
    }
  });
});
