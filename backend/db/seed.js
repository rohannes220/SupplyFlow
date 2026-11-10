// Run with `pnpm seed` or `npm run seed`. Loads backend/.env if present.
// Order: users, then vendors (orders reference vendor IDs 1-140), then orders.
import { pool } from './pool.js';
import { seedDemoUsers } from './seeds/demoUsers.js';
import { seedDemoVendors } from './seeds/demoVendors.js';
import { DEMO_ORDERS, seedDemoOrders } from './seeds/demoOrders.js';

try {
  await seedDemoUsers(pool, {
    employeePassword: process.env.SEED_EMPLOYEE_PASSWORD,
  });
  const inserted = await seedDemoOrders(pool);
  console.log('Seeded demo user: employee@supplyflow.com');
  console.log(
    `Seeded demo orders: ${ordersInserted} new, ${DEMO_ORDERS.length - ordersInserted} already present.`,
  );
} catch (err) {
  console.error('Error during database seed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
