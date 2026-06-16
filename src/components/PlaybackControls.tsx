import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronFirst,
  ChevronLast,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { VolatilitySnapshot } from '../types';

type PlaybackSpeed = 1 | 2 | 5 | 10 | 30;
const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10, 30];

interface PlaybackControlsProps {
  snapshots: VolatilitySnapshot[];
  currentIndex: number;
  currentSnapshot: VolatilitySnapshot | null;
  isPlaying: boolean;
  isLoading: boolean;
  speed: PlaybackSpeed;
  dateRange: { from: string; to: string };
  onPlay: () => void;
  onPause: () => void;
  onSeek: (index: number) => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onLoad: () => void;
  onDateRangeChange: (from: string, to: string) => void;
}

function formatSnapshotTime(isoStr: string): string {
  try {
    return format(parseISO(isoStr), 'MMM d, h:mm:ss a');
  } catch {
    return isoStr;
  }
}

export function PlaybackControls({
  snapshots,
  currentIndex,
  currentSnapshot,
  isPlaying,
  isLoading,
  speed,
  dateRange,
  onPlay,
  onPause,
  onSeek,
  onSetSpeed,
  onLoad,
  onDateRangeChange,
}: PlaybackControlsProps) {
  const total = snapshots.length;
  const progress = total > 1 ? currentIndex / (total - 1) : 0;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      {/* Date range selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1 uppercase tracking-wider">
            From
          </label>
          <input
            type="datetime-local"
            value={dateRange.from}
            onChange={(e) => onDateRangeChange(e.target.value, dateRange.to)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1 uppercase tracking-wider">
            To
          </label>
          <input
            type="datetime-local"
            value={dateRange.to}
            onChange={(e) => onDateRangeChange(dateRange.from, e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
        <button
          onClick={onLoad}
          disabled={isLoading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Load Snapshots
        </button>
        {total > 0 && (
          <span className="text-slate-400 text-sm self-center">
            {total} snapshot{total !== 1 ? 's' : ''} loaded
          </span>
        )}
      </div>

      {total > 0 && (
        <>
          {/* Current timestamp */}
          <div className="text-center">
            <span className="text-white font-mono text-lg">
              {currentSnapshot ? formatSnapshotTime(currentSnapshot.recorded_at) : '—'}
            </span>
            {currentSnapshot?.spx_price && (
              <span className="ml-3 text-slate-400 text-sm">
                SPX: {currentSnapshot.spx_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Timeline slider */}
          <div className="relative">
            <input
              type="range"
              min={0}
              max={total - 1}
              value={currentIndex}
              onChange={(e) => onSeek(parseInt(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-slate-500 text-xs mt-1">
              <span>{snapshots[0] ? formatSnapshotTime(snapshots[0].recorded_at) : ''}</span>
              <span className="text-violet-400 font-medium">
                {currentIndex + 1} / {total}
              </span>
              <span>
                {snapshots[total - 1] ? formatSnapshotTime(snapshots[total - 1].recorded_at) : ''}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1 bg-slate-700 rounded-full mt-1">
              <div
                className="h-1 bg-violet-500 rounded-full transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          {/* Transport controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => onSeek(0)}
              className="text-slate-400 hover:text-white transition-colors p-2"
              title="Go to start"
            >
              <ChevronFirst className="w-5 h-5" />
            </button>
            <button
              onClick={() => onSeek(Math.max(0, currentIndex - 1))}
              className="text-slate-400 hover:text-white transition-colors p-2"
              title="Step back"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={isPlaying ? onPause : onPlay}
              className="bg-violet-600 hover:bg-violet-700 text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-lg"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              onClick={() => onSeek(Math.min(total - 1, currentIndex + 1))}
              className="text-slate-400 hover:text-white transition-colors p-2"
              title="Step forward"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <button
              onClick={() => onSeek(total - 1)}
              className="text-slate-400 hover:text-white transition-colors p-2"
              title="Go to end"
            >
              <ChevronLast className="w-5 h-5" />
            </button>

            {/* Speed selector */}
            <div className="ml-4 flex items-center gap-1 bg-slate-900 rounded-lg p-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSetSpeed(s)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    speed === s
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
