import fs from 'node:fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { Note } from '../models/Note.js';
import { upload } from '../middleware/upload.js';
import { processNote } from '../services/pipeline.js';

const router = Router();
const actionItems = z.object({ actionItems: z.array(z.object({ text: z.string().min(1).max(240), done: z.boolean() })).max(12) });
const uploadInput = z.object({ clientId: z.string().min(8).max(100), durationMs: z.coerce.number().int().min(0).max(180_000) });
const serialize = (note) => ({ _id: note.id, clientId: note.clientId, durationMs: note.durationMs, status: note.status, transcript: note.transcript, title: note.title, summary: note.summary, tags: note.tags, actionItems: note.actionItems, failureReason: note.failureReason, createdAt: note.createdAt });

router.post('/', upload.single('audio'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(400).json({ error: 'An audio file is required.' });
    const input = uploadInput.parse(request.body);
    const existing = await Note.findOne({ userId: request.user.sub, clientId: input.clientId });
    if (existing) { await fs.unlink(request.file.path).catch(() => {}); return response.json({ noteId: existing.id, status: existing.status }); }
    const note = await Note.create({ userId: request.user.sub, clientId: input.clientId, audioPath: request.file.path, durationMs: input.durationMs });
    response.status(202).json({ noteId: note.id, status: 'processing' });
    void processNote(note.id);
  } catch (error) { if (request.file) await fs.unlink(request.file.path).catch(() => {}); next(error); }
});

router.get('/', async (request, response, next) => {
  try {
    const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 50);
    const filter = { userId: request.user.sub, ...(request.query.cursor ? { _id: { $lt: request.query.cursor } } : {}) };
    const notes = await Note.find(filter).sort({ _id: -1 }).limit(limit + 1);
    const hasMore = notes.length > limit; if (hasMore) notes.pop();
    return response.json({ notes: notes.map(serialize), nextCursor: hasMore ? notes.at(-1)?.id ?? null : null });
  } catch (error) { return next(error); }
});

router.get('/:id', async (request, response, next) => {
  try { const note = await Note.findOne({ _id: request.params.id, userId: request.user.sub }); return note ? response.json(serialize(note)) : response.status(404).json({ error: 'Note not found.' }); }
  catch (error) { return next(error); }
});

router.patch('/:id/action-items', async (request, response, next) => {
  try { const input = actionItems.parse(request.body); const note = await Note.findOneAndUpdate({ _id: request.params.id, userId: request.user.sub }, { actionItems: input.actionItems }, { new: true }); return note ? response.json(serialize(note)) : response.status(404).json({ error: 'Note not found.' }); }
  catch (error) { return next(error); }
});

router.post('/:id/retry', async (request, response, next) => {
  try {
    const note = await Note.findOne({ _id: request.params.id, userId: request.user.sub });
    if (!note) return response.status(404).json({ error: 'Note not found.' });
    note.status = 'processing';
    note.failureReason = null;
    await note.save();
    void processNote(note.id);
    return response.json(serialize(note));
  } catch (error) { return next(error); }
});

router.delete('/:id', async (request, response, next) => {
  try { const note = await Note.findOneAndDelete({ _id: request.params.id, userId: request.user.sub }); if (!note) return response.status(404).json({ error: 'Note not found.' }); await fs.unlink(note.audioPath).catch(() => {}); return response.status(204).end(); }
  catch (error) { return next(error); }
});

export default router;
