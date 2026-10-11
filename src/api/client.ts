import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { ActionItem, Note, PipelineStage } from '@/types/note';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://voicevault-lc8n.onrender.com';

export type ApiCallTelemetry = {
  endpoint: string;
  method: string;
  status: 'pending' | 'success' | 'error';
  statusCode?: number;
  message?: string;
  timestamp: number;
  durationMs?: number;
};

type ApiListener = (telemetry: ApiCallTelemetry) => void;
const apiListeners = new Set<ApiListener>();

export function subscribeApiTelemetry(listener: ApiListener) {
  apiListeners.add(listener);
  return () => {
    apiListeners.delete(listener);
  };
}

let lastTelemetry: ApiCallTelemetry | null = null;
export function getLastApiTelemetry(): ApiCallTelemetry | null {
  return lastTelemetry;
}

function notifyTelemetry(t: ApiCallTelemetry) {
  lastTelemetry = t;
  for (const listener of apiListeners) {
    try {
      listener(t);
    } catch {}
  }
}

type ApiNote = {
  _id: string;
  clientId: string;
  status: Note['status'];
  stage?: PipelineStage;
  stageMessage?: string;
  title?: string;
  summary?: string;
  transcript?: string;
  tags?: string[];
  actionItems?: ActionItem[];
  createdAt: string;
  durationMs: number;
  failureReason?: string;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string | null) {
  const method = (options.method ?? 'GET').toUpperCase();
  const startTime = Date.now();
  notifyTelemetry({
    endpoint: path,
    method,
    status: 'pending',
    timestamp: startTime,
  });

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const body = await response.json().catch(() => ({}));
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorMsg = body.error ?? `Request failed (${response.status})`;
      notifyTelemetry({
        endpoint: path,
        method,
        status: 'error',
        statusCode: response.status,
        message: errorMsg,
        timestamp: Date.now(),
        durationMs,
      });
      throw new Error(errorMsg);
    }

    notifyTelemetry({
      endpoint: path,
      method,
      status: 'success',
      statusCode: response.status,
      timestamp: Date.now(),
      durationMs,
    });

    return body as T;
  } catch (err) {
    if (lastTelemetry?.endpoint === path && lastTelemetry.status === 'pending') {
      notifyTelemetry({
        endpoint: path,
        method,
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      });
    }
    throw err;
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string) =>
    request<{ token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
};

export async function uploadNote(note: Note, token: string) {
  const startTime = Date.now();
  notifyTelemetry({
    endpoint: '/notes',
    method: 'POST',
    status: 'pending',
    timestamp: startTime,
  });

  try {
    if (Platform.OS === 'web') {
      const res = await fetch(note.localAudioUri);
      const blob = await res.blob();
      const data = new FormData();
      data.append('clientId', note.id);
      data.append('durationMs', String(note.durationMs));
      data.append('audio', blob, `${note.id}.m4a`);
      return await request<{ noteId: string; status: 'processing'; stage?: PipelineStage }>(
        '/notes',
        { method: 'POST', body: data },
        token
      );
    }

    // Step 1: Attempt Direct-to-ImageKit Upload (Bypasses Render server audio bandwidth)
    try {
      const ikAuth = await request<{
        token: string;
        expire: number;
        signature: string;
        publicKey: string;
        urlEndpoint: string;
      }>('/auth/imagekit', {}, token);

      if (ikAuth?.publicKey && ikAuth?.signature) {
        notifyTelemetry({
          endpoint: 'upload.imagekit.io',
          method: 'POST',
          status: 'pending',
          timestamp: Date.now(),
        });

        const ikUpload = await FileSystem.uploadAsync(
          'https://upload.imagekit.io/api/v1/files/upload',
          note.localAudioUri,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            parameters: {
              fileName: `${note.id}.m4a`,
              publicKey: ikAuth.publicKey,
              signature: ikAuth.signature,
              expire: String(ikAuth.expire),
              token: ikAuth.token,
              useUniqueFileName: 'true',
              folder: '/voicevault',
            },
          }
        );

        if (ikUpload.status >= 200 && ikUpload.status < 300) {
          const ikData = JSON.parse(ikUpload.body || '{}');
          if (ikData.url) {
            // Post tiny JSON metadata payload with audioUrl directly to Render
            const result = await request<{
              noteId: string;
              status: 'processing';
              stage?: PipelineStage;
            }>(
              '/notes',
              {
                method: 'POST',
                body: JSON.stringify({
                  clientId: note.id,
                  durationMs: note.durationMs,
                  audioUrl: ikData.url,
                }),
              },
              token
            );
            return result;
          }
        }
      }
    } catch {
      // Gracefully continue to direct Render upload fallback
    }

    // Step 2: Fallback to direct Render multipart upload
    const uploadResult = await FileSystem.uploadAsync(`${API_URL}/notes`, note.localAudioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'audio',
      mimeType: 'audio/m4a',
      parameters: {
        clientId: note.id,
        durationMs: String(note.durationMs),
      },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const durationMs = Date.now() - startTime;
    let body: any = {};
    try {
      body = JSON.parse(uploadResult.body || '{}');
    } catch {
      body = {};
    }

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      const errorMsg = body.error ?? `Upload failed (${uploadResult.status})`;
      notifyTelemetry({
        endpoint: '/notes',
        method: 'POST',
        status: 'error',
        statusCode: uploadResult.status,
        message: errorMsg,
        timestamp: Date.now(),
        durationMs,
      });
      throw new Error(errorMsg);
    }

    notifyTelemetry({
      endpoint: '/notes',
      method: 'POST',
      status: 'success',
      statusCode: uploadResult.status,
      timestamp: Date.now(),
      durationMs,
    });

    return body as { noteId: string; status: 'processing'; stage?: PipelineStage };
  } catch (err) {
    if (lastTelemetry?.endpoint === '/notes' && lastTelemetry.status === 'pending') {
      notifyTelemetry({
        endpoint: '/notes',
        method: 'POST',
        status: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      });
    }
    throw err;
  }
}

export const notesApi = {
  get: (id: string, token: string) => request<ApiNote>(`/notes/${id}`, {}, token),
  updateActionItems: (id: string, actionItems: ActionItem[], token: string) =>
    request<ApiNote>(`/notes/${id}/action-items`, { method: 'PATCH', body: JSON.stringify({ actionItems }) }, token),
  remove: (id: string, token: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }, token),
  search: (query: string, token: string) =>
    request<ApiNote[]>('/search', { method: 'POST', body: JSON.stringify({ query }) }, token),
  retry: (id: string, token: string) => request<ApiNote>(`/notes/${id}/retry`, { method: 'POST' }, token),
};

export function fromApiNote(remote: ApiNote): Partial<Note> {
  return {
    serverId: remote._id,
    status: remote.status,
    stage: remote.stage ?? (remote.status === 'ready' ? 'ready' : remote.status === 'failed' ? 'failed' : 'transcribing'),
    stageMessage: remote.stageMessage ?? null,
    title: remote.title ?? null,
    summary: remote.summary ?? null,
    transcript: remote.transcript ?? null,
    tags: remote.tags ?? [],
    actionItems: remote.actionItems ?? [],
    failureReason: remote.failureReason ?? null,
  };
}
