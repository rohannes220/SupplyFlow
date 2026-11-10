// In-memory counterpart of models/dashboardModel.js for tests and the dev fallback (no PostgreSQL).
// Reads the in-memory order and vendor models on every call, so metrics are always current.

const RECENT_LIMIT = 5;
const FINISHED = ['Delivered', 'Cancelled'];

const newestFirst = (a, b) =>
  String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) || b.orderId - a.orderId;

const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);

export function createInMemoryDashboardModel({ orderModel, vendorModel }) {
  return {
    async getMetrics({ today }) {
      const orders = await orderModel.findAll();
      const vendors = vendorModel ? await vendorModel.findAll() : [];

      const ordersByStatus = {};
      for (const o of orders) ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;

      // Like the SQL model: null until orders carry an expected delivery date.
      const tracksDates = orders.some((o) => Object.hasOwn(o, 'expectedDeliveryDate'));
      const overdueDeliveries = tracksDates
        ? orders.filter((o) => {
            const due = dateOnly(o.expectedDeliveryDate);
            return due !== null && due < today && !FINISHED.includes(o.status);
          }).length
        : null;

      return {
        totalOrders: orders.length,
        pendingOrders: ordersByStatus.Pending ?? 0,
        totalSpending: orders
          .filter((o) => o.status !== 'Cancelled')
          .reduce((sum, o) => sum + Number(o.orderAmount), 0),
        ordersByStatus,
        recentOrders: [...orders]
          .sort(newestFirst)
          .slice(0, RECENT_LIMIT)
          .map((o) => ({
            id: o.orderId,
            vendorId: o.vendorId,
            amount: o.orderAmount,
            status: o.status,
          })),
        activeVendors: vendors.filter((v) => v.status === 'Active').length,
        overdueDeliveries,
      };
    },
  };
}
