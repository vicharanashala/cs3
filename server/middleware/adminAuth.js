import { AuthError } from './errorHandler.js';

export function adminAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    throw new AuthError('Unauthorized');
  }
  next();
}

export default adminAuth;
