import { describe, it, expect, beforeEach } from 'vitest';
import { createOrderService } from '../../services/orderService.js';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';
const admin = { id: 1, role: 'admin' };

describe('orderService', () => {
  let model;
  let service;

  beforeEach(() => {
    model = createInMemoryOrderModel();
    service = createOrderService(model);
  });

  it('creates an order with a generated id and Draft status', async () => {
    const order = await service.createOrder(validOrderBody, admin);
    expect(order).toMatchObject({
      orderId: 1,
      vendorId: 3,
      orderAmount: 2250.5,
      customerPhone: '4045550123',
      status: 'Draft',
    });
  });

  it('does not touch the model when creation input is invalid', async () => {
    await expect(
      service.createOrder({ ...validOrderBody, customerState: 'BC' }, admin),
    ).rejects.toThrow(ValidationError);
    expect(await model.findAll()).toEqual([]);
  });

  it('lists orders newest first', async () => {
    await service.createOrder(validOrderBody, admin);
    await service.createOrder({ ...validOrderBody, customerName: 'Mike Johnson' }, admin);
    const orders = await service.listOrders();
    expect(orders.map((o) => o.orderId)).toEqual([2, 1]);
  });

  it('gets an order by id', async () => {
    const created = await service.createOrder(validOrderBody, admin);
    expect(await service.getOrder(String(created.orderId))).toEqual(created);
  });

  it.each(['abc', '0', '-1', '1.5', '', '99999999999'])('rejects malformed id %j', async (id) => {
    await expect(service.getOrder(id)).rejects.toThrow(ValidationError);
    await expect(service.updateOrder(id, validOrderBody)).rejects.toThrow(ValidationError);
    await expect(service.deleteOrder(id)).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for a missing order', async () => {
    await expect(service.getOrder('42')).rejects.toThrow(NotFoundError);
    await expect(service.updateOrder('42', validOrderBody)).rejects.toThrow(NotFoundError);
    await expect(service.deleteOrder('42')).rejects.toThrow(NotFoundError);
  });

  it('updates a Draft order with validated, normalized data', async () => {
    const created = await service.createOrder(validOrderBody, admin);
    const updated = await service.updateOrder(
      String(created.orderId),
      {
        ...validOrderBody,
        orderAmount: 99.99,
        customerState: 'texas',
      },
      admin,
    );
    expect(updated).toMatchObject({
      orderId: created.orderId,
      orderAmount: 99.99,
      customerState: 'TX',
    });
  });

  it('rejects an invalid update without changing the order', async () => {
    const created = await service.createOrder(validOrderBody, admin);
    await expect(
      service.updateOrder(
        String(created.orderId),
        {
          ...validOrderBody,
          customerPhone: '+52 55 1234 5678',
        },
        admin,
      ),
    ).rejects.toThrow(ValidationError);
    expect(await service.getOrder(String(created.orderId))).toEqual(created);
  });

  it('deletes a Draft order', async () => {
    const created = await service.createOrder(validOrderBody, admin);
    await service.deleteOrder(String(created.orderId), admin);
    await expect(service.getOrder(String(created.orderId))).rejects.toThrow(NotFoundError);
  });

  describe('orders that have left Draft', () => {
    beforeEach(() => {
      model = createInMemoryOrderModel([
        { orderId: 7, ...validOrderBody, customerPhone: '4045550123', status: 'Pending' },
      ]);
      service = createOrderService(model);
    });

    it('cannot be updated', async () => {
      await expect(service.updateOrder('7', validOrderBody, admin)).rejects.toThrow(ConflictError);
    });

    it('cannot be deleted', async () => {
      await expect(service.deleteOrder('7', admin)).rejects.toThrow(ConflictError);
      expect(await model.findById(7)).not.toBeNull();
    });
  });
});
