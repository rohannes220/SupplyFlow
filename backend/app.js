import express from 'express';
import { createOrderService } from './services/orderService.js';
import { createOrderController } from './controllers/orderController.js';
import { createOrderRoutes } from './routes/orderRoutes.js';
import { createAuthService } from './services/authService.js';
import { createAuthController } from './controllers/authController.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createVendorService } from './services/vendorService.js';
import { createVendorController } from './controllers/vendorController.js';
import { createVendorRoutes } from './routes/vendorRoutes.js';
import { requireAuth } from './middleware/auth.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';

/**
 * Builds the Express app. Dependencies are injected so tests can avoid PostgreSQL.
 * userModel and jwtSecret are required: /api/orders must never be served without login.
 * /api/vendors is mounted when a vendorModel is given; its routes require login too.
 */
export function createApp({ orderModel, userModel, vendorModel, jwtSecret, logger = console }) {
  if (!userModel || !jwtSecret) {
    throw new Error('createApp requires userModel and jwtSecret: /api/orders needs authentication');
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  const authService = createAuthService({ userModel, jwtSecret });
  app.use('/api/auth', createAuthRoutes(createAuthController(authService), authService));

  if (vendorModel) {
    const vendorController = createVendorController(createVendorService(vendorModel));
    app.use('/api/vendors', createVendorRoutes(vendorController, authService));
  }

  // Every order route requires login; per-status role rules live in orderService.
  const orderController = createOrderController(createOrderService(orderModel));
  app.use('/api/orders', requireAuth(authService), createOrderRoutes(orderController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
