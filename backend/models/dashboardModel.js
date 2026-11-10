// Dashboard metrics computed with SQL aggregates; never loads every order.
// All queries are parameterized.

const RECENT_LIMIT = 5;

/** True once a migration adds orders.expected_delivery_date (checked per call, no restart needed). */
async function tracksDeliveryDates(db) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'orders'
        AND column_name = 'expected_delivery_date'`,
  );
  return rows[0].n > 0;
}

/** Orders past their expected delivery date that are not finished (Delivered/Cancelled). */
async function countOverdue(db, today) {
  if (!(await tracksDeliveryDates(db))) return null;
  const { rows } = await db.query(
    `SELECT count(*)::int AS n
       FROM orders
      WHERE expected_delivery_date < $1::date
        AND status NOT IN ('Delivered', 'Cancelled')`,
    [today],
  );
  return rows[0].n;
}

export function createDashboardModel(db) {
  return {
    /**
     * @param {{ today: string }} options today as YYYY-MM-DD, for overdue deliveries
     * @returns raw aggregates; ordersByStatus only has statuses that have orders
     */
    async getMetrics({ today }) {
      const [totals, byStatus, recent, vendors, overdueDeliveries] = await Promise.all([
        db.query(
          `SELECT count(*)::int AS total_orders,
                  count(*) FILTER (WHERE status = 'Pending')::int AS pending_orders,
                  COALESCE(sum(order_amount) FILTER (WHERE status <> 'Cancelled'), 0)
                    AS total_spending
             FROM orders`,
        ),
        db.query('SELECT status, count(*)::int AS n FROM orders GROUP BY status'),
        db.query(
          `SELECT order_id, vendor_id, order_amount, status
             FROM orders
            ORDER BY created_at DESC, order_id DESC
            LIMIT $1`,
          [RECENT_LIMIT],
        ),
        db.query("SELECT count(*)::int AS n FROM vendors WHERE status = 'Active'"),
        countOverdue(db, today),
      ]);

      const t = totals.rows[0];
      return {
        totalOrders: t.total_orders,
        pendingOrders: t.pending_orders,
        totalSpending: Number(t.total_spending), // pg returns NUMERIC as a string
        ordersByStatus: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.n])),
        recentOrders: recent.rows.map((r) => ({
          id: r.order_id,
          vendorId: r.vendor_id,
          amount: Number(r.order_amount),
          status: r.status,
        })),
        activeVendors: vendors.rows[0].n,
        overdueDeliveries,
      };
    },
  };
}
