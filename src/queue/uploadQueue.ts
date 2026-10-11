import NetInfo from '@react-native-community/netinfo';
import {
  getDueQueueItems,
  getNote,
  getProcessingNotes,
  postponeQueueItem,
  removeQueueItem,
  setStatus,
  updateNote,
} from '@/db/notesRepo';
import { fromApiNote, notesApi, uploadNote } from '@/api/client';
import type { Note } from '@/types/note';
import { getDatabase } from '@/db/schema';

let runningUpload = false;
let runningSync = false;

export async function processUploadQueue(token: string | null) {
  if (!token || runningUpload) return;
  const network = await NetInfo.fetch();
  if (!network.isConnected || !network.isInternetReachable) return;
  runningUpload = true;
  try {
    for (const item of await getDueQueueItems()) {
      const note = await getNote(item.noteId);
      if (!note) {
        await removeQueueItem(item.noteId);
        continue;
      }
      try {
        await setStatus(note.id, 'uploading');
        await updateNote(note.id, {
          stage: 'uploading',
          stageMessage: 'Uploading audio to server...',
        });
        const result = await uploadNote(note, token);
        await updateNote(note.id, {
          serverId: result.noteId,
          status: 'processing',
          stage: result.stage ?? 'uploaded',
          stageMessage: 'Audio received by cloud server. Starting Gemini AI analysis...',
        });
        await removeQueueItem(note.id);
        // Kick off immediate sync to track live stage
        void syncProcessingNotes(token);
      } catch (error) {
        const attempts = item.attempts + 1;
        await postponeQueueItem(note.id, attempts);
        await setStatus(
          note.id,
          attempts >= 5 ? 'failed' : 'queued',
          error instanceof Error ? error.message : 'Upload failed'
        );
        await updateNote(note.id, {
          stage: attempts >= 5 ? 'failed' : 'queued',
          stageMessage: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }
  } finally {
    runningUpload = false;
  }
}

export async function syncProcessingNotes(token: string | null): Promise<boolean> {
  if (!token || runningSync) return false;
  const network = await NetInfo.fetch();
  if (!network.isConnected) return false;
  runningSync = true;
  let didChange = false;
  try {
    const processingNotes = await getProcessingNotes();
    for (const note of processingNotes) {
      if (!note.serverId) continue;
      try {
        const remote = await notesApi.get(note.serverId, token);
        const partial = fromApiNote(remote);
        const stageChanged = partial.stage && partial.stage !== note.stage;
        const msgChanged = partial.stageMessage && partial.stageMessage !== note.stageMessage;
        const statusChanged = remote.status !== note.status;
        const readyCompleted = remote.status === 'ready' && !note.summary;

        if (stageChanged || msgChanged || statusChanged || readyCompleted) {
          await updateNote(note.id, partial);
          didChange = true;
        }
      } catch {
        // Will retry on next sync cycle
      }
    }
  } finally {
    runningSync = false;
  }
  return didChange;
}

export async function retryNote(note: Note, token: string | null) {
  if (!token) return;
  if (note.serverId) {
    await updateNote(note.id, {
      status: 'processing',
      stage: 'transcribing',
      stageMessage: 'Restarting Gemini AI pipeline...',
      failureReason: null,
    });
    try {
      const remote = await notesApi.retry(note.serverId, token);
      await updateNote(note.id, fromApiNote(remote));
    } catch (err) {
      await updateNote(note.id, {
        status: 'failed',
        stage: 'failed',
        failureReason: err instanceof Error ? err.message : 'AI retry request failed',
      });
    }
  } else {
    const db = await getDatabase();
    await setStatus(note.id, 'queued', null);
    await db.runAsync(
      'INSERT OR REPLACE INTO upload_queue (note_id, attempts, next_retry_at) VALUES (?, ?, ?)',
      note.id,
      0,
      Date.now()
    );
    await processUploadQueue(token);
  }
}
