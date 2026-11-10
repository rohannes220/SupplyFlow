import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

const DEMO_ACCOUNTS = [
  {
    name: 'Demo Employee',
    email: 'employee@supplyflow.com',
    role: 'employee',
    passwordKey: 'employeePassword',
  },
];

/**
 * Creates the demo employee account. Safe to re-run: an existing demo account's
 * name, role and password are reset to the seeded values.
 */
export async function seedDemoUsers(db, passwords) {
  for (const { passwordKey } of DEMO_ACCOUNTS) {
    if (!passwords?.[passwordKey]) throw new Error(`Seed password "${passwordKey}" is required`);
  }

  for (const { name, email, role, passwordKey } of DEMO_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(passwords[passwordKey], BCRYPT_COST);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role, updated_at = now()`,
      [name, email, passwordHash, role],
    );
  }
}
