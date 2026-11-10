// The in-memory dashboard model powers the dev fallback (no PostgreSQL). It must report the same
// metrics the SQL model computes with aggregates.
import { describe, it, expect } from 'vitest';
import { createInMemoryDashboardModel } from '../helpers/inMemoryDashboardModel.js';
import { createInMemoryOrderModel, validOrderBody } from '../helpers/inMemoryOrderModel.js';
import { createInMemoryVendorModel, vendorRow } from '../helpers/inMemoryVendorModel.js';
import { DEMO_ORDERS } from '../../db/seeds/demoOrders.js';

const TODAY = '2026-11-10';

const order = (orderId, status, orderAmount, extra = {}) => ({
  orderId,
  ...validOrderBody,
  customerPhone: '4045550123',
  vendorId: 10 + orderId,
  orderAmount,
  status,
  ...extra,
});

function build(orders, vendors = [vendorRow({ id: 1 }), vendorRow({ id: 2, email: 'b@x.com' })]) {
  return createInMemoryDashboardModel({
    orderModel: createInMemoryOrderModel(orders),
    vendorModel: createInMemoryVendorModel(vendors),
  });
}

describe('createInMemoryDashboardModel', () => {
  it('counts orders, pending orders and orders per status', async () => {
    const model = build([
      order(1, 'Draft', 10),
      order(2, 'Pending', 20),
      order(3, 'Pending', 30),
      order(4, 'Shipped', 40),
      order(5, 'Cancelled', 50),
    ]);
    const m = await model.getMetrics({ today: TODAY });

    expect(m.totalOrders).toBe(5);
    expect(m.pendingOrders).toBe(2);
    expect(m.ordersByStatus).toEqual({ Draft: 1, Pending: 2, Shipped: 1, Cancelled: 1 });
  });

  it('sums order amounts, excluding Cancelled orders', async () => {
    const model = build([
      order(1, 'Delivered', 100.25),
      order(2, 'Pending', 200.5),
      order(3, 'Cancelled', 999),
    ]);
    expect((await model.getMetrics({ today: TODAY })).totalSpending).toBeCloseTo(300.75, 2);
  });

  it('counts only Active vendors', async () => {
    const model = build(
      [],
      [
        vendorRow({ id: 1, email: 'a@x.com' }),
        vendorRow({ id: 2, email: 'b@x.com', status: 'Inactive' }),
        vendorRow({ id: 3, email: 'c@x.com' }),
      ],
    );
    expect((await model.getMetrics({ today: TODAY })).activeVendors).toBe(2);
  });

  it('returns the 5 most recent orders, newest first, as { id, vendorId, amount, status }', async () => {
    const at = (day) => `2026-11-0${day}T12:00:00.000Z`;
    const model = build([
      order(1, 'Draft', 10, { createdAt: at(1) }),
      order(2, 'Pending', 20, { createdAt: at(7) }),
      order(3, 'Shipped', 30, { createdAt: at(3) }),
      order(4, 'Delivered', 40, { createdAt: at(6) }),
      order(5, 'Pending', 50, { createdAt: at(5) }),
      order(6, 'Draft', 60, { createdAt: at(4) }),
      order(7, 'Cancelled', 70, { createdAt: at(2) }),
    ]);
    const { recentOrders } = await model.getMetrics({ today: TODAY });

    expect(recentOrders.map((o) => o.id)).toEqual([2, 4, 5, 6, 3]);
    expect(recentOrders[0]).toEqual({ id: 2, vendorId: 12, amount: 20, status: 'Pending' });
  });

  it('breaks ties (or missing createdAt, as in the demo data) by newest order id', async () => {
    const model = build([order(1, 'Draft', 1), order(9, 'Draft', 9), order(4, 'Draft', 4)]);
    const { recentOrders } = await model.getMetrics({ today: TODAY });
    expect(recentOrders.map((o) => o.id)).toEqual([9, 4, 1]);
  });

  it('returns null overdue deliveries while orders have no expected delivery date', async () => {
    const model = build([order(1, 'Pending', 10), order(2, 'Shipped', 20)]);
    expect((await model.getMetrics({ today: TODAY })).overdueDeliveries).toBeNull();
  });

  it('counts overdue deliveries once orders carry expectedDeliveryDate', async () => {
    const model = build([
      order(1, 'Pending', 1, { expectedDeliveryDate: '2026-11-09' }), // overdue
      order(2, 'Shipped', 1, { expectedDeliveryDate: '2026-10-01' }), // overdue
      order(3, 'Approved', 1, { expectedDeliveryDate: TODAY }), // due today: not overdue
      order(4, 'Shipped', 1, { expectedDeliveryDate: '2026-11-20' }), // future
      order(5, 'Delivered', 1, { expectedDeliveryDate: '2026-11-01' }), // done
      order(6, 'Cancelled', 1, { expectedDeliveryDate: '2026-11-01' }), // done
      order(7, 'Draft', 1, { expectedDeliveryDate: null }), // no date
    ]);
    expect((await model.getMetrics({ today: TODAY })).overdueDeliveries).toBe(2);
  });

  it('reports zeros and no recent orders when there are no orders', async () => {
    const m = await build([]).getMetrics({ today: TODAY });
    expect(m).toMatchObject({
      totalOrders: 0,
      pendingOrders: 0,
      totalSpending: 0,
      ordersByStatus: {},
      recentOrders: [],
    });
  });

  it('reflects changes to the underlying orders on every call', async () => {
    const orderModel = createInMemoryOrderModel([order(1, 'Pending', 10)]);
    const model = createInMemoryDashboardModel({
      orderModel,
      vendorModel: createInMemoryVendorModel([]),
    });
    expect((await model.getMetrics({ today: TODAY })).totalOrders).toBe(1);

    await orderModel.create({ ...validOrderBody, customerPhone: '4045550123' });
    expect((await model.getMetrics({ today: TODAY })).totalOrders).toBe(2);
  });

  it('matches the demo data: 140 orders, 28 Pending', async () => {
    const model = build(DEMO_ORDERS);
    const m = await model.getMetrics({ today: TODAY });
    expect(m.totalOrders).toBe(140);
    expect(m.pendingOrders).toBe(28);
    expect(m.ordersByStatus).toEqual({ Pending: 28, Shipped: 56, Delivered: 56 });
    expect(m.recentOrders).toHaveLength(5);
  });
});
