import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSnapshots, fetchSnapshotData } from '../lib/supabase';
import type { VolatilitySnapshot, VolatilityDataPoint } from '../types';

type PlaybackSpeed = 1 | 2 | 5 | 10 | 30;

interface PlaybackState {
  snapshots: VolatilitySnapshot[];
  currentIndex: number;
  currentData: VolatilityDataPoint[];
  isPlaying: boolean;
  isLoading: boolean;
  speed: PlaybackSpeed;
  dateRange: { from: string; to: string };
  error: string | null;
}

export function usePlayback() {
  const [state, setState] = useState<PlaybackState>({
    snapshots: [],
    currentIndex: 0,
    currentData: [],
    isPlaying: false,
    isLoading: false,
    speed: 1,
    dateRange: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      to: new Date().toISOString().slice(0, 16),
    },
    error: null,
  });

  // Keep a ref so async callbacks always see current state without stale closures
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataCache = useRef<Map<string, VolatilityDataPoint[]>>(new Map());

  const loadSnapshotData = useCallback(async (snapshotId: string) => {
    if (dataCache.current.has(snapshotId)) {
      return dataCache.current.get(snapshotId)!;
    }
    const data = await fetchSnapshotData(snapshotId);
    dataCache.current.set(snapshotId, data);
    return data;
  }, []);

  const goToIndex = useCallback(
    async (index: number) => {
      const { snapshots } = stateRef.current;
      if (index < 0 || index >= snapshots.length) return;

      setState((s) => ({ ...s, currentIndex: index, isLoading: true }));

      const snapshot = snapshots[index];
      const data = await loadSnapshotData(snapshot.id);
      setState((s) => ({ ...s, currentData: data, isLoading: false }));
    },
    [loadSnapshotData]
  );

  const loadSnapshots = useCallback(async () => {
    const { dateRange } = stateRef.current;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    dataCache.current.clear();

    try {
      const snapshots = await fetchSnapshots(dateRange.from, dateRange.to);

      setState((s) => ({
        ...s,
        snapshots,
        currentIndex: 0,
        currentData: [],
        isLoading: false,
        error: snapshots.length === 0 ? 'No snapshots found in this date range' : null,
      }));

      if (snapshots.length > 0) {
        const data = await loadSnapshotData(snapshots[0].id);
        setState((s) => ({ ...s, currentData: data }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load snapshots',
      }));
    }
  }, [loadSnapshotData]);

  const play = useCallback(() => setState((s) => ({ ...s, isPlaying: true })), []);
  const pause = useCallback(() => setState((s) => ({ ...s, isPlaying: false })), []);
  const setSpeed = useCallback((speed: PlaybackSpeed) => setState((s) => ({ ...s, speed })), []);
  const setDateRange = useCallback((from: string, to: string) => {
    setState((s) => ({ ...s, dateRange: { from, to } }));
  }, []);

  const seekTo = useCallback(
    (index: number) => {
      pause();
      goToIndex(index);
    },
    [pause, goToIndex]
  );

  // Playback ticker — advances one frame per tick
  useEffect(() => {
    if (!state.isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }

    const tickMs = Math.max(200, 1000 / state.speed);

    playIntervalRef.current = setInterval(async () => {
      const { currentIndex, snapshots } = stateRef.current;
      if (currentIndex >= snapshots.length - 1) {
        setState((s) => ({ ...s, isPlaying: false }));
        return;
      }
      const nextIndex = currentIndex + 1;
      setState((s) => ({ ...s, currentIndex: nextIndex }));

      const data = await loadSnapshotData(snapshots[nextIndex].id);
      // Only apply if we haven't jumped away while loading
      setState((s) => {
        if (s.currentIndex !== nextIndex) return s;
        return { ...s, currentData: data };
      });
    }, tickMs);

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [state.isPlaying, state.speed, loadSnapshotData]);

  const currentSnapshot = state.snapshots[state.currentIndex] ?? null;

  return {
    state,
    currentSnapshot,
    loadSnapshots,
    play,
    pause,
    seekTo,
    setSpeed,
    setDateRange,
  };
}
