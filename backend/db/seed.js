// Run with `pnpm seed`, which loads backend/.env. Requires the migrations to have run.
import { pool } from './pool.js';
import { seedDemoUsers } from './seeds/demoUsers.js';
import { DEMO_VENDORS, seedDemoVendors } from './seeds/demoVendors.js';

try {
  await seedDemoUsers(pool, {
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    employeePassword: process.env.SEED_EMPLOYEE_PASSWORD,
  });
  console.log('seeded demo users: admin@supplyflow.com, employee@supplyflow.com');

  const inserted = await seedDemoVendors(pool);
  console.log(
    `seeded demo vendors: ${inserted} new, ${DEMO_VENDORS.length - inserted} already present`,
  );
} finally {
  await pool.end();
}
