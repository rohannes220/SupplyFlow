import { createApp } from './app.js';
import { createInMemoryOrderModel } from './tests/helpers/inMemoryOrderModel.js';
import { createInMemoryUserModel } from './tests/helpers/inMemoryUserModel.js';
import { randomBytes } from 'node:crypto';
import { DEMO_ORDERS } from './db/seeds/demoOrders.js';

const port = Number(process.env.PORT) || 4000;

let orderModel;
let userModel;

if (process.env.DATABASE_URL) {
  const { pool } = await import('./db/pool.js');
  const { createOrderModel } = await import('./models/orderModel.js');
  const { createUserModel } = await import('./models/userModel.js');
  await pool.query('SELECT 1');
  console.log('Connected to PostgreSQL database');
  orderModel = createOrderModel(pool);
  userModel = createUserModel(pool);
} else {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be set in production');
  }
  console.log('DATABASE_URL not set. Running with 140 sample orders in memory.');
  orderModel = createInMemoryOrderModel(DEMO_ORDERS);
}

let jwtSecret = process.env.JWT_SECRET;
if (!userModel) {
  console.warn('Using in-memory users (no persistence). Set DATABASE_URL for a real database.');
  userModel = createInMemoryUserModel([]);
  jwtSecret ||= randomBytes(32).toString('hex');
}

const app = createApp({ orderModel, userModel, jwtSecret });

app.listen(port, () => console.log(`SupplyFlow API listening on port ${port}`));
