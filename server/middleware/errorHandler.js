export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
    this.code = 401;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
    this.code = 404;
  }
}

export class ValidationError extends Error {
  constructor(message = 'Validation Error') {
    super(message);
    this.name = 'ValidationError';
    this.code = 400;
  }
}

export function errorHandler(err, req, res, next) {
  let statusCode = err.code || 500;
  let message = err.message || 'Internal Server Error';

  // Support name/type mapping if not thrown as class directly
  if (err.name === 'AuthError') statusCode = 401;
  if (err.name === 'NotFoundError') statusCode = 404;
  if (err.name === 'ValidationError') statusCode = 400;

  // Final fallback verification
  if (statusCode !== 401 && statusCode !== 404 && statusCode !== 400) {
    statusCode = 500;
  }

  const response = {
    success: false,
    error: message,
    code: statusCode
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export default errorHandler;
