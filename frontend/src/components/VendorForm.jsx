import { useId, useRef, useState } from 'react';
import { validateVendor, VENDOR_STATUSES } from '@supplyflow/shared/vendorRules';
import { US_STATES, US_TERRITORIES, formatUsPhone } from '@supplyflow/shared/usLocations';
import { ApiError } from '../services/orderApi.js';

const FIELDS = ['name', 'email', 'phone', 'city', 'state', 'status'];
const byName = ([, a], [, b]) => a.localeCompare(b);
const STATE_OPTIONS = Object.entries(US_STATES).sort(byName);
const TERRITORY_OPTIONS = Object.entries(US_TERRITORIES).sort(byName);

const inputClass = (invalid) =>
  `block w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
    invalid
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
  }`;

function toForm(vendor) {
  return {
    name: vendor?.name ?? '',
    email: vendor?.email ?? '',
    phone: vendor?.phone ? formatUsPhone(vendor.phone) : '',
    city: vendor?.city ?? '',
    state: vendor?.state ?? '',
    status: vendor?.status ?? 'Active',
  };
}

const errorsByField = (list) =>
  Object.fromEntries(list.filter((e) => FIELDS.includes(e.field)).map((e) => [e.field, e.message]));

function Field({ id, label, hint, error, required = true, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-600">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/**
 * Add or edit a vendor. Pass `vendor` to edit. Validates with the shared vendor rules and calls
 * `onSubmit(value)` with the normalized vendor; errors thrown by onSubmit are shown in the form.
 */
export default function VendorForm({ vendor, onSubmit, onCancel }) {
  const idPrefix = useId();
  const formRef = useRef(null);
  const [form, setForm] = useState(() => toForm(vendor));
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(vendor);

  const id = (field) => `${idPrefix}-${field}`;
  const hints = {
    phone: '10-digit US number, e.g. (555) 123-4567',
    status: 'Inactive vendors cannot receive new purchase orders.',
  };

  function fieldProps(field) {
    const error = errors[field];
    const describedBy = error
      ? `${id(field)}-error`
      : hints[field]
        ? `${id(field)}-hint`
        : undefined;
    return {
      id: id(field),
      name: field,
      value: form[field],
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': describedBy,
      className: inputClass(Boolean(error)),
      onChange: (event) => {
        const next = { ...form, [field]: event.target.value };
        setForm(next);
        // After the first submit attempt, re-check as the user types.
        if (attempted) setErrors(errorsByField(validateVendor(next).errors));
      },
    };
  }

  function focusFirstError(fieldErrors) {
    const first = FIELDS.find((field) => fieldErrors[field]);
    if (first) formRef.current?.querySelector(`[name="${first}"]`)?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setAttempted(true);
    setServerError('');

    const { value, errors: list } = validateVendor(form);
    const fieldErrors = errorsByField(list);
    setErrors(fieldErrors);
    if (list.length > 0) {
      focusFirstError(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(value);
    } catch (err) {
      let serverFieldErrors = {};
      if (err instanceof ApiError) {
        serverFieldErrors = errorsByField(err.details);
        // A conflict on vendors can only be a duplicate email.
        if (err.status === 409) serverFieldErrors = { email: err.message };
      }
      if (Object.keys(serverFieldErrors).length > 0) {
        setErrors(serverFieldErrors);
        focusFirstError(serverFieldErrors);
      } else {
        setServerError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = editing ? 'Save changes' : 'Add vendor';

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id={id('name')} label="Name" error={errors.name}>
            <input {...fieldProps('name')} type="text" autoComplete="organization" />
          </Field>
        </div>
        <Field id={id('email')} label="Email" error={errors.email}>
          <input {...fieldProps('email')} type="email" autoComplete="email" />
        </Field>
        <Field id={id('phone')} label="Phone" hint={hints.phone} error={errors.phone}>
          <input {...fieldProps('phone')} type="tel" autoComplete="tel" />
        </Field>
        <Field id={id('city')} label="City" error={errors.city}>
          <input {...fieldProps('city')} type="text" autoComplete="address-level2" />
        </Field>
        <Field id={id('state')} label="State" error={errors.state}>
          <select {...fieldProps('state')} autoComplete="address-level1">
            <option value="">Select a state or territory</option>
            <optgroup label="States and DC">
              {STATE_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} – {name}
                </option>
              ))}
            </optgroup>
            <optgroup label="US territories">
              {TERRITORY_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} – {name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field
          id={id('status')}
          label="Status"
          required={false}
          hint={hints.status}
          error={errors.status}
        >
          <select {...fieldProps('status')}>
            {VENDOR_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
