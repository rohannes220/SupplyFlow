const COLUMNS = `order_id, vendor_id, order_amount, customer_name, customer_city,
  customer_state, customer_phone, status, created_at, updated_at`;

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
        `INSERT INTO orders (vendor_id, order_amount, customer_name, customer_city,
           customer_state, customer_phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        toParams(order),
      );
      return toOrder(rows[0]);
    },

    async update(orderId, order) {
      const { rows } = await db.query(
        `UPDATE orders
            SET vendor_id = $1, order_amount = $2, customer_name = $3, customer_city = $4,
                customer_state = $5, customer_phone = $6, updated_at = now()
          WHERE order_id = $7
         RETURNING ${COLUMNS}`,
        [...toParams(order), orderId],
      );
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async remove(orderId) {
      const { rowCount } = await db.query('DELETE FROM orders WHERE order_id = $1', [orderId]);
      return rowCount > 0;
    },
  };
}
