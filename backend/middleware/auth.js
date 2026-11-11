import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

const BEARER = /^Bearer (\S+)$/;

/** Verifies the Bearer JWT and sets req.user = { id, role }. Responds 401 otherwise. */
export function requireAuth(authService) {
  return (req, _res, next) => {
    const match = BEARER.exec(req.get('Authorization') ?? '');
    if (!match) return next(new UnauthorizedError());
    try {
      req.user = authService.verifyToken(match[1]);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/** Allows only the given roles. Use after requireAuth. Responds 403 for other roles. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    return next();
  };
}
