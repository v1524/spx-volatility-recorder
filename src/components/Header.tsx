import { TrendingUp, Server, WifiOff } from 'lucide-react';
import type { RecorderStatus } from '../lib/api';

interface HeaderProps {
  status: RecorderStatus | null;
  serverError: string | null;
}

export function Header({ status, serverError }: HeaderProps) {
  const spxPrice = status?.spxPrice;
  const totalSnapshots = status?.totalSnapshots ?? 0;
  const isRecording = status?.isRecording ?? false;
  const isFetching = status?.isFetching ?? false;

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-violet-400" />
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">
              SPX Volatility Surface Recorder
            </h1>
            <p className="text-slate-400 text-xs">Intraday IV surface capture &amp; replay</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {spxPrice && (
            <div className="text-right">
              <div className="text-slate-400 text-xs">SPX</div>
              <div className="text-white font-mono font-semibold text-lg">
                {spxPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          )}

          <div className="text-right">
            <div className="text-slate-400 text-xs">Snapshots</div>
            <div className="text-white font-mono font-semibold text-lg">{totalSnapshots}</div>
          </div>

          {/* Server/recording indicator */}
          {serverError ? (
            <div className="flex items-center gap-2 bg-red-950 border border-red-800 rounded-full px-4 py-2">
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm font-medium">Server offline</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-2">
              <Server className="w-4 h-4 text-slate-400" />
              <div
                className={`w-2 h-2 rounded-full ${
                  isFetching
                    ? 'bg-yellow-500 animate-pulse'
                    : isRecording
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-gray-500'
                }`}
              />
              <span className="text-slate-200 text-sm font-medium">
                {isFetching ? 'Fetching' : isRecording ? 'Recording' : 'Idle'}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
