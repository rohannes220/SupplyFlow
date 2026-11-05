import { AppError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found` } });
}

export function createErrorHandler(logger = console) {
  // Express identifies error middleware by its four-argument signature.
  return (err, _req, res, _next) => {
    if (err instanceof AppError) {
      const body = { message: err.message };
      if (err.details) body.details = err.details;
      return res.status(err.status).json({ error: body });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: { message: 'Request body is too large' } });
    }
    logger.error(err);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  };
}
