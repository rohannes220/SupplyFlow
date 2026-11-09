import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

export const ROLES = Object.freeze(['admin', 'employee']);

const JWT_ALGORITHM = 'HS256';
const DEFAULT_TOKEN_TTL = '8h';
const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_TOKEN = 'Invalid or expired token';

// bcrypt hash of a random throwaway value (not a secret). Comparing against it when the
// email is unknown keeps response times similar, so timing doesn't reveal which emails exist.
const DUMMY_HASH = '$2b$12$2vXU4ylCkn82M6fjTihrKu3GkI4B/ORM6rhEiWP/Xc.Zmt.4UXFHO';

const isNonBlankString = (value) => typeof value === 'string' && value.trim() !== '';

function validateCredentials(body) {
  const { email, password } = body ?? {};
  const errors = [];
  if (!isNonBlankString(email)) errors.push({ field: 'email', message: 'Email is required' });
  if (!isNonBlankString(password)) {
    errors.push({ field: 'password', message: 'Password is required' });
  }
  if (errors.length > 0) throw new ValidationError(errors);
  return { email: email.trim(), password };
}

/** Strips the password hash so it can never reach a response. */
function toPublicUser({ id, name, email, role }) {
  return { id, name, email, role };
}

export function createAuthService({ userModel, jwtSecret, tokenTtl = DEFAULT_TOKEN_TTL }) {
  if (!jwtSecret) throw new Error('JWT_SECRET is not set (see backend/.env.example)');

  return {
    async login(body) {
      const { email, password } = validateCredentials(body);
      const user = await userModel.findByEmail(email);
      const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !passwordMatches) throw new UnauthorizedError(INVALID_CREDENTIALS);

      const token = jwt.sign({ role: user.role }, jwtSecret, {
        subject: String(user.id),
        expiresIn: tokenTtl,
        algorithm: JWT_ALGORITHM,
      });
      return { token, user: toPublicUser(user) };
    },

    /** Returns { id, role } from a token this service issued, or throws UnauthorizedError. */
    verifyToken(token) {
      let payload;
      try {
        payload = jwt.verify(token, jwtSecret, { algorithms: [JWT_ALGORITHM] });
      } catch {
        throw new UnauthorizedError(INVALID_TOKEN);
      }
      const id = /^\d+$/.test(payload.sub ?? '') ? Number(payload.sub) : NaN;
      if (!Number.isSafeInteger(id) || id < 1 || !ROLES.includes(payload.role)) {
        throw new UnauthorizedError(INVALID_TOKEN);
      }
      return { id, role: payload.role };
    },

    async getCurrentUser(id) {
      const user = await userModel.findById(id);
      if (!user) throw new UnauthorizedError(INVALID_TOKEN);
      return toPublicUser(user);
    },
  };
}
