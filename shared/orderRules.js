// Order field rules shared by the API (authoritative) and the Add Order form
// (instant feedback). Keep backend/db/migrations in sync with these limits.
import { normalizeUsState, normalizeUsPhone, isUsCountry } from './usLocations.js';

export const ORDER_LIMITS = Object.freeze({
  maxId: 2_147_483_647, // PostgreSQL INTEGER
  maxAmount: 9_999_999_999.99, // NUMERIC(12, 2)
  maxTextLength: 100, // VARCHAR(100)
});

export const ORDER_FIELDS = Object.freeze([
  'vendorId',
  'orderAmount',
  'customerName',
  'customerCity',
  'customerState',
  'customerPhone',
]);

// Accepted on input for clarity but never stored: every order is domestic.
const OPTIONAL_FIELDS = ['customerCountry'];
const ALLOWED_FIELDS = new Set([...ORDER_FIELDS, ...OPTIONAL_FIELDS]);

// Letters from any alphabet (José, Nguyễn, Hagåtña), spaces, . ' -
const NAME_PATTERN = /^\p{L}[\p{L}\p{M} .'-]*$/u;

export function isPositiveInt(value, max = ORDER_LIMITS.maxId) {
  return Number.isInteger(value) && value > 0 && value <= max;
}

function hasAtMostTwoDecimals(value) {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

function checkText(value, field, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, message: `${label} is required` });
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > ORDER_LIMITS.maxTextLength) {
    errors.push({
      field,
      message: `${label} must be at most ${ORDER_LIMITS.maxTextLength} characters`,
    });
  } else if (!NAME_PATTERN.test(trimmed)) {
    errors.push({
      field,
      message: `${label} may contain only letters, spaces, periods, apostrophes, and hyphens`,
    });
  }
  return trimmed;
}

/**
 * Checks an order payload. Never throws.
 * @returns {{ value: object | null, errors: Array<{ field: string, message: string }> }}
 */
export function validateOrder(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return {
      value: null,
      errors: [{ field: 'body', message: 'Request body must be a JSON object' }],
    };
  }

  const errors = [];
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push({ field: key, message: `Unknown field "${key}"` });
  }

  const { vendorId, orderAmount, customerState, customerPhone, customerCountry } = body;

  if (vendorId === undefined || vendorId === null || vendorId === '') {
    errors.push({ field: 'vendorId', message: 'Vendor ID is required' });
  } else if (!isPositiveInt(vendorId)) {
    errors.push({ field: 'vendorId', message: 'Vendor ID must be a positive whole number' });
  }

  if (orderAmount === undefined || orderAmount === null || orderAmount === '') {
    errors.push({ field: 'orderAmount', message: 'Order amount is required' });
  } else if (typeof orderAmount !== 'number' || !Number.isFinite(orderAmount) || orderAmount <= 0) {
    errors.push({ field: 'orderAmount', message: 'Order amount must be a number greater than 0' });
  } else if (orderAmount > ORDER_LIMITS.maxAmount) {
    errors.push({
      field: 'orderAmount',
      message: 'Order amount must not exceed $9,999,999,999.99',
    });
  } else if (!hasAtMostTwoDecimals(orderAmount)) {
    errors.push({
      field: 'orderAmount',
      message: 'Order amount must have at most 2 decimal places',
    });
  }

  const customerName = checkText(body.customerName, 'customerName', 'Customer name', errors);
  const customerCity = checkText(body.customerCity, 'customerCity', 'Customer city', errors);

  const isBlank = (v) =>
    v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

  const state = normalizeUsState(customerState);
  if (isBlank(customerState)) {
    errors.push({ field: 'customerState', message: 'Customer state is required' });
  } else if (!state) {
    errors.push({
      field: 'customerState',
      message:
        'Customer state must be a US state, DC, or US territory (international orders are not accepted)',
    });
  }

  const phone = normalizeUsPhone(customerPhone);
  if (isBlank(customerPhone)) {
    errors.push({ field: 'customerPhone', message: 'Customer phone number is required' });
  } else if (!phone) {
    errors.push({
      field: 'customerPhone',
      message:
        'Customer phone must be a valid 10-digit US number (international orders are not accepted)',
    });
  }

  if (customerCountry !== undefined && !isUsCountry(customerCountry)) {
    errors.push({ field: 'customerCountry', message: 'International orders are not accepted' });
  }

  if (errors.length > 0) return { value: null, errors };

  return {
    value: {
      vendorId,
      orderAmount,
      customerName,
      customerCity,
      customerState: state,
      customerPhone: phone,
    },
    errors,
  };
}

// Status workflow (AGENTS.md Decisions). Shared so the API enforces it and the UI only offers
// moves the API will accept.
export const ORDER_STATUSES = Object.freeze([
  'Draft',
  'Pending',
  'Approved',
  'Shipped',
  'Delivered',
  'Cancelled',
]);

/** Only admins may move an order into these statuses. */
export const ADMIN_ONLY_STATUSES = Object.freeze(['Approved', 'Shipped', 'Delivered']);

/** No move is allowed out of these statuses. */
export const FINAL_STATUSES = Object.freeze(['Delivered', 'Cancelled']);

const TRANSITIONS = Object.freeze({
  Draft: Object.freeze(['Pending', 'Cancelled']),
  Pending: Object.freeze(['Approved', 'Cancelled']),
  Approved: Object.freeze(['Shipped']),
  Shipped: Object.freeze(['Delivered']),
  Delivered: Object.freeze([]),
  Cancelled: Object.freeze([]),
});

const ROLES = ['admin', 'employee'];

/** True when the workflow allows moving an order from `from` to `to` (ignores roles). */
export function canTransition(from, to) {
  return Object.hasOwn(TRANSITIONS, from) && TRANSITIONS[from].includes(to);
}

/** True when `role` may move an order into status `to` (assuming the move itself is valid). */
export function roleCanSetStatus(role, to) {
  if (!ROLES.includes(role)) return false;
  return role === 'admin' || !ADMIN_ONLY_STATUSES.includes(to);
}

/** The statuses `role` may move an order to from `from`, in workflow order. */
export function allowedNextStatuses(from, role) {
  if (!Object.hasOwn(TRANSITIONS, from)) return [];
  return TRANSITIONS[from].filter((to) => roleCanSetStatus(role, to));
}
