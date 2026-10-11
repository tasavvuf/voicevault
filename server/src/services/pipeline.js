import { Note } from '../models/Note.js';
import { transcribe } from './transcribe.js';
import { summarize } from './summarize.js';
import { embed } from './embed.js';

export async function processNote(noteId) {
  try {
    const note = await Note.findById(noteId);
    if (!note || note.status !== 'processing') return;
    const transcript = await transcribe(note.audioPath);
    const analysis = await summarize(transcript);
    const embedding = await embed([analysis.title, analysis.summary, transcript].join('\n\n'));
    await Note.findByIdAndUpdate(noteId, { ...analysis, transcript, embedding, status: 'ready', failureReason: null });
  } catch (error) {
    await Note.findByIdAndUpdate(noteId, { status: 'failed', failureReason: error instanceof Error ? error.message.slice(0, 300) : 'Processing failed.' });
  }
}
