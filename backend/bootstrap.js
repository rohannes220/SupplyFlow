import { randomBytes } from 'node:crypto';
import { createInMemoryOrderModel } from './tests/helpers/inMemoryOrderModel.js';
import { createInMemoryUserModel } from './tests/helpers/inMemoryUserModel.js';
import { createInMemoryVendorModel } from './tests/helpers/inMemoryVendorModel.js';
import { createInMemoryDashboardModel } from './tests/helpers/inMemoryDashboardModel.js';
import { DEMO_ORDERS } from './db/seeds/demoOrders.js';
import { loadDemoVendors } from './db/seeds/demoVendors.js';

/** Connects to PostgreSQL and returns the database-backed models. Throws if unreachable. */
async function connectPostgres() {
  const { pool } = await import('./db/pool.js');
  const { createOrderModel } = await import('./models/orderModel.js');
  const { createUserModel } = await import('./models/userModel.js');
  const { createVendorModel } = await import('./models/vendorModel.js');
  const { createDashboardModel } = await import('./models/dashboardModel.js');
  await pool.query('SELECT 1');
  return {
    orderModel: createOrderModel(pool),
    userModel: createUserModel(pool),
    vendorModel: createVendorModel(pool),
    dashboardModel: createDashboardModel(pool),
  };
}

/** In-memory vendors from data/vendors.csv, with the same IDs the sample orders reference. */
function createDemoVendorModel() {
  const createdAt = new Date().toISOString();
  return createInMemoryVendorModel(loadDemoVendors().map((v) => ({ ...v, createdAt })));
}

/**
 * IN_MEMORY_DEMO_USERS=true (development and tests only, e.g. the Playwright suite) adds a demo
 * admin and employee to in-memory mode, with passwords from DEMO_ADMIN_PASSWORD and
 * DEMO_EMPLOYEE_PASSWORD. It is refused in production and whenever DATABASE_URL is set, so it
 * can never run against a real database. Returns the seed users, or [] when the option is off.
 */
function inMemoryDemoUsers(env) {
  if (env.IN_MEMORY_DEMO_USERS !== 'true') return [];
  if (env.NODE_ENV === 'production') {
    throw new Error('IN_MEMORY_DEMO_USERS is for development and tests; refusing in production');
  }
  if (env.DATABASE_URL) {
    throw new Error('IN_MEMORY_DEMO_USERS only works in in-memory mode; unset DATABASE_URL');
  }
  for (const key of ['DEMO_ADMIN_PASSWORD', 'DEMO_EMPLOYEE_PASSWORD']) {
    if (!env[key]) throw new Error(`IN_MEMORY_DEMO_USERS requires ${key}`);
  }
  return [
    {
      id: 1,
      name: 'Demo Admin',
      email: 'admin@supplyflow.com',
      role: 'admin',
      password: env.DEMO_ADMIN_PASSWORD,
    },
    {
      id: 2,
      name: 'Demo Employee',
      email: 'employee@supplyflow.com',
      role: 'employee',
      password: env.DEMO_EMPLOYEE_PASSWORD,
    },
  ];
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
  // Checked first: a refused demo-user setup must fail before any database connection.
  const demoUsers = inMemoryDemoUsers(env);

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
      demoUsers.length > 0
        ? 'In-memory mode: 140 sample orders and vendors, demo admin and employee accounts; nothing persists.'
        : 'In-memory mode: 140 sample orders and vendors, no users until you register; nothing persists.',
    );
    const orderModel = createInMemoryOrderModel(DEMO_ORDERS);
    const vendorModel = createDemoVendorModel();
    models = {
      orderModel,
      userModel: createInMemoryUserModel(demoUsers),
      vendorModel,
      // Reads the same in-memory orders and vendors, so it reflects changes made in the app.
      dashboardModel: createInMemoryDashboardModel({ orderModel, vendorModel }),
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
