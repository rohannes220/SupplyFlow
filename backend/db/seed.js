// Run with `pnpm seed`, which loads backend/.env. Requires the migrations to have run.
import { pool } from './pool.js';
import { seedDemoUsers } from './seeds/demoUsers.js';

try {
  await seedDemoUsers(pool, {
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    employeePassword: process.env.SEED_EMPLOYEE_PASSWORD,
  });
  console.log('seeded demo users: admin@supplyflow.com, employee@supplyflow.com');
} finally {
  await pool.end();
}
