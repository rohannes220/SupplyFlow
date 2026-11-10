import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '../utils/errors.js';
import { validateOrder, isPositiveInt } from '@supplyflow/shared/orderRules';

const EDITABLE_STATUS = 'Draft';
const TRANSITIONS = {
  Draft: ['Pending', 'Cancelled'],
  Pending: ['Approved', 'Cancelled'],
  Approved: ['Shipped'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

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

export function createOrderService(orderModel) {
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

    async createOrder(body, user) {
      // TODO(#4): verify vendorId refers to an existing, Active vendor.
      return orderModel.create({ ...validateOrderInput(body), createdBy: user.id });
    },

    async updateOrder(rawId, body, user) {
      const existing = await findExisting(rawId);
      if (user.role !== 'admin' && existing.createdBy !== user.id) throw new ForbiddenError();
      const fields = validateOrderInput(body);
      assertEditable(existing, 'edited');
      const updated = await orderModel.update(existing.orderId, fields, existing.status);
      if (!updated) throw new ConflictError('Order changed; refresh and try again');
      return updated;
    },

    async updateOrderStatus(rawId, status, user) {
      const existing = await findExisting(rawId);
      const VALID_STATUSES = ['Draft', 'Pending', 'Approved', 'Shipped', 'Delivered', 'Cancelled'];
      if (!VALID_STATUSES.includes(status)) {
        throw new ValidationError([
          {
            field: 'status',
            message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
          },
        ]);
      }
      if (user.role !== 'admin') {
        if (existing.createdBy !== user.id || !['Pending', 'Cancelled'].includes(status)) {
          throw new ForbiddenError();
        }
      }
      if (!TRANSITIONS[existing.status]?.includes(status)) {
        throw new ValidationError([{ field: 'status', message: 'Invalid status transition' }]);
      }
      const updated = await orderModel.updateStatus(existing.orderId, status, existing.status);
      if (!updated) throw new ConflictError('Order changed; refresh and try again');
      return updated;
    },

    async deleteOrder(rawId, user) {
      const existing = await findExisting(rawId);
      if (user.role !== 'admin' && existing.createdBy !== user.id) throw new ForbiddenError();
      assertEditable(existing, 'deleted');
      const removed = await orderModel.remove(existing.orderId, existing.status);
      if (!removed) throw new ConflictError('Order changed; refresh and try again');
    },
  };
}
