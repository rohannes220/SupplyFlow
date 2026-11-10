import { ORDER_STATUSES } from '@supplyflow/shared/orderRules';

/** YYYY-MM-DD in UTC. */
const isoDate = (date) => date.toISOString().slice(0, 10);

/**
 * Shapes the dashboard model's aggregates for the API: every status present (0 if none),
 * spending rounded to cents, and overdueDeliveries null until delivery dates are tracked.
 */
export function createDashboardService({ dashboardModel, now = () => new Date() }) {
  return {
    async getDashboard() {
      const m = await dashboardModel.getMetrics({ today: isoDate(now()) });
      return {
        totalOrders: m.totalOrders,
        pendingOrders: m.pendingOrders,
        activeVendors: m.activeVendors,
        totalSpending: Math.round(m.totalSpending * 100) / 100,
        overdueDeliveries: m.overdueDeliveries ?? null,
        ordersByStatus: Object.fromEntries(
          ORDER_STATUSES.map((status) => [status, m.ordersByStatus[status] ?? 0]),
        ),
        recentOrders: m.recentOrders,
      };
    },
  };
}
