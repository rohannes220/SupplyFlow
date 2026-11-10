import { randomBytes } from 'node:crypto';
import { createInMemoryOrderModel } from './tests/helpers/inMemoryOrderModel.js';
import { createInMemoryUserModel } from './tests/helpers/inMemoryUserModel.js';
import { createInMemoryVendorModel } from './tests/helpers/inMemoryVendorModel.js';
import { DEMO_ORDERS } from './db/seeds/demoOrders.js';
import { loadDemoVendors } from './db/seeds/demoVendors.js';

/** Connects to PostgreSQL and returns the database-backed models. Throws if unreachable. */
async function connectPostgres() {
  const { pool } = await import('./db/pool.js');
  const { createOrderModel } = await import('./models/orderModel.js');
  const { createUserModel } = await import('./models/userModel.js');
  const { createVendorModel } = await import('./models/vendorModel.js');
  await pool.query('SELECT 1');
  return {
    orderModel: createOrderModel(pool),
    userModel: createUserModel(pool),
    vendorModel: createVendorModel(pool),
  };
}

/** In-memory vendors from data/vendors.csv, with the same IDs the sample orders reference. */
function createDemoVendorModel() {
  const createdAt = new Date().toISOString();
  return createInMemoryVendorModel(loadDemoVendors().map((v) => ({ ...v, createdAt })));
}

/**
 * Resolves what createApp needs from the environment.
 * Production (NODE_ENV=production) fails fast without a reachable database or JWT_SECRET.
 * Anywhere else, a missing database falls back to in-memory demo data and a missing
 * JWT_SECRET to a random one, so the app runs locally without setup. Nothing persists.
 */
export async function resolveDependencies(
  env = process.env,
  { connect = connectPostgres, logger = console } = {},
) {
  const production = env.NODE_ENV === 'production';

  let models;
  if (env.DATABASE_URL) {
    try {
      models = await connect();
      logger.log('Connected to PostgreSQL database');
    } catch (err) {
      if (production) throw new Error(`Cannot connect to PostgreSQL: ${err.message}`);
      logger.warn(`PostgreSQL unavailable (${err.message}). Using in-memory data.`);
    }
  } else if (production) {
    throw new Error('DATABASE_URL is required in production (see backend/.env.example)');
  } else {
    logger.log('DATABASE_URL not set. Using in-memory data.');
  }

  if (!models) {
    logger.warn(
      'In-memory mode: 140 sample orders and vendors, no users until you register; nothing persists.',
    );
    models = {
      orderModel: createInMemoryOrderModel(DEMO_ORDERS),
      userModel: createInMemoryUserModel([]),
      vendorModel: createDemoVendorModel(),
    };
  }

  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    if (production)
      throw new Error('JWT_SECRET is required in production (see backend/.env.example)');
    jwtSecret = randomBytes(32).toString('hex');
    logger.warn('JWT_SECRET not set. Using a random secret; logins end when the server restarts.');
  }

  return { ...models, jwtSecret };
}
