import { validateVendor } from '@supplyflow/shared/vendorRules';

// Fictional vendors for demos. Emails use the reserved .example domain and phones use the
// 555-01xx range set aside for fiction, so nothing here reaches a real business.
export const DEMO_VENDORS = Object.freeze([
  {
    name: 'Global Parts Co.',
    email: 'sarah.chen@globalparts.example',
    phone: '(404) 555-0142',
    city: 'Atlanta',
    state: 'GA',
    status: 'Active',
  },
  {
    name: 'Tech Supply LLC',
    email: 'mike.johnson@techsupply.example',
    phone: '(512) 555-0187',
    city: 'Austin',
    state: 'TX',
    status: 'Active',
  },
  {
    name: 'Industrial Hub',
    email: 'lisa.wang@industrialhub.example',
    phone: '(312) 555-0119',
    city: 'Chicago',
    state: 'IL',
    status: 'Inactive',
  },
  {
    name: 'Metro Electronics',
    email: 'david.kim@metroelectronics.example',
    phone: '(206) 555-0164',
    city: 'Seattle',
    state: 'WA',
    status: 'Active',
  },
  {
    name: 'Pacific Packaging Inc.',
    email: 'orders@pacificpackaging.example',
    phone: '(503) 555-0128',
    city: 'Portland',
    state: 'OR',
    status: 'Active',
  },
  {
    name: 'Keystone Fasteners',
    email: 'sales@keystonefasteners.example',
    phone: '(215) 555-0173',
    city: 'Philadelphia',
    state: 'PA',
    status: 'Active',
  },
  {
    name: 'Sunbelt Logistics Supply',
    email: 'contact@sunbeltsupply.example',
    phone: '(602) 555-0151',
    city: 'Phoenix',
    state: 'AZ',
    status: 'Inactive',
  },
  {
    name: 'Great Lakes Steel Works',
    email: 'info@greatlakessteel.example',
    phone: '(216) 555-0136',
    city: 'Cleveland',
    state: 'OH',
    status: 'Active',
  },
  {
    name: 'Bayou Chemical Distributors',
    email: 'accounts@bayouchemical.example',
    phone: '(504) 555-0190',
    city: 'New Orleans',
    state: 'LA',
    status: 'Active',
  },
  {
    name: 'Mountain West Office Supply',
    email: 'hello@mwofficesupply.example',
    phone: '(303) 555-0105',
    city: 'Denver',
    state: 'CO',
    status: 'Inactive',
  },
]);

/**
 * Inserts the demo vendors through the shared validation rules. Safe to re-run: vendors whose
 * email already exists are left as they are, so edits made in the app are kept.
 * @returns {Promise<number>} how many vendors were inserted
 */
export async function seedDemoVendors(db) {
  let inserted = 0;
  for (const input of DEMO_VENDORS) {
    const { value, errors } = validateVendor(input);
    if (errors.length > 0) {
      throw new Error(`Invalid demo vendor ${input.name}: ${JSON.stringify(errors)}`);
    }
    const { rowCount } = await db.query(
      `INSERT INTO vendors (name, email, phone, city, state, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      [value.name, value.email, value.phone, value.city, value.state, value.status],
    );
    inserted += rowCount;
  }
  return inserted;
}
