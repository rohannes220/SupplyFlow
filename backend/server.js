import { createApp } from './app.js';
import { createInMemoryOrderModel } from './tests/helpers/inMemoryOrderModel.js';
import { DEMO_ORDERS } from './db/seeds/demoOrders.js';

const port = Number(process.env.PORT) || 4000;

let orderModel;

if (process.env.DATABASE_URL) {
  try {
    const { pool } = await import('./db/pool.js');
    const { createOrderModel } = await import('./models/orderModel.js');
    // Test PostgreSQL connectivity
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL database');
    orderModel = createOrderModel(pool);
  } catch (err) {
    console.warn(`PostgreSQL unavailable (${err.message}). Using in-memory store with demo orders.`);
    orderModel = createInMemoryOrderModel(DEMO_ORDERS);
  }
} else {
  console.log('DATABASE_URL not set. Running with 140 sample orders in memory.');
  orderModel = createInMemoryOrderModel(DEMO_ORDERS);
}

const app = createApp({ orderModel });

app.listen(port, () => console.log(`SupplyFlow API listening on port ${port}`));
