import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Auth]
 *     summary: List users (administrators only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Public user records, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/User' } } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
export function createUserRoutes(controller, authService) {
  const router = Router();
  router.get('/', requireAuth(authService), requireRole('admin'), asyncHandler(controller.list));
  return router;
}
