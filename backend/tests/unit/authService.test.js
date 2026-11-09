import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createAuthService } from '../../services/authService.js';
import { UnauthorizedError, ValidationError } from '../../utils/errors.js';
import {
  createInMemoryUserModel,
  demoUsers,
  TEST_JWT_SECRET,
} from '../helpers/inMemoryUserModel.js';

const { admin, employee } = demoUsers;

describe('authService', () => {
  let service;

  beforeEach(() => {
    service = createAuthService({
      userModel: createInMemoryUserModel(),
      jwtSecret: TEST_JWT_SECRET,
    });
  });

  it('refuses to start without a JWT secret', () => {
    expect(() => createAuthService({ userModel: createInMemoryUserModel() })).toThrow(/JWT_SECRET/);
    expect(() =>
      createAuthService({ userModel: createInMemoryUserModel(), jwtSecret: '' }),
    ).toThrow(/JWT_SECRET/);
  });

  describe('login', () => {
    it('returns a signed token and the public user for valid credentials', async () => {
      const result = await service.login({ email: admin.email, password: admin.password });

      expect(result.user).toEqual({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
      });
      const payload = jwt.verify(result.token, TEST_JWT_SECRET);
      expect(payload).toMatchObject({ sub: String(admin.id), role: 'admin' });
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('logs in an employee with the employee role', async () => {
      const { user } = await service.login({ email: employee.email, password: employee.password });
      expect(user.role).toBe('employee');
    });

    it('never exposes the password hash', async () => {
      const result = await service.login({ email: admin.email, password: admin.password });
      expect(JSON.stringify(result)).not.toMatch(/passwordHash|\$2[aby]\$/);
    });

    it('rejects a wrong password with UnauthorizedError', async () => {
      await expect(service.login({ email: admin.email, password: 'wrong' })).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('rejects an unknown email with the same message as a wrong password', async () => {
      const wrongPassword = await service
        .login({ email: admin.email, password: 'wrong' })
        .catch((e) => e);
      const unknownEmail = await service
        .login({ email: 'nobody@supplyflow.com', password: 'whatever' })
        .catch((e) => e);

      expect(unknownEmail).toBeInstanceOf(UnauthorizedError);
      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.message).toBe(wrongPassword.message);
    });

    it.each([
      [{}, ['email', 'password']],
      [{ email: admin.email }, ['password']],
      [{ password: admin.password }, ['email']],
      [{ email: '   ', password: '' }, ['email', 'password']],
      [{ email: 42, password: ['x'] }, ['email', 'password']],
    ])('rejects missing or non-string fields %j with ValidationError', async (body, fields) => {
      const err = await service.login(body).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.status).toBe(400);
      expect(err.details.map((d) => d.field).sort()).toEqual(fields);
    });

    it('treats a missing body as missing fields', async () => {
      await expect(service.login(undefined)).rejects.toThrow(ValidationError);
    });
  });

  describe('verifyToken', () => {
    it('returns the user id and role from a token it issued', async () => {
      const { token } = await service.login({ email: employee.email, password: employee.password });
      expect(service.verifyToken(token)).toEqual({ id: employee.id, role: 'employee' });
    });

    it.each([
      ['a malformed token', 'not-a-jwt'],
      ['a token signed with another secret', jwt.sign({ sub: '1', role: 'admin' }, 'other-secret')],
      [
        'an expired token',
        jwt.sign({ sub: '1', role: 'admin' }, TEST_JWT_SECRET, { expiresIn: -10 }),
      ],
      [
        'an unsigned (alg: none) token',
        jwt.sign({ sub: '1', role: 'admin' }, null, { algorithm: 'none' }),
      ],
      ['an empty token', ''],
    ])('throws UnauthorizedError for %s', (_label, token) => {
      expect(() => service.verifyToken(token)).toThrow(UnauthorizedError);
    });
  });

  describe('getCurrentUser', () => {
    it('returns the public user for an existing id', async () => {
      expect(await service.getCurrentUser(admin.id)).toEqual({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
      });
    });

    it('throws UnauthorizedError when the user no longer exists', async () => {
      await expect(service.getCurrentUser(999)).rejects.toThrow(UnauthorizedError);
    });
  });
});
