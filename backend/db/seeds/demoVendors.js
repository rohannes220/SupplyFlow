import { readFileSync } from 'node:fs';
import { validateVendor } from '@supplyflow/shared/vendorRules';

/** data/vendors.csv: 140 sample vendors whose IDs (1-140) match the Vendor IDs in orders.csv. */
export const DEMO_VENDORS_CSV = new URL('../../../data/vendors.csv', import.meta.url);

const CSV_COLUMNS = [
  'Vendor ID',
  'Vendor Name',
  'Vendor City',
  'Vendor State',
  'Vendor Number',
  'Vendor Email',
];

/**
 * Sample vendors marked Inactive so the demo shows deactivation (US-04). Every vendor in the
 * CSV has an order, so these are vendors whose only order is already Delivered: no order in
 * progress points at an inactive vendor, and the existing orders keep their vendor reference.
 */
export const INACTIVE_DEMO_VENDOR_IDS = Object.freeze([7, 20, 35, 50, 62, 77, 90, 105, 117, 132]);

/**
 * Reads and validates data/vendors.csv. Returns vendors normalized by the shared vendor rules
 * (10-digit phones, lowercase emails) with their CSV IDs. Throws naming the line of any bad row.
 * The file is plain comma-separated text without quoting; quoted fields are rejected.
 */
export function loadDemoVendors(csvUrl = DEMO_VENDORS_CSV) {
  const [header, ...rows] = readFileSync(csvUrl, 'utf8').trim().split(/\r?\n/);
  if (header !== CSV_COLUMNS.join(',')) {
    throw new Error(`Unexpected vendors.csv header: ${header}`);
  }

  return rows.map((row, index) => {
    const line = index + 2;
    const cells = row.split(',');
    if (row.includes('"') || cells.length !== CSV_COLUMNS.length) {
      throw new Error(`vendors.csv line ${line}: expected ${CSV_COLUMNS.length} plain fields`);
    }
    const [rawId, name, city, state, phone, email] = cells;
    const id = Number(rawId);
    const { value, errors } = validateVendor({ name, email, phone, city, state });
    if (!Number.isInteger(id) || id < 1 || errors.length > 0) {
      const problems = errors.map((e) => `${e.field}: ${e.message}`).join('; ') || 'bad Vendor ID';
      throw new Error(`vendors.csv line ${line}: ${problems}`);
    }
    return {
      id,
      ...value,
      status: INACTIVE_DEMO_VENDOR_IDS.includes(id) ? 'Inactive' : 'Active',
    };
  });
}

/**
 * Inserts the sample vendors with their CSV IDs, then moves the id sequence past the highest
 * id so vendors created in the app don't collide. Safe to re-run: a vendor whose id or email
 * already exists is left as it is, so edits made in the app are kept.
 * @returns {Promise<number>} how many vendors were inserted
 */
export async function seedDemoVendors(db, vendors = loadDemoVendors()) {
  let inserted = 0;
  for (const v of vendors) {
    const { rowCount } = await db.query(
      `INSERT INTO vendors (id, name, email, phone, city, state, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [v.id, v.name, v.email, v.phone, v.city, v.state, v.status],
    );
    inserted += rowCount;
  }
  await db.query(
    "SELECT setval(pg_get_serial_sequence('vendors', 'id'), (SELECT COALESCE(MAX(id), 1) FROM vendors))",
  );
  return inserted;
}
