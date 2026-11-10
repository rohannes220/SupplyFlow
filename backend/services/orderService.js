import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../utils/errors.js';
import {
  validateOrder,
  isPositiveInt,
  ORDER_STATUSES,
  canTransition,
  roleCanSetStatus,
} from '@supplyflow/shared/orderRules';

const EDITABLE_STATUS = 'Draft';

/**
 * Validates a create/update payload and returns the normalized order fields.
 * Throws ValidationError listing every problem found.
 */
export function validateOrderInput(body) {
  const { value, errors } = validateOrder(body);
  if (errors.length > 0) throw new ValidationError(errors);
  return value;
}

function parseOrderId(rawId) {
  const id = /^\d+$/.test(String(rawId)) ? Number(rawId) : NaN;
  if (!isPositiveInt(id)) {
    throw new ValidationError([
      { field: 'orderId', message: 'Order ID must be a positive integer' },
    ]);
  }
  return id;
}

export function createOrderService(orderModel, vendorModel) {
  async function assertActiveVendor(vendorId) {
    if (!vendorModel) throw new Error('Vendor model is required to validate orders');
    if (!(await vendorModel.isActive(vendorId))) {
      throw new ValidationError([
        { field: 'vendorId', message: 'Select an existing active vendor' },
      ]);
    }
  }
  async function findExisting(rawId) {
    const id = parseOrderId(rawId);
    const order = await orderModel.findById(id);
    if (!order) throw new NotFoundError(`Order ${id} not found`);
    return order;
  }

  function assertEditable(order, action) {
    if (order.status !== EDITABLE_STATUS) {
      throw new ConflictError(
        `Only ${EDITABLE_STATUS} orders can be ${action}; order is ${order.status}`,
      );
    }
  }

  return {
    listOrders() {
      return orderModel.findAll();
    },

    getOrder(rawId) {
      return findExisting(rawId);
    },

    async createOrder(body) {
      const fields = validateOrderInput(body);
      await assertActiveVendor(fields.vendorId);
      const created = await orderModel.create(fields);
      if (!created) {
        throw new ValidationError([
          { field: 'vendorId', message: 'Select an existing active vendor' },
        ]);
      }
      return created;
    },

    async updateOrder(rawId, body) {
      const existing = await findExisting(rawId);
      const fields = validateOrderInput(body);
      assertEditable(existing, 'edited');
      // TODO(#7): restrict edits to the employee who created the order.
      if (fields.vendorId !== existing.vendorId) await assertActiveVendor(fields.vendorId);
      const updated = await orderModel.update(existing.orderId, fields);
      if (!updated) {
        if (!(await orderModel.findById(existing.orderId))) {
          throw new NotFoundError(`Order ${existing.orderId} not found`);
        }
        throw new ValidationError([
          { field: 'vendorId', message: 'Select an existing active vendor' },
        ]);
      }
      return updated;
    },

    /**
     * Moves an order along the status workflow on behalf of `actor` ({ id, role }).
     * An invalid move is a 400, checked before the role (403), so clients learn the workflow
     * even when they lack permission.
     */
    async updateOrderStatus(rawId, status, actor) {
      const existing = await findExisting(rawId);
      if (!ORDER_STATUSES.includes(status)) {
        throw new ValidationError([
          { field: 'status', message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` },
        ]);
      }
      if (!canTransition(existing.status, status)) {
        throw new ValidationError([
          {
            field: 'status',
            message: `Cannot change status from ${existing.status} to ${status}`,
          },
        ]);
      }
      if (!roleCanSetStatus(actor?.role, status)) {
        throw new ForbiddenError(`Only admins can move an order to ${status}`);
      }
      // TODO(#7): only the order's creator (or an admin) may submit or cancel it, once orders
      // have a created_by column.
      const updated = await orderModel.updateStatus(existing.orderId, status);
      if (!updated) throw new NotFoundError(`Order ${existing.orderId} not found`);
      return updated;
    },

    async deleteOrder(rawId) {
      const existing = await findExisting(rawId);
      assertEditable(existing, 'deleted');
      const removed = await orderModel.remove(existing.orderId);
      if (!removed) throw new NotFoundError(`Order ${existing.orderId} not found`);
    },
  };
}
