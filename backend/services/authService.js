import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ConflictError, UnauthorizedError, ValidationError } from '../utils/errors.js';

export const ROLES = Object.freeze(['admin', 'employee']);

const JWT_ALGORITHM = 'HS256';
const DEFAULT_TOKEN_TTL = '8h';
const DEFAULT_BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  return { email: email.trim().toLowerCase(), password };
}

function validateRegistration(body) {
  const { name, email, password } = body ?? {};
  const errors = [];
  if (!isNonBlankString(name)) errors.push({ field: 'name', message: 'Name is required' });
  if (!isNonBlankString(email)) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.push({ field: 'email', message: 'Email must be a valid email address' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }
  if (errors.length > 0) throw new ValidationError(errors);
  return { name: name.trim(), email: email.trim().toLowerCase(), password };
}

/** Strips the password hash so it can never reach a response. */
function toPublicUser({ id, name, email, role }) {
  return { id, name, email, role };
}

export function createAuthService({
  userModel,
  jwtSecret,
  tokenTtl = DEFAULT_TOKEN_TTL,
  bcryptRounds = DEFAULT_BCRYPT_ROUNDS,
}) {
  if (!jwtSecret) throw new Error('JWT_SECRET is not set (see backend/.env.example)');

  const issueSession = (user) => {
    const token = jwt.sign({ role: user.role }, jwtSecret, {
      subject: String(user.id),
      expiresIn: tokenTtl,
      algorithm: JWT_ALGORITHM,
    });
    return { token, user: toPublicUser(user) };
  };

  return {
    async login(body) {
      const { email, password } = validateCredentials(body);
      const user = await userModel.findByEmail(email);
      const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !passwordMatches) throw new UnauthorizedError(INVALID_CREDENTIALS);

      return issueSession(user);
    },

    /** Self-service sign-up. The role is always 'employee'; admins are created out of band. */
    async register(body) {
      const { name, email, password } = validateRegistration(body);
      if (await userModel.findByEmail(email)) {
        throw new ConflictError('An account with this email already exists');
      }
      const passwordHash = await bcrypt.hash(password, bcryptRounds);
      const user = await userModel.create({ name, email, passwordHash, role: 'employee' });
      return issueSession(user);
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
