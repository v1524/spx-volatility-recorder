import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchStatus,
  startRecorder,
  stopRecorder,
  captureNow,
  updateRecorderSettings,
  type RecorderStatus,
} from '../lib/api';

export type { RecorderStatus };

const POLL_INTERVAL_MS = 3000;

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const s = await fetchStatus();
      setStatus(s);
      setServerError(null);
    } catch {
      setServerError('Cannot reach the recording server. Is it running?');
    }
  }, []);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  const start = useCallback(
    async (intervalMinutes: number, maxExpirations: number) => {
      const s = await startRecorder({ intervalMinutes, maxExpirations });
      setStatus(s);
    },
    []
  );

  const stop = useCallback(async () => {
    await stopRecorder();
    poll();
  }, [poll]);

  const takeNow = useCallback(async () => {
    const s = await captureNow();
    setStatus(s);
  }, []);

  const updateSettings = useCallback(
    async (patch: { intervalMinutes?: number; maxExpirations?: number }) => {
      const s = await updateRecorderSettings(patch);
      setStatus(s);
    },
    []
  );

  return { status, serverError, start, stop, takeNow, updateSettings };
}
