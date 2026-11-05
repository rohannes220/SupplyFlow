import { Router } from 'express';

// Express 4 does not forward rejected promises to error middleware on its own.
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

/**
 * @openapi
 * components:
 *   schemas:
 *     OrderInput:
 *       type: object
 *       additionalProperties: false
 *       required: [vendorId, orderAmount, customerName, customerCity, customerState, customerPhone]
 *       properties:
 *         vendorId: { type: integer, minimum: 1, example: 3 }
 *         orderAmount: { type: number, exclusiveMinimum: 0, maximum: 9999999999.99, multipleOf: 0.01, example: 2250.5 }
 *         customerName: { type: string, maxLength: 100, example: Sarah Chen }
 *         customerCity: { type: string, maxLength: 100, example: Atlanta }
 *         customerState: { type: string, description: US state code or name (50 states + DC), example: GA }
 *         customerPhone: { type: string, description: 10-digit US number, optional +1, example: (404) 555-0123 }
 *         customerCountry: { type: string, description: Optional; must be US. Not stored., example: US }
 *     Order:
 *       type: object
 *       properties:
 *         orderId: { type: integer, example: 1 }
 *         vendorId: { type: integer, example: 3 }
 *         orderAmount: { type: number, example: 2250.5 }
 *         customerName: { type: string, example: Sarah Chen }
 *         customerCity: { type: string, example: Atlanta }
 *         customerState: { type: string, example: GA }
 *         customerPhone: { type: string, example: '4045550123' }
 *         status: { type: string, enum: [Draft, Pending, Approved, Shipped, Delivered, Cancelled] }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             message: { type: string }
 *             details:
 *               type: array
 *               items:
 *                 type: object
 *                 properties: { field: { type: string }, message: { type: string } }
 *   responses:
 *     BadRequest: { description: Invalid input or international order, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *     NotFound: { description: Order not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *     Conflict: { description: Order is no longer Draft, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   parameters:
 *     OrderId: { name: id, in: path, required: true, schema: { type: integer, minimum: 1 } }
 */
export function createOrderRoutes(controller) {
  const router = Router();

  /**
   * @openapi
   * /api/orders:
   *   get:
   *     tags: [Orders]
   *     summary: List orders, newest first
   *     responses:
   *       200: { description: Orders, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Order' } } } } }
   *   post:
   *     tags: [Orders]
   *     summary: Create a Draft order (US customers only)
   *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/OrderInput' } } } }
   *     responses:
   *       201: { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   */
  router.get('/', wrap(controller.list));
  router.post('/', wrap(controller.create));

  /**
   * @openapi
   * /api/orders/{id}:
   *   get:
   *     tags: [Orders]
   *     summary: Get one order
   *     parameters: [{ $ref: '#/components/parameters/OrderId' }]
   *     responses:
   *       200: { description: Order, content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       404: { $ref: '#/components/responses/NotFound' }
   *   put:
   *     tags: [Orders]
   *     summary: Replace a Draft order's fields
   *     parameters: [{ $ref: '#/components/parameters/OrderId' }]
   *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/OrderInput' } } } }
   *     responses:
   *       200: { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       404: { $ref: '#/components/responses/NotFound' }
   *       409: { $ref: '#/components/responses/Conflict' }
   *   delete:
   *     tags: [Orders]
   *     summary: Delete a Draft order
   *     parameters: [{ $ref: '#/components/parameters/OrderId' }]
   *     responses:
   *       204: { description: Deleted }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       404: { $ref: '#/components/responses/NotFound' }
   *       409: { $ref: '#/components/responses/Conflict' }
   */
  router.get('/:id', wrap(controller.get));
  router.put('/:id', wrap(controller.update));
  router.delete('/:id', wrap(controller.remove));

  return router;
}
