import { describe, it, expect, vi } from 'vitest';
import { validateVendor } from '@supplyflow/shared/vendorRules';
import { DEMO_VENDORS, seedDemoVendors } from '../../db/seeds/demoVendors.js';

describe('demo vendor seed', () => {
  it('has about 10 vendors that all pass the shared vendor rules', () => {
    expect(DEMO_VENDORS.length).toBeGreaterThanOrEqual(8);
    for (const vendor of DEMO_VENDORS) {
      expect(validateVendor(vendor).errors, vendor.name).toEqual([]);
    }
  });

  it('mixes Active and Inactive vendors and uses unique emails', () => {
    const statuses = new Set(DEMO_VENDORS.map((v) => v.status));
    expect(statuses).toEqual(new Set(['Active', 'Inactive']));
    const emails = DEMO_VENDORS.map((v) => v.email.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('inserts normalized rows with parameterized queries and skips existing emails', async () => {
    const db = {
      query: vi.fn().mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValue({ rowCount: 1 }),
    };

    const inserted = await seedDemoVendors(db);

    expect(inserted).toBe(DEMO_VENDORS.length - 1);
    expect(db.query).toHaveBeenCalledTimes(DEMO_VENDORS.length);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(email\) DO NOTHING/);
    expect(params).toEqual([
      'Global Parts Co.',
      'sarah.chen@globalparts.example',
      '4045550142',
      'Atlanta',
      'GA',
      'Active',
    ]);
  });
});
