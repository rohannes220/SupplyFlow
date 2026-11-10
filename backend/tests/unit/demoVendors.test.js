import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateVendor } from '@supplyflow/shared/vendorRules';
import {
  INACTIVE_DEMO_VENDOR_IDS,
  loadDemoVendors,
  seedDemoVendors,
} from '../../db/seeds/demoVendors.js';

const readCsv = (name) => {
  const [header, ...rows] = readFileSync(new URL(`../../../data/${name}`, import.meta.url), 'utf8')
    .trim()
    .split(/\r?\n/);
  const columns = header.split(',');
  return rows.map((row) => Object.fromEntries(row.split(',').map((v, i) => [columns[i], v])));
};

function csvFile(contents) {
  const path = join(mkdtempSync(join(tmpdir(), 'vendors-csv-')), 'vendors.csv');
  writeFileSync(path, contents);
  return pathToFileURL(path);
}
const HEADER = 'Vendor ID,Vendor Name,Vendor City,Vendor State,Vendor Number,Vendor Email';

describe('demo vendors from data/vendors.csv', () => {
  const vendors = loadDemoVendors();

  it('loads all 140 vendors with their CSV IDs 1-140', () => {
    expect(vendors).toHaveLength(140);
    expect(vendors.map((v) => v.id)).toEqual(Array.from({ length: 140 }, (_, i) => i + 1));
  });

  it('normalizes rows with the shared vendor rules', () => {
    expect(vendors[0]).toEqual({
      id: 1,
      name: 'Highland Plumbing Services',
      email: 'highlandplumbingservicesorders@example.com',
      phone: '7815559024',
      city: 'Boston',
      state: 'MA',
      status: 'Active',
    });
    for (const { name, email, phone, city, state } of vendors) {
      expect(validateVendor({ name, email, phone, city, state }).errors).toEqual([]);
    }
  });

  it('uses unique emails on the reserved example.com domain', () => {
    const emails = vendors.map((v) => v.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((e) => e.endsWith('@example.com'))).toBe(true);
  });

  it('is Active by default with about 10 Inactive vendors', () => {
    const inactive = vendors.filter((v) => v.status === 'Inactive').map((v) => v.id);
    expect(inactive).toEqual([...INACTIVE_DEMO_VENDOR_IDS]);
    expect(inactive.length).toBeGreaterThanOrEqual(8);
    expect(inactive.length).toBeLessThanOrEqual(12);
    expect(vendors.filter((v) => v.status === 'Active')).toHaveLength(140 - inactive.length);
  });

  it('only deactivates vendors whose sample orders are all Delivered', () => {
    const orders = readCsv('orders.csv');
    for (const id of INACTIVE_DEMO_VENDOR_IDS) {
      const statuses = orders.filter((o) => Number(o['Vendor ID']) === id).map((o) => o.Status);
      expect(statuses, `vendor ${id}`).not.toEqual([]);
      expect(
        statuses.every((s) => s === 'Delivered'),
        `vendor ${id}: ${statuses}`,
      ).toBe(true);
    }
  });

  it('covers every vendor that a sample order references', () => {
    const ids = new Set(vendors.map((v) => v.id));
    for (const order of readCsv('orders.csv')) {
      expect(ids.has(Number(order['Vendor ID'])), `order ${order['Order ID']}`).toBe(true);
    }
  });

  describe('rejects a malformed CSV, naming the line', () => {
    it.each([
      ['an unexpected header', 'id,name\n1,x', /header/],
      ['a missing column', `${HEADER}\n1,Acme,Boston,MA,781-555-9024`, /line 2/],
      ['a quoted field', `${HEADER}\n1,"Acme, Inc",Boston,MA,781-555-9024,a@example.com`, /line 2/],
      ['an invalid phone', `${HEADER}\n1,Acme,Boston,MA,555-1234,a@example.com`, /line 2: phone/],
      ['a bad Vendor ID', `${HEADER}\nx,Acme,Boston,MA,781-555-9024,a@example.com`, /line 2/],
    ])('%s', (_label, contents, message) => {
      expect(() => loadDemoVendors(csvFile(contents))).toThrow(message);
    });
  });

  describe('seedDemoVendors', () => {
    it('inserts each vendor with its CSV id using parameterized, re-runnable SQL', async () => {
      const db = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };

      const inserted = await seedDemoVendors(db);

      expect(inserted).toBe(140);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO vendors \(id,/);
      expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
      expect(params).toEqual([
        1,
        'Highland Plumbing Services',
        'highlandplumbingservicesorders@example.com',
        '7815559024',
        'Boston',
        'MA',
        'Active',
      ]);
    });

    it('counts only new rows and resets the id sequence afterwards', async () => {
      const db = {
        query: vi.fn().mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValue({ rowCount: 1 }),
      };

      expect(await seedDemoVendors(db)).toBe(139);
      const lastSql = db.query.mock.calls.at(-1)[0];
      expect(lastSql).toMatch(/setval\(pg_get_serial_sequence\('vendors', 'id'\)/);
    });
  });
});
