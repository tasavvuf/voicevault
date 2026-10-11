import NetInfo from '@react-native-community/netinfo';
import { getDueQueueItems, getNote, postponeQueueItem, removeQueueItem, setStatus, updateNote } from '@/db/notesRepo';
import { uploadNote } from '@/api/client';

let running = false;

export async function processUploadQueue(token: string | null) {
  if (!token || running) return;
  const network = await NetInfo.fetch();
  if (!network.isConnected || !network.isInternetReachable) return;
  running = true;
  try {
    for (const item of await getDueQueueItems()) {
      const note = await getNote(item.noteId);
      if (!note) { await removeQueueItem(item.noteId); continue; }
      try {
        await setStatus(note.id, 'uploading');
        const result = await uploadNote(note, token);
        await updateNote(note.id, { serverId: result.noteId, status: 'processing' });
        await removeQueueItem(note.id);
      } catch (error) {
        const attempts = item.attempts + 1;
        await postponeQueueItem(note.id, attempts);
        await setStatus(note.id, attempts >= 5 ? 'failed' : 'queued', error instanceof Error ? error.message : 'Upload failed');
      }
    }
  } finally { running = false; }
}
