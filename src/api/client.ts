import type { ActionItem, Note } from '@/types/note';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

type ApiNote = { _id: string; clientId: string; status: Note['status']; title?: string; summary?: string; transcript?: string; tags?: string[]; actionItems?: ActionItem[]; createdAt: string; durationMs: number; failureReason?: string };

async function request<T>(path: string, options: RequestInit = {}, token?: string | null) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Request failed. Please try again.');
  return body as T;
}

export const authApi = {
  login: (email: string, password: string) => request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string) => request<{ token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
};

export async function uploadNote(note: Note, token: string) {
  const data = new FormData();
  data.append('clientId', note.id);
  data.append('durationMs', String(note.durationMs));
  data.append('audio', { uri: note.localAudioUri, type: 'audio/m4a', name: `${note.id}.m4a` } as unknown as Blob);
  return request<{ noteId: string; status: 'processing' }>('/notes', { method: 'POST', body: data }, token);
}

export const notesApi = {
  get: (id: string, token: string) => request<ApiNote>(`/notes/${id}`, {}, token),
  updateActionItems: (id: string, actionItems: ActionItem[], token: string) => request<ApiNote>(`/notes/${id}/action-items`, { method: 'PATCH', body: JSON.stringify({ actionItems }) }, token),
  remove: (id: string, token: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }, token),
  search: (query: string, token: string) => request<ApiNote[]>('/search', { method: 'POST', body: JSON.stringify({ query }) }, token),
};

export function fromApiNote(remote: ApiNote): Partial<Note> {
  return { serverId: remote._id, status: remote.status, title: remote.title ?? null, summary: remote.summary ?? null, transcript: remote.transcript ?? null, tags: remote.tags ?? [], actionItems: remote.actionItems ?? [], failureReason: remote.failureReason ?? null };
}
