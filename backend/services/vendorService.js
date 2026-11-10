import { validateVendor, VENDOR_STATUSES } from '@supplyflow/shared/vendorRules';
import { isPositiveInt } from '@supplyflow/shared/orderRules';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

const DEFAULT_STATUS = 'Active';
const UNIQUE_VIOLATION = '23505';

function validateVendorInput(body) {
  const { value, errors } = validateVendor(body);
  if (errors.length > 0) throw new ValidationError(errors);
  return value;
}

function parseVendorId(rawId) {
  const id = /^\d+$/.test(String(rawId)) ? Number(rawId) : NaN;
  if (!isPositiveInt(id)) {
    throw new ValidationError([{ field: 'id', message: 'Vendor ID must be a positive integer' }]);
  }
  return id;
}

function parseFilters({ search, status } = {}) {
  const errors = [];
  if (search !== undefined && typeof search !== 'string') {
    errors.push({ field: 'search', message: 'Search must be a single text value' });
  }
  if (status !== undefined && !VENDOR_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: 'Status must be Active or Inactive' });
  }
  if (errors.length > 0) throw new ValidationError(errors);
  return { search: search?.trim() || undefined, status };
}

/** The database's unique email constraint is the source of truth, so races can't slip through. */
async function rejectDuplicateEmail(write) {
  try {
    return await write();
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new ConflictError('A vendor with this email already exists');
    }
    throw err;
  }
}

export function createVendorService(vendorModel) {
  async function findExisting(rawId) {
    const id = parseVendorId(rawId);
    const vendor = await vendorModel.findById(id);
    if (!vendor) throw new NotFoundError(`Vendor ${id} not found`);
    return vendor;
  }

  return {
    async listVendors(filters) {
      return vendorModel.findAll(parseFilters(filters));
    },

    getVendor(rawId) {
      return findExisting(rawId);
    },

    async createVendor(body) {
      const fields = validateVendorInput(body);
      return rejectDuplicateEmail(() =>
        vendorModel.create({ ...fields, status: fields.status ?? DEFAULT_STATUS }),
      );
    },

    /** Replaces the vendor's details. Setting status Inactive is how vendors are deactivated. */
    async updateVendor(rawId, body) {
      const existing = await findExisting(rawId);
      const fields = validateVendorInput(body);
      const updated = await rejectDuplicateEmail(() =>
        vendorModel.update(existing.id, { ...fields, status: fields.status ?? existing.status }),
      );
      if (!updated) throw new NotFoundError(`Vendor ${existing.id} not found`);
      return updated;
    },
  };
}
