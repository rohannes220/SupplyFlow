import { describe, it, expect, beforeEach } from 'vitest';
import { createOrderService } from '../../services/orderService.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';

const admin = { id: 1, role: 'admin' };
const employee = { id: 2, role: 'employee' };
const STATUSES = ['Draft', 'Pending', 'Approved', 'Shipped', 'Delivered', 'Cancelled'];

// One order per status: order 1 is Draft, 2 is Pending, ... 6 is Cancelled.
const seed = () =>
  STATUSES.map((status, i) => ({
    orderId: i + 1,
    ...validOrderBody,
    customerPhone: '4045550123',
    status,
    createdBy: employee.id,
  }));
const idOf = (status) => String(STATUSES.indexOf(status) + 1);

describe('orderService.updateOrderStatus', () => {
  let model;
  let service;

  beforeEach(() => {
    model = createInMemoryOrderModel(seed());
    service = createOrderService(model);
  });

  const statusOf = async (status) => (await model.findById(Number(idOf(status)))).status;

  describe('valid transitions', () => {
    it.each([
      ['Draft', 'Pending', employee],
      ['Draft', 'Cancelled', employee],
      ['Pending', 'Cancelled', employee],
      ['Draft', 'Pending', admin],
      ['Pending', 'Approved', admin],
      ['Pending', 'Cancelled', admin],
      ['Approved', 'Shipped', admin],
      ['Shipped', 'Delivered', admin],
    ])('%s -> %s is allowed for %o', async (from, to, actor) => {
      const order = await service.updateOrderStatus(idOf(from), to, actor);
      expect(order.status).toBe(to);
      expect(await statusOf(from)).toBe(to);
    });
  });

  describe('invalid transitions return ValidationError (400) and change nothing', () => {
    it.each([
      ['Draft', 'Approved'],
      ['Draft', 'Shipped'],
      ['Draft', 'Delivered'],
      ['Draft', 'Draft'],
      ['Pending', 'Draft'],
      ['Pending', 'Shipped'],
      ['Approved', 'Pending'],
      ['Approved', 'Cancelled'],
      ['Shipped', 'Approved'],
      ['Shipped', 'Cancelled'],
      ['Delivered', 'Shipped'],
      ['Delivered', 'Cancelled'],
      ['Delivered', 'Draft'],
      ['Cancelled', 'Draft'],
      ['Cancelled', 'Pending'],
    ])('%s -> %s (even for an admin)', async (from, to) => {
      const err = await service.updateOrderStatus(idOf(from), to, admin).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details.map((d) => d.field)).toEqual(['status']);
      expect(err.details[0].message).toMatch(new RegExp(`${from}.*${to}`));
      expect(await statusOf(from)).toBe(from);
    });

    it.each([undefined, null, '', 'Archived', 'approved', 42])(
      'rejects status value %s',
      async (status) => {
        await expect(service.updateOrderStatus(idOf('Draft'), status, admin)).rejects.toThrow(
          ValidationError,
        );
        expect(await statusOf('Draft')).toBe('Draft');
      },
    );

    it('checks the transition before the role: an employee asking Draft -> Shipped gets 400', async () => {
      await expect(service.updateOrderStatus(idOf('Draft'), 'Shipped', employee)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('roles', () => {
    it.each([
      ['Pending', 'Approved'],
      ['Approved', 'Shipped'],
      ['Shipped', 'Delivered'],
    ])('%s -> %s is admin-only: ForbiddenError (403) for an employee', async (from, to) => {
      const err = await service.updateOrderStatus(idOf(from), to, employee).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.status).toBe(403);
      expect(await statusOf(from)).toBe(from);
    });

    it('rejects a missing or unknown actor with ForbiddenError', async () => {
      await expect(service.updateOrderStatus(idOf('Draft'), 'Pending')).rejects.toThrow(
        ForbiddenError,
      );
      await expect(
        service.updateOrderStatus(idOf('Draft'), 'Pending', { id: 9, role: 'guest' }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  it('throws NotFoundError for a missing order', async () => {
    await expect(service.updateOrderStatus('99', 'Pending', admin)).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for a malformed id', async () => {
    await expect(service.updateOrderStatus('abc', 'Pending', admin)).rejects.toThrow(
      ValidationError,
    );
  });
});
