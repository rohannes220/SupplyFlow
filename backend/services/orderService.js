import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import { normalizeUsState, normalizeUsPhone, isUsCountry } from '../utils/usLocations.js';

const MAX_ORDER_AMOUNT = 9_999_999_999.99; // NUMERIC(12, 2)
const MAX_INT = 2_147_483_647; // PostgreSQL INTEGER
const MAX_TEXT_LENGTH = 100;
const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;
const EDITABLE_STATUS = 'Draft';

const REQUIRED_FIELDS = [
  'vendorId',
  'orderAmount',
  'customerName',
  'customerCity',
  'customerState',
  'customerPhone',
];
// Accepted on input for clarity but never stored: only US orders exist.
const OPTIONAL_FIELDS = ['customerCountry'];
const ALLOWED_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

function isPositiveInt(value, max = MAX_INT) {
  return Number.isInteger(value) && value > 0 && value <= max;
}

function hasAtMostTwoDecimals(value) {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

function validateText(value, field, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, message: `${label} is required` });
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH) {
    errors.push({ field, message: `${label} must be at most ${MAX_TEXT_LENGTH} characters` });
  } else if (!NAME_PATTERN.test(trimmed)) {
    errors.push({
      field,
      message: `${label} may contain only letters, spaces, periods, apostrophes, and hyphens`,
    });
  }
  return trimmed;
}

/**
 * Validates a create/update payload and returns the normalized order fields.
 * Throws ValidationError listing every problem found.
 */
export function validateOrderInput(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError([{ field: 'body', message: 'Request body must be a JSON object' }]);
  }

  const errors = [];
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push({ field: key, message: `Unknown field "${key}"` });
  }

  const { vendorId, orderAmount, customerState, customerPhone, customerCountry } = body;

  if (!isPositiveInt(vendorId)) {
    errors.push({ field: 'vendorId', message: 'Vendor ID must be a positive integer' });
  }

  if (typeof orderAmount !== 'number' || !Number.isFinite(orderAmount) || orderAmount <= 0) {
    errors.push({ field: 'orderAmount', message: 'Order amount must be a number greater than 0' });
  } else if (orderAmount > MAX_ORDER_AMOUNT) {
    errors.push({
      field: 'orderAmount',
      message: `Order amount must not exceed ${MAX_ORDER_AMOUNT}`,
    });
  } else if (!hasAtMostTwoDecimals(orderAmount)) {
    errors.push({
      field: 'orderAmount',
      message: 'Order amount must have at most 2 decimal places',
    });
  }

  const customerName = validateText(body.customerName, 'customerName', 'Customer name', errors);
  const customerCity = validateText(body.customerCity, 'customerCity', 'Customer city', errors);

  const state = normalizeUsState(customerState);
  if (!state) {
    errors.push({
      field: 'customerState',
      message: 'Customer state must be a US state or DC (international orders are not accepted)',
    });
  }

  const phone = normalizeUsPhone(customerPhone);
  if (!phone) {
    errors.push({
      field: 'customerPhone',
      message:
        'Customer phone must be a valid 10-digit US number (international orders are not accepted)',
    });
  }

  if (customerCountry !== undefined && !isUsCountry(customerCountry)) {
    errors.push({ field: 'customerCountry', message: 'International orders are not accepted' });
  }

  if (errors.length > 0) throw new ValidationError(errors);

  return {
    vendorId,
    orderAmount,
    customerName,
    customerCity,
    customerState: state,
    customerPhone: phone,
  };
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
