import { Router } from 'express';
import { z } from 'zod';
import { Note } from '../models/Note.js';
import { embed, cosineSimilarity } from '../services/embed.js';

const router = Router();
const inputSchema = z.object({ query: z.string().trim().min(2).max(500) });
const serialize = (note) => ({ _id: note.id, clientId: note.clientId, durationMs: note.durationMs, status: note.status, transcript: note.transcript, title: note.title, summary: note.summary, tags: note.tags, actionItems: note.actionItems, failureReason: note.failureReason, createdAt: note.createdAt });

router.post('/', async (request, response, next) => {
  try { const { query } = inputSchema.parse(request.body); const queryEmbedding = await embed(query); const notes = await Note.find({ userId: request.user.sub, status: 'ready', 'embedding.0': { $exists: true } }); const ranked = notes.map((note) => ({ note, score: cosineSimilarity(queryEmbedding, note.embedding) })).filter(({ score }) => score >= 0).sort((left, right) => right.score - left.score).slice(0, 10).map(({ note }) => serialize(note)); return response.json(ranked); }
  catch (error) { return next(error); }
});

export default router;
