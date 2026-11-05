// Test double that mirrors the interface of models/orderModel.js without PostgreSQL.
export function createInMemoryOrderModel(seed = []) {
  let rows = seed.map((row) => ({ ...row }));
  let nextId = rows.reduce((max, row) => Math.max(max, row.orderId), 0) + 1;

  return {
    async findAll() {
      return [...rows].sort((a, b) => b.orderId - a.orderId).map((row) => ({ ...row }));
    },
    async findById(orderId) {
      const row = rows.find((r) => r.orderId === orderId);
      return row ? { ...row } : null;
    },
    async create(order) {
      const now = new Date().toISOString();
      const row = { orderId: nextId++, ...order, status: 'Draft', createdAt: now, updatedAt: now };
      rows.push(row);
      return { ...row };
    },
    async update(orderId, order) {
      const index = rows.findIndex((r) => r.orderId === orderId);
      if (index === -1) return null;
      rows[index] = { ...rows[index], ...order, updatedAt: new Date().toISOString() };
      return { ...rows[index] };
    },
    async remove(orderId) {
      const before = rows.length;
      rows = rows.filter((r) => r.orderId !== orderId);
      return rows.length < before;
    },
  };
}

export const validOrderBody = Object.freeze({
  vendorId: 3,
  orderAmount: 2250.5,
  customerName: 'Sarah Chen',
  customerCity: 'Atlanta',
  customerState: 'GA',
  customerPhone: '(404) 555-0123',
});
