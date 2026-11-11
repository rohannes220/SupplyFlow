import express from 'express';
import { createOrderService } from './services/orderService.js';
import { createOrderController } from './controllers/orderController.js';
import { createOrderRoutes } from './routes/orderRoutes.js';
import { createAuthService } from './services/authService.js';
import { createAuthController } from './controllers/authController.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';

/**
 * Builds the Express app. Dependencies are injected so tests can avoid PostgreSQL.
 * /api/auth is mounted only when a userModel is given; it then requires jwtSecret.
 */
export function createApp({ orderModel, userModel, jwtSecret, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  if (userModel) {
    const authService = createAuthService({ userModel, jwtSecret });
    app.use('/api/auth', createAuthRoutes(createAuthController(authService), authService));
  }

  // TODO(#2): protect /api/orders with requireAuth (middleware/auth.js) once the orders branch merges.
  // TODO(#3): apply requireRole per order action (e.g. approval is admin-only).
  const orderController = createOrderController(createOrderService(orderModel));
  app.use('/api/orders', createOrderRoutes(orderController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
