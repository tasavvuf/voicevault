import { Note } from '../models/Note.js';
import { transcribe } from './transcribe.js';
import { summarize } from './summarize.js';
import { embed } from './embed.js';

export async function processNote(noteId) {
  try {
    const note = await Note.findById(noteId);
    if (!note || note.status !== 'processing') return;

    // Stage 1: Transcribe with Gemini
    await Note.findByIdAndUpdate(noteId, {
      stage: 'transcribing',
      stageMessage: 'Transcribing speech to text with Gemini 3.5 Transcribe...',
    });
    const transcript = await transcribe(note.audioPath);

    // Stage 2: Summarize and extract action items
    await Note.findByIdAndUpdate(noteId, {
      transcript,
      stage: 'summarizing',
      stageMessage: 'Extracting title, summary & action items with Gemini 3.8...',
    });
    const analysis = await summarize(transcript);

    // Stage 3: Semantic embedding
    await Note.findByIdAndUpdate(noteId, {
      ...analysis,
      stage: 'embedding',
      stageMessage: 'Generating 768-dim semantic embedding vectors...',
    });
    const embedding = await embed([analysis.title, analysis.summary, transcript].join('\n\n'));

    // Stage 4: Ready
    await Note.findByIdAndUpdate(noteId, {
      ...analysis,
      transcript,
      embedding,
      status: 'ready',
      stage: 'ready',
      stageMessage: 'AI processing completed successfully.',
      failureReason: null,
    });
  } catch (error) {
    await Note.findByIdAndUpdate(noteId, {
      status: 'failed',
      stage: 'failed',
      stageMessage: 'AI pipeline encountered an error.',
      failureReason: error instanceof Error ? error.message.slice(0, 300) : 'Processing failed.',
    });
  }
}
