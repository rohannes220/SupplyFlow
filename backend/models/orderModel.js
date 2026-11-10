const COLUMNS = `order_id, vendor_id, order_amount, customer_name, customer_city,
  customer_state, customer_phone, status, created_by, created_at, updated_at`;

function toOrder(row) {
  return {
    orderId: row.order_id,
    vendorId: row.vendor_id,
    orderAmount: Number(row.order_amount), // pg returns NUMERIC as a string
    customerName: row.customer_name,
    customerCity: row.customer_city,
    customerState: row.customer_state,
    customerPhone: row.customer_phone,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toParams(order) {
  return [
    order.vendorId,
    order.orderAmount,
    order.customerName,
    order.customerCity,
    order.customerState,
    order.customerPhone,
  ];
}

/** Data access for the orders table. All queries are parameterized. */
export function createOrderModel(db) {
  return {
    async findAll() {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM orders ORDER BY order_id DESC`);
      return rows.map(toOrder);
    },

    async findById(orderId) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM orders WHERE order_id = $1`, [
        orderId,
      ]);
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async create(order) {
      const { rows } = await db.query(
        `WITH active_vendor AS MATERIALIZED (
           SELECT id FROM vendors WHERE id = $1 AND status = 'Active' FOR SHARE
         )
         INSERT INTO orders (vendor_id, order_amount, customer_name, customer_city,
           customer_state, customer_phone, created_by)
         SELECT $1, $2, $3, $4, $5, $6, $7 FROM active_vendor
         RETURNING ${COLUMNS}`,
        [...toParams(order), order.createdBy ?? null],
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async update(orderId, order, expectedStatus) {
      const { rows } = await db.query(
        `WITH active_vendor AS MATERIALIZED (
           SELECT id FROM vendors WHERE id = $1 AND status = 'Active' FOR SHARE
         )
         UPDATE orders
            SET vendor_id = $1, order_amount = $2, customer_name = $3, customer_city = $4,
                customer_state = $5, customer_phone = $6, updated_at = now()
          WHERE order_id = $7
            AND status = $8
            AND (vendor_id = $1 OR EXISTS (SELECT 1 FROM active_vendor))
         RETURNING ${COLUMNS}`,
        [...toParams(order), orderId, expectedStatus],
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async updateStatus(orderId, status, expectedStatus) {
      const { rows } = await db.query(
        `UPDATE orders
            SET status = $1, updated_at = now()
          WHERE order_id = $2 AND status = $3
         RETURNING ${COLUMNS}`,
        [status, orderId, expectedStatus],
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async remove(orderId, expectedStatus) {
      const { rowCount } = await db.query(
        'DELETE FROM orders WHERE order_id = $1 AND status = $2',
        [orderId, expectedStatus],
      );
      return rowCount > 0;
    },
  };
}
