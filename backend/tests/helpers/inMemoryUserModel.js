// Test double that mirrors the interface of models/userModel.js without PostgreSQL.
import bcrypt from 'bcryptjs';
import { ConflictError } from '../../utils/errors.js';

export const TEST_JWT_SECRET = 'test-only-jwt-secret-not-used-anywhere-else';

// Plain-text passwords exist only in tests; the model stores bcrypt hashes.
// Cost 4 keeps the suite fast; production hashing uses a higher cost.
export const demoUsers = Object.freeze({
  admin: Object.freeze({
    id: 1,
    name: 'Ava Admin',
    email: 'admin@supplyflow.com',
    role: 'admin',
    password: 'Admin#Pass123',
  }),
  employee: Object.freeze({
    id: 2,
    name: 'Eli Employee',
    email: 'employee@supplyflow.com',
    role: 'employee',
    password: 'Employee#Pass123',
  }),
});

function toRow({ password, ...user }) {
  return { ...user, passwordHash: bcrypt.hashSync(password, 4) };
}

export function createInMemoryUserModel(seed = Object.values(demoUsers)) {
  const rows = seed.map(toRow);

  return {
    async findByEmail(email) {
      const row = rows.find((r) => r.email === email);
      return row ? { ...row } : null;
    },
    async findById(id) {
      const row = rows.find((r) => r.id === id);
      return row ? { ...row } : null;
    },
    async create({ name, email, passwordHash, role }) {
      if (rows.some((r) => r.email === email)) throw new ConflictError('Email already exists');
      const row = {
        id: Math.max(0, ...rows.map((r) => r.id)) + 1,
        name,
        email,
        passwordHash,
        role,
      };
      rows.push(row);
      return { ...row };
    },
  };
}
