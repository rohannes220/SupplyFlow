// Vendor field rules shared by the API (authoritative) and the vendor form (instant feedback).
// Keep backend/db/migrations/003_create_vendors.sql in sync with these limits.
import { US_REGIONS } from './usLocations.js';

export const VENDOR_STATUSES = Object.freeze(['Active', 'Inactive']);

export const VENDOR_LIMITS = Object.freeze({
  maxTextLength: 100, // name, city: VARCHAR(100)
  maxEmailLength: 255, // VARCHAR(255)
});

const ALLOWED_FIELDS = new Set(['name', 'email', 'phone', 'city', 'state', 'status']);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/**
 * Returns the 10 digits of a US phone number, or null. Accepts formats such as
 * (555) 123-4567, 555.123.4567 and +1 555 123 4567.
 */
export function normalizeVendorPhone(value) {
  if (typeof value !== 'string' || !/^[\d\s().+-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+') && !digits.startsWith('1')) return null;
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** Returns the uppercase 2-letter code of a US state, DC or territory, or null. */
export function normalizeStateCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && Object.hasOwn(US_REGIONS, code) ? code : null;
}

function checkText(value, field, label, errors) {
  if (isBlank(value)) {
    errors.push({ field, message: `${label} is required` });
    return undefined;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be text` });
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > VENDOR_LIMITS.maxTextLength) {
    errors.push({
      field,
      message: `${label} must be at most ${VENDOR_LIMITS.maxTextLength} characters`,
    });
  }
  return trimmed;
}

/**
 * Checks a vendor payload. Never throws. `status` is included in `value` only when given,
 * so callers decide the default (Active on create, unchanged on update).
 * @returns {{ value: object | null, errors: Array<{ field: string, message: string }> }}
 */
export function validateVendor(body) {
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

  const name = checkText(body.name, 'name', 'Vendor name', errors);
  const city = checkText(body.city, 'city', 'City', errors);

  let email;
  if (isBlank(body.email)) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else {
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > VENDOR_LIMITS.maxEmailLength) {
      errors.push({
        field: 'email',
        message: `Email must be at most ${VENDOR_LIMITS.maxEmailLength} characters`,
      });
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.push({ field: 'email', message: 'Email must be a valid email address' });
    }
  }

  const phone = normalizeVendorPhone(body.phone);
  if (isBlank(body.phone)) {
    errors.push({ field: 'phone', message: 'Phone number is required' });
  } else if (!phone) {
    errors.push({
      field: 'phone',
      message: 'Phone must be a 10-digit US number, e.g. (555) 123-4567',
    });
  }

  const state = normalizeStateCode(body.state);
  if (isBlank(body.state)) {
    errors.push({ field: 'state', message: 'State is required' });
  } else if (!state) {
    errors.push({
      field: 'state',
      message: 'State must be a 2-letter US state, DC or territory code, e.g. GA',
    });
  }

  if (body.status !== undefined && !VENDOR_STATUSES.includes(body.status)) {
    errors.push({ field: 'status', message: 'Status must be Active or Inactive' });
  }

  if (errors.length > 0) return { value: null, errors };

  const value = { name, email, phone, city, state };
  if (body.status !== undefined) value.status = body.status;
  return { value, errors };
}
