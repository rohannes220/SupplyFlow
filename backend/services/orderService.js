import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import { validateOrder, isPositiveInt } from '@supplyflow/shared/orderRules';

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

    async createOrder(body) {
      // TODO(#4): verify vendorId refers to an existing, Active vendor.
      return orderModel.create(validateOrderInput(body));
    },

    async updateOrder(rawId, body) {
      const existing = await findExisting(rawId);
      const fields = validateOrderInput(body);
      assertEditable(existing, 'edited');
      // TODO(#7): restrict edits to the employee who created the order.
      const updated = await orderModel.update(existing.orderId, fields);
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
