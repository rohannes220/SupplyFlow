import express from 'express';
import { createOrderService } from './services/orderService.js';
import { createOrderController } from './controllers/orderController.js';
import { createOrderRoutes } from './routes/orderRoutes.js';
import { createAuthService } from './services/authService.js';
import { createAuthController } from './controllers/authController.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { createUserService } from './services/userService.js';
import { createUserController } from './controllers/userController.js';
import { createUserRoutes } from './routes/userRoutes.js';

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
    app.use(
      '/api/users',
      createUserRoutes(createUserController(createUserService(userModel)), authService),
    );
    const orderController = createOrderController(createOrderService(orderModel));
    app.use('/api/orders', requireAuth(authService), createOrderRoutes(orderController));
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
