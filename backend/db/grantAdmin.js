import { pool } from './pool.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || process.argv.length !== 3) {
  console.error('Usage: pnpm --filter supplyflow-backend admin:grant <existing-user-email>');
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exitCode = 1;
} else {
  try {
    const result = await pool.query(
      `UPDATE users SET role = 'admin', updated_at = now()
       WHERE email = $1 AND EXISTS (
         SELECT 1 FROM admin_identities WHERE user_id = users.id AND email = users.email
       )
       RETURNING id, name, email`,
      [email],
    );
    if (result.rowCount !== 1) {
      console.error('Account not found or not one of the two designated administrators.');
      process.exitCode = 1;
    } else {
      console.log(
        `Administrator access granted to ${result.rows[0].name} (${result.rows[0].email}).`,
      );
    }
  } finally {
    await pool.end();
  }
}
