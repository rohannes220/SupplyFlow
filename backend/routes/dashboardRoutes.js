import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * @openapi
 * components:
 *   schemas:
 *     Dashboard:
 *       type: object
 *       properties:
 *         totalOrders: { type: integer, example: 140 }
 *         pendingOrders: { type: integer, description: Orders with status Pending, example: 28 }
 *         activeVendors: { type: integer, description: Vendors with status Active, example: 130 }
 *         totalSpending: { type: number, description: Sum of order amounts excluding Cancelled orders, example: 1234567.8 }
 *         overdueDeliveries:
 *           type: integer
 *           nullable: true
 *           description: >
 *             Orders not Delivered or Cancelled whose expected delivery date is before today (UTC).
 *             null until orders have an expected_delivery_date column.
 *           example: null
 *         ordersByStatus:
 *           type: object
 *           description: Order count for every status (0 when none)
 *           properties:
 *             Draft: { type: integer }
 *             Pending: { type: integer }
 *             Approved: { type: integer }
 *             Shipped: { type: integer }
 *             Delivered: { type: integer }
 *             Cancelled: { type: integer }
 *         recentOrders:
 *           type: array
 *           description: The 5 most recently created orders, newest first
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer, example: 5140 }
 *               vendorId: { type: integer, example: 12 }
 *               amount: { type: number, example: 1234.5 }
 *               status: { type: string, enum: [Draft, Pending, Approved, Shipped, Delivered, Cancelled] }
 */
export function createDashboardRoutes(controller, authService) {
  const router = Router();

  /**
   * @openapi
   * /api/dashboard:
   *   get:
   *     tags: [Dashboard]
   *     summary: Supply chain metrics for the dashboard (any logged-in user)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Metrics, content: { application/json: { schema: { $ref: '#/components/schemas/Dashboard' } } } }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   */
  router.get('/', requireAuth(authService), asyncHandler(controller.get));

  return router;
}
