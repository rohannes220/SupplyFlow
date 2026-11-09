import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/**
 * @openapi
 * components:
 *   schemas:
 *     VendorInput:
 *       type: object
 *       additionalProperties: false
 *       required: [name, email, phone, city, state]
 *       properties:
 *         name: { type: string, maxLength: 100, example: Global Parts Co. }
 *         email: { type: string, format: email, maxLength: 255, description: Stored lowercase; must be unique, example: sarah@globalparts.example }
 *         phone: { type: string, description: 10-digit US number in any common format, optional +1, example: (404) 555-0142 }
 *         city: { type: string, maxLength: 100, example: Atlanta }
 *         state: { type: string, description: 2-letter US state, DC or territory code, example: GA }
 *         status: { type: string, enum: [Active, Inactive], description: Defaults to Active on create; unchanged on update when omitted }
 *     Vendor:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         name: { type: string, example: Global Parts Co. }
 *         email: { type: string, example: sarah@globalparts.example }
 *         phone: { type: string, example: '4045550142' }
 *         city: { type: string, example: Atlanta }
 *         state: { type: string, example: GA }
 *         status: { type: string, enum: [Active, Inactive] }
 *         createdAt: { type: string, format: date-time }
 *   responses:
 *     VendorNotFound: { description: Vendor not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *     DuplicateVendorEmail: { description: Another vendor already uses this email, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   parameters:
 *     VendorId: { name: id, in: path, required: true, schema: { type: integer, minimum: 1 } }
 */
export function createVendorRoutes(controller, authService) {
  const router = Router();
  const adminOnly = requireRole('admin');

  // Every vendor endpoint requires login. There is no DELETE: set status Inactive instead.
  router.use(requireAuth(authService));

  /**
   * @openapi
   * /api/vendors:
   *   get:
   *     tags: [Vendors]
   *     summary: List vendors by name (any logged-in user)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { name: search, in: query, schema: { type: string }, description: Matches part of the name, ignoring case }
   *       - { name: status, in: query, schema: { type: string, enum: [Active, Inactive] } }
   *     responses:
   *       200: { description: Vendors, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Vendor' } } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *   post:
   *     tags: [Vendors]
   *     summary: Create a vendor (admin only)
   *     security: [{ bearerAuth: [] }]
   *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/VendorInput' } } } }
   *     responses:
   *       201: { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/Vendor' } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       409: { $ref: '#/components/responses/DuplicateVendorEmail' }
   */
  router.get('/', asyncHandler(controller.list));
  router.post('/', adminOnly, asyncHandler(controller.create));

  /**
   * @openapi
   * /api/vendors/{id}:
   *   get:
   *     tags: [Vendors]
   *     summary: Get one vendor (any logged-in user)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/VendorId' }]
   *     responses:
   *       200: { description: Vendor, content: { application/json: { schema: { $ref: '#/components/schemas/Vendor' } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       404: { $ref: '#/components/responses/VendorNotFound' }
   *   put:
   *     tags: [Vendors]
   *     summary: Update a vendor's details or deactivate it with status Inactive (admin only)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/VendorId' }]
   *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/VendorInput' } } } }
   *     responses:
   *       200: { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/Vendor' } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/VendorNotFound' }
   *       409: { $ref: '#/components/responses/DuplicateVendorEmail' }
   */
  router.get('/:id', asyncHandler(controller.get));
  router.put('/:id', adminOnly, asyncHandler(controller.update));

  return router;
}
