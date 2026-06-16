export interface RecorderStatus {
  isRecording: boolean;
  isFetching: boolean;
  marketOpen: boolean;
  hasApiKey: boolean;
  lastSnapshotAt: string | null;
  nextSnapshotAt: string | null;
  totalSnapshots: number;
  progress: { current: number; total: number; expiration: string } | null;
  lastError: string | null;
  spxPrice: number | null;
  settings: { intervalMinutes: number; maxExpirations: number };
}

async function apiPost(path: string, body?: unknown): Promise<RecorderStatus> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return data.status ?? data;
}

export async function fetchStatus(): Promise<RecorderStatus> {
  const res = await fetch('/api/recorder/status');
  return res.json();
}

export async function startRecorder(settings: {
  intervalMinutes: number;
  maxExpirations: number;
}): Promise<RecorderStatus> {
  return apiPost('/api/recorder/start', settings);
}

export async function stopRecorder(): Promise<void> {
  await fetch('/api/recorder/stop', { method: 'POST' });
}

export async function captureNow(): Promise<RecorderStatus> {
  return apiPost('/api/recorder/capture-now');
}

export async function updateRecorderSettings(settings: {
  intervalMinutes?: number;
  maxExpirations?: number;
}): Promise<RecorderStatus> {
  const res = await fetch('/api/recorder/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  return data.status ?? data;
}
