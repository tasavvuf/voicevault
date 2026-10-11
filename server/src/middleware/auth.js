import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authRequired(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ error: 'Authentication is required.' });
  try { request.user = jwt.verify(token, config.jwtSecret); return next(); }
  catch { return response.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}
