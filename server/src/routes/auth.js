import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { config } from '../config.js';

const router = Router();
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(1).max(80) });
const issueToken = (user) => jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '30d' });

router.post('/register', async (request, response, next) => {
  try { const input = registration.parse(request.body); const exists = await User.exists({ email: input.email.toLowerCase() }); if (exists) return response.status(409).json({ error: 'An account with that email already exists.' }); const user = await User.create({ name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12) }); return response.status(201).json({ token: issueToken(user) }); }
  catch (error) { return next(error); }
});

router.post('/login', async (request, response, next) => {
  try { const input = credentials.parse(request.body); const user = await User.findOne({ email: input.email.toLowerCase() }); if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return response.status(401).json({ error: 'Email or password is incorrect.' }); return response.json({ token: issueToken(user) }); }
  catch (error) { return next(error); }
});

router.get('/imagekit', (request, response) => {
  if (!config.imagekitPrivateKey || !config.imagekitPublicKey) {
    return response.status(503).json({ error: 'ImageKit is not configured.' });
  }
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 1800;
  const signature = crypto
    .createHmac('sha1', config.imagekitPrivateKey)
    .update(token + expire)
    .digest('hex');
  return response.json({
    token,
    expire,
    signature,
    publicKey: config.imagekitPublicKey,
    urlEndpoint: config.imagekitUrlEndpoint,
  });
});

export default router;
