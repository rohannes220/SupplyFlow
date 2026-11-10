import { ConflictError } from '../utils/errors.js';

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
    async listPublic() {
      const { rows } = await db.query('SELECT id, name, email, role FROM users ORDER BY name, id');
      return rows;
    },

    async findByEmail(email) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findById(id) {
      const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    /** Inserts a user; a duplicate email (unique violation) becomes a ConflictError. */
    async create({ name, email, passwordHash, role }) {
      try {
        const { rows } = await db.query(
          `INSERT INTO users (name, email, password_hash, role)
           VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
          [name, email, passwordHash, role],
        );
        return toUser(rows[0]);
      } catch (err) {
        if (err.code === '23505') {
          throw new ConflictError('An account with this email already exists');
        }
        throw err;
      }
    },
  };
}
