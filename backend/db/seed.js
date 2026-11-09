// Run with `pnpm seed` or `npm run seed`. Loads backend/.env if present.
import { pool } from './pool.js';
import { DEMO_ORDERS, seedDemoOrders } from './seeds/demoOrders.js';

try {
  const inserted = await seedDemoOrders(pool);
  console.log(
    `Seeded demo orders: ${inserted} new, ${DEMO_ORDERS.length - inserted} already present.`,
  );
} catch (err) {
  console.error('Error during database seed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
