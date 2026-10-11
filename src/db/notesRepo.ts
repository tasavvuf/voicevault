import { getDatabase } from '@/db/schema';
import type { ActionItem, Note, NoteStatus, UploadQueueItem } from '@/types/note';

type NoteRow = {
  id: string; local_audio_uri: string; duration_ms: number; created_at: number; status: NoteStatus;
  title: string | null; summary: string | null; transcript: string | null; tags: string; action_items: string;
  server_id: string | null; failure_reason: string | null;
};

function decode(row: NoteRow): Note {
  return {
    id: row.id, localAudioUri: row.local_audio_uri, durationMs: row.duration_ms, createdAt: row.created_at,
    status: row.status, title: row.title, summary: row.summary, transcript: row.transcript,
    tags: JSON.parse(row.tags || '[]'), actionItems: JSON.parse(row.action_items || '[]'),
    serverId: row.server_id, failureReason: row.failure_reason,
  } as Note;
}

export async function createLocalNote(note: Pick<Note, 'id' | 'localAudioUri' | 'durationMs' | 'createdAt'>) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('INSERT INTO notes (id, local_audio_uri, duration_ms, created_at, status) VALUES (?, ?, ?, ?, ?)', note.id, note.localAudioUri, note.durationMs, note.createdAt, 'queued');
    await tx.runAsync('INSERT INTO upload_queue (note_id, attempts, next_retry_at) VALUES (?, ?, ?)', note.id, 0, Date.now());
  });
}

export async function listNotes() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY created_at DESC');
  return rows.map(decode);
}

export async function getNote(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', id);
  return row ? decode(row) : null;
}

export async function updateNote(id: string, patch: Partial<Pick<Note, 'status' | 'title' | 'summary' | 'transcript' | 'tags' | 'actionItems' | 'serverId' | 'failureReason'>>) {
  const db = await getDatabase();
  const values: Record<string, string | number | null> = { ...patch } as Record<string, string | number | null>;
  if (values.tags) values.tags = JSON.stringify(values.tags);
  if (values.actionItems) values.actionItems = JSON.stringify(values.actionItems);
  const fields = Object.keys(values);
  if (!fields.length) return;
  const column = (key: string) => ({ serverId: 'server_id', actionItems: 'action_items', failureReason: 'failure_reason' }[key] ?? key);
  await db.runAsync(`UPDATE notes SET ${fields.map((field) => `${column(field)} = ?`).join(', ')} WHERE id = ?`, ...fields.map((field) => values[field]), id);
}

export async function deleteNote(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function getDueQueueItems() {
  const db = await getDatabase();
  return db.getAllAsync<UploadQueueItem & { note_id: string; next_retry_at: number }>('SELECT note_id AS noteId, attempts, next_retry_at AS nextRetryAt FROM upload_queue WHERE next_retry_at <= ? ORDER BY next_retry_at ASC', Date.now());
}

export async function removeQueueItem(noteId: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM upload_queue WHERE note_id = ?', noteId);
}

export async function postponeQueueItem(noteId: string, attempts: number) {
  const db = await getDatabase();
  const delay = Math.min(60_000 * 2 ** attempts, 60 * 60_000);
  await db.runAsync('UPDATE upload_queue SET attempts = ?, next_retry_at = ? WHERE note_id = ?', attempts, Date.now() + delay, noteId);
}

export async function updateActionItems(id: string, items: ActionItem[]) {
  await updateNote(id, { actionItems: items });
}

export async function setStatus(id: string, status: NoteStatus, failureReason?: string | null) {
  await updateNote(id, { status, failureReason: failureReason ?? null });
}
