export const MAX_RECORDING_MS = 3 * 60 * 1000;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export function formatDuration(durationMs: number) {
  const seconds = Math.floor(durationMs / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function createClientId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
