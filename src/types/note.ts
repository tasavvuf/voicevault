export type NoteStatus = 'queued' | 'uploading' | 'processing' | 'ready' | 'failed';

export type ActionItem = { text: string; done: boolean };

export type Note = {
  id: string;
  localAudioUri: string;
  durationMs: number;
  createdAt: number;
  status: NoteStatus;
  title: string | null;
  summary: string | null;
  transcript: string | null;
  tags: string[];
  actionItems: ActionItem[];
  serverId: string | null;
  failureReason: string | null;
};

export type UploadQueueItem = { noteId: string; attempts: number; nextRetryAt: number };
