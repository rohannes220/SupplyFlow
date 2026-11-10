import { describe, it, expect, vi } from 'vitest';
import { createDashboardService } from '../../services/dashboardService.js';

/** What a dashboard model returns: raw aggregates, only statuses that have orders. */
const metrics = (overrides = {}) => ({
  totalOrders: 4,
  pendingOrders: 1,
  activeVendors: 7,
  totalSpending: 300.1 + 200.2, // 500.30000000000007 in floating point
  ordersByStatus: { Pending: 1, Shipped: 2, Cancelled: 1 },
  recentOrders: [{ id: 9, vendorId: 3, amount: 120.5, status: 'Pending' }],
  overdueDeliveries: null,
  ...overrides,
});

function setup(overrides, now = new Date('2026-11-10T15:30:00Z')) {
  const dashboardModel = { getMetrics: vi.fn().mockResolvedValue(metrics(overrides)) };
  const service = createDashboardService({ dashboardModel, now: () => now });
  return { service, dashboardModel };
}

describe('dashboardService.getDashboard', () => {
  it('returns every metric the dashboard shows', async () => {
    const { service } = setup();
    expect(await service.getDashboard()).toEqual({
      totalOrders: 4,
      pendingOrders: 1,
      activeVendors: 7,
      totalSpending: 500.3,
      overdueDeliveries: null,
      ordersByStatus: {
        Draft: 0,
        Pending: 1,
        Approved: 0,
        Shipped: 2,
        Delivered: 0,
        Cancelled: 1,
      },
      recentOrders: [{ id: 9, vendorId: 3, amount: 120.5, status: 'Pending' }],
    });
  });

  it('lists every order status in workflow order, with 0 for statuses that have no orders', async () => {
    const { service } = setup({ ordersByStatus: {} });
    const { ordersByStatus } = await service.getDashboard();
    expect(Object.keys(ordersByStatus)).toEqual([
      'Draft',
      'Pending',
      'Approved',
      'Shipped',
      'Delivered',
      'Cancelled',
    ]);
    expect(Object.values(ordersByStatus).every((n) => n === 0)).toBe(true);
  });

  it('rounds total spending to cents', async () => {
    const { service } = setup({ totalSpending: 1234.5678 });
    expect((await service.getDashboard()).totalSpending).toBe(1234.57);
  });

  it("asks the model for overdue deliveries as of today's date (UTC, YYYY-MM-DD)", async () => {
    const { service, dashboardModel } = setup({}, new Date('2026-11-10T23:59:59Z'));
    await service.getDashboard();
    expect(dashboardModel.getMetrics).toHaveBeenCalledWith({ today: '2026-11-10' });
  });

  it('passes a number of overdue deliveries through once the model can count them', async () => {
    const { service } = setup({ overdueDeliveries: 3 });
    expect((await service.getDashboard()).overdueDeliveries).toBe(3);
  });

  it('keeps overdueDeliveries null while delivery dates are not tracked', async () => {
    const { service } = setup({ overdueDeliveries: null });
    expect((await service.getDashboard()).overdueDeliveries).toBeNull();
  });

  it('returns zeros and an empty list when there are no orders', async () => {
    const { service } = setup({
      totalOrders: 0,
      pendingOrders: 0,
      totalSpending: 0,
      ordersByStatus: {},
      recentOrders: [],
    });
    expect(await service.getDashboard()).toMatchObject({
      totalOrders: 0,
      pendingOrders: 0,
      totalSpending: 0,
      recentOrders: [],
    });
  });

  it('lets model errors propagate', async () => {
    const dashboardModel = { getMetrics: vi.fn().mockRejectedValue(new Error('db down')) };
    const service = createDashboardService({ dashboardModel });
    await expect(service.getDashboard()).rejects.toThrow('db down');
  });
});
