const COLUMNS = 'id, name, email, phone, city, state, status, created_at';

function toVendor(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    status: row.status,
    createdAt: row.created_at,
  };
}

const toParams = (v) => [v.name, v.email, v.phone, v.city, v.state, v.status];

// Makes % and _ in user input match literally in ILIKE (escape character is \).
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

/** Data access for the vendors table. All queries are parameterized. */
export function createVendorModel(db) {
  return {
    /** @param {{ search?: string, status?: 'Active' | 'Inactive' }} filters */
    async findAll({ search, status } = {}) {
      const where = [];
      const params = [];
      if (search) {
        params.push(likePattern(search));
        where.push(`name ILIKE $${params.length} ESCAPE '\\'`);
      }
      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      const { rows } = await db.query(
        `SELECT ${COLUMNS} FROM vendors
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY name, id`,
        params,
      );
      return rows.map(toVendor);
    },

    async findById(id) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM vendors WHERE id = $1`, [id]);
      return rows[0] ? toVendor(rows[0]) : null;
    },

    /** True only for an existing Active vendor. Orders use this to block inactive vendors. */
    async isActive(id) {
      const { rows } = await db.query(
        "SELECT EXISTS (SELECT 1 FROM vendors WHERE id = $1 AND status = 'Active') AS active",
        [id],
      );
      return rows[0].active;
    },

    async create(vendor) {
      const { rows } = await db.query(
        `INSERT INTO vendors (name, email, phone, city, state, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        toParams(vendor),
      );
      return toVendor(rows[0]);
    },

    async update(id, vendor) {
      const { rows } = await db.query(
        `UPDATE vendors
            SET name = $1, email = $2, phone = $3, city = $4, state = $5, status = $6
          WHERE id = $7
         RETURNING ${COLUMNS}`,
        [...toParams(vendor), id],
      );
      return rows[0] ? toVendor(rows[0]) : null;
    },
  };
}
