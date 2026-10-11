import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import searchRoutes from './routes/search.js';
import { authRequired } from './middleware/auth.js';

config.assertStartup();
await mongoose.connect(config.mongoUri);

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many AI requests. Please try again in a few minutes.' } });
app.get('/health', (_request, response) => response.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/notes', authRequired, aiLimiter, notesRoutes);
app.use('/search', authRequired, aiLimiter, searchRoutes);
app.use((error, _request, response, _next) => {
  if (error instanceof ZodError) return response.status(400).json({ error: 'Invalid request data.', details: error.flatten() });
  if (error?.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'Audio must be 10 MB or smaller.' });
  console.error(error);
  return response.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(config.port, () => console.log(`VoiceVault API listening on ${config.port}`));
