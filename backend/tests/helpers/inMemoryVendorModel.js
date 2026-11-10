// Test double that mirrors the interface of models/vendorModel.js without PostgreSQL.

export const validVendorBody = Object.freeze({
  name: 'Global Parts Co.',
  email: 'sarah@globalparts.com',
  phone: '(555) 123-4567',
  city: 'Atlanta',
  state: 'GA',
});

/** A stored vendor row (already normalized), for seeding the model. */
export function vendorRow(overrides = {}) {
  return {
    id: 1,
    name: 'Global Parts Co.',
    email: 'sarah@globalparts.com',
    phone: '5551234567',
    city: 'Atlanta',
    state: 'GA',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Mimics the PostgreSQL unique_violation the real model surfaces on duplicate emails.
function uniqueViolation() {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint: 'vendors_email_key',
  });
}

export function createInMemoryVendorModel(seed = []) {
  let rows = seed.map((row) => ({ ...row }));
  let nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  const emailTaken = (email, exceptId) => rows.some((r) => r.email === email && r.id !== exceptId);

  return {
    async findAll({ search, status } = {}) {
      const needle = search?.toLowerCase();
      return rows
        .filter((r) => !needle || r.name.toLowerCase().includes(needle))
        .filter((r) => !status || r.status === status)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({ ...r }));
    },
    async findById(id) {
      const row = rows.find((r) => r.id === id);
      return row ? { ...row } : null;
    },
    async isActive(id) {
      return rows.some((r) => r.id === id && r.status === 'Active');
    },
    async create(vendor) {
      if (emailTaken(vendor.email)) throw uniqueViolation();
      const row = { id: nextId++, ...vendor, createdAt: new Date().toISOString() };
      rows.push(row);
      return { ...row };
    },
    async update(id, vendor) {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (emailTaken(vendor.email, id)) throw uniqueViolation();
      rows[index] = { ...rows[index], ...vendor };
      return { ...rows[index] };
    },
  };
}
