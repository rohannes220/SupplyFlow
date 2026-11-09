export class AppError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    if (details) this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details, message = 'Validation failed') {
    super(message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
  }
}
