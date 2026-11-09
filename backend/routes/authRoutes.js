import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
 *   schemas:
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email, example: admin@supplyflow.com }
 *         password: { type: string, format: password }
 *     User:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         name: { type: string, example: Demo Admin }
 *         email: { type: string, format: email, example: admin@supplyflow.com }
 *         role: { type: string, enum: [admin, employee] }
 *     LoginResult:
 *       type: object
 *       properties:
 *         token: { type: string, description: JWT to send as "Authorization: Bearer <token>" }
 *         user: { $ref: '#/components/schemas/User' }
 *   responses:
 *     Unauthorized: { description: Missing, invalid or expired credentials, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *     Forbidden: { description: Role not allowed to perform this action, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
export function createAuthRoutes(controller, authService) {
  const router = Router();

  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Log in with email and password
   *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/LoginInput' } } } }
   *     responses:
   *       200: { description: Logged in, content: { application/json: { schema: { $ref: '#/components/schemas/LoginResult' } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   */
  router.post('/login', asyncHandler(controller.login));

  /**
   * @openapi
   * /api/auth/me:
   *   get:
   *     tags: [Auth]
   *     summary: Get the logged-in user
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Current user, content: { application/json: { schema: { $ref: '#/components/schemas/User' } } } }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   */
  router.get('/me', requireAuth(authService), asyncHandler(controller.me));

  return router;
}
