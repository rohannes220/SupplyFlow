// Status workflow rules live in shared/ so the API enforces them and the UI only offers valid moves.
import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUSES,
  ADMIN_ONLY_STATUSES,
  FINAL_STATUSES,
  canTransition,
  allowedNextStatuses,
} from '@supplyflow/shared/orderRules';

const ALLOWED = [
  ['Draft', 'Pending'],
  ['Pending', 'Approved'],
  ['Approved', 'Shipped'],
  ['Shipped', 'Delivered'],
  ['Draft', 'Cancelled'],
  ['Pending', 'Cancelled'],
];
const isAllowed = (from, to) => ALLOWED.some(([f, t]) => f === from && t === to);
const EVERY_PAIR = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to]));

describe('order status rules', () => {
  it('lists the statuses in workflow order', () => {
    expect(ORDER_STATUSES).toEqual([
      'Draft',
      'Pending',
      'Approved',
      'Shipped',
      'Delivered',
      'Cancelled',
    ]);
  });

  it('marks Approved, Shipped and Delivered as admin-only', () => {
    expect([...ADMIN_ONLY_STATUSES].sort()).toEqual(['Approved', 'Delivered', 'Shipped']);
  });

  it('treats Delivered and Cancelled as final', () => {
    expect([...FINAL_STATUSES].sort()).toEqual(['Cancelled', 'Delivered']);
  });

  describe('canTransition', () => {
    it.each(ALLOWED)('allows %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    it.each(EVERY_PAIR.filter(([from, to]) => !isAllowed(from, to)))(
      'rejects %s -> %s',
      (from, to) => {
        expect(canTransition(from, to)).toBe(false);
      },
    );

    it.each([
      ['Draft', 'Archived'],
      ['Unknown', 'Pending'],
      [undefined, 'Pending'],
      ['Draft', undefined],
      ['draft', 'pending'],
    ])('rejects unknown statuses %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  describe('allowedNextStatuses', () => {
    it.each([
      ['Draft', ['Pending', 'Cancelled']],
      ['Pending', ['Approved', 'Cancelled']],
      ['Approved', ['Shipped']],
      ['Shipped', ['Delivered']],
      ['Delivered', []],
      ['Cancelled', []],
    ])('gives an admin every valid move from %s', (from, expected) => {
      expect(allowedNextStatuses(from, 'admin')).toEqual(expected);
    });

    it.each([
      ['Draft', ['Pending', 'Cancelled']],
      ['Pending', ['Cancelled']],
      ['Approved', []],
      ['Shipped', []],
      ['Delivered', []],
      ['Cancelled', []],
    ])('gives an employee only non-admin moves from %s', (from, expected) => {
      expect(allowedNextStatuses(from, 'employee')).toEqual(expected);
    });

    it('gives nothing for an unknown role or status', () => {
      expect(allowedNextStatuses('Draft', 'guest')).toEqual([]);
      expect(allowedNextStatuses('Archived', 'admin')).toEqual([]);
    });
  });
});
