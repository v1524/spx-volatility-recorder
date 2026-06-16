import { Play, Square, Zap, Clock, AlertCircle, Loader2, Sun, Moon } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { RecorderStatus } from '../lib/api';

interface RecordingControlsProps {
  status: RecorderStatus | null;
  onStart: () => void;
  onStop: () => void;
  onTakeNow: () => void;
}

export function RecordingControls({
  status,
  onStart,
  onStop,
  onTakeNow,
}: RecordingControlsProps) {
  if (!status) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting to recording server...
        </div>
      </div>
    );
  }

  const { isRecording, isFetching, marketOpen, hasApiKey, lastSnapshotAt, nextSnapshotAt, progress, lastError } = status;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Start / Stop */}
        {isRecording ? (
          <button
            onClick={onStop}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop Recording
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={!hasApiKey}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Recording
          </button>
        )}

        {/* Capture Now */}
        <button
          onClick={onTakeNow}
          disabled={!hasApiKey || isFetching}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 text-yellow-400" />
          )}
          {isFetching ? 'Fetching...' : 'Capture Now'}
        </button>

        {/* Market status */}
        <div
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${
            marketOpen
              ? 'bg-green-950 border border-green-800 text-green-400'
              : 'bg-slate-900 border border-slate-700 text-slate-500'
          }`}
        >
          {marketOpen ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {marketOpen ? 'Market Open' : 'Market Closed'}
        </div>

        {/* Timing info */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {lastSnapshotAt && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              Last: {formatDistanceToNow(parseISO(lastSnapshotAt), { addSuffix: true })}
            </span>
          )}
          {nextSnapshotAt && isRecording && (
            <span className="flex items-center gap-1.5 text-violet-400">
              <Clock className="w-3.5 h-3.5" />
              Next: {formatDistanceToNow(parseISO(nextSnapshotAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Fetch progress */}
      {progress && (
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400 flex-shrink-0" />
          <span className="text-slate-400">{progress.expiration}</span>
          <div className="flex-1 bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-violet-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-slate-500 text-xs tabular-nums">
            {progress.current}/{progress.total}
          </span>
        </div>
      )}

      {/* Error */}
      {lastError && (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {lastError}
        </div>
      )}

      {!hasApiKey && (
        <p className="text-amber-400 text-sm bg-amber-950 border border-amber-800 rounded-lg px-4 py-2.5">
          Set the <code className="bg-amber-900 px-1 rounded">TRADIER_API_KEY</code> environment variable on the server to enable recording.
        </p>
      )}
    </div>
  );
}
