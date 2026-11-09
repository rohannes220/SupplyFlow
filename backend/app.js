import express from 'express';
import { createOrderService } from './services/orderService.js';
import { createOrderController } from './controllers/orderController.js';
import { createOrderRoutes } from './routes/orderRoutes.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';

/** Builds the Express app. Dependencies are injected so tests can avoid PostgreSQL. */
export function createApp({ orderModel, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // TODO(#2): require a valid JWT on /api/orders.
  // TODO(#3): enforce Admin/Employee permissions per action.
  const orderController = createOrderController(createOrderService(orderModel));
  app.use('/api/orders', createOrderRoutes(orderController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
