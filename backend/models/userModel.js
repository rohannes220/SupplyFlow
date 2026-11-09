const COLUMNS = 'id, name, email, password_hash, role';

function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
  };
}

/** Data access for the users table. All queries are parameterized. */
export function createUserModel(db) {
  return {
    async findByEmail(email) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findById(id) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },
  };
}
