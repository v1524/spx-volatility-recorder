import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Settings } from './components/Settings';
import { RecordingControls } from './components/RecordingControls';
import { TermStructureChart } from './components/TermStructureChart';
import { SmileChart } from './components/SmileChart';
import { SurfaceHeatmap } from './components/SurfaceHeatmap';
import { PlaybackControls } from './components/PlaybackControls';
import { useRecorder } from './hooks/useRecorder';
import { usePlayback } from './hooks/usePlayback';
import { buildTermStructure, buildSmile } from './lib/tradier';
import { fetchLatestSnapshot, fetchSnapshotData } from './lib/supabase';
import type { ChartView, VolatilityDataPoint, AppSettings } from './types';

type ActiveTab = 'live' | 'playback';

const CHART_VIEWS: { id: ChartView; label: string }[] = [
  { id: 'term-structure', label: 'Term Structure' },
  { id: 'smile', label: 'Vol Smile' },
  { id: 'surface', label: 'IV Surface' },
];

const DEFAULT_UI_SETTINGS: AppSettings = {
  tradierApiKey: '',
  intervalMinutes: 5,
  maxExpirations: 20,
  targetDelta: 20,
};

const DELTA_OPTIONS = [10, 15, 20, 25, 30, 40, 50];

function ChartPanel({
  data,
  spxPrice,
  targetDelta,
  view,
}: {
  data: VolatilityDataPoint[];
  spxPrice: number | null;
  targetDelta: number;
  view: ChartView;
}) {
  const [selectedExpiration, setSelectedExpiration] = useState('');

  const expirations = useMemo(() => {
    const set = new Set(data.map((d) => d.expiration_date));
    return Array.from(set).sort();
  }, [data]);

  const activeExp = selectedExpiration || expirations[1] || expirations[0] || '';

  const termStructure = useMemo(
    () => buildTermStructure(data, targetDelta),
    [data, targetDelta]
  );

  const smile = useMemo(
    () => (activeExp ? buildSmile(data, activeExp) : []),
    [data, activeExp]
  );

  if (!data.length) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-800 border border-slate-700 rounded-xl">
        <div className="text-4xl">📊</div>
        <p>No data yet — start recording to capture the volatility surface</p>
        <p className="text-xs text-slate-600">Data will appear here after the first snapshot</p>
      </div>
    );
  }

  return (
    <>
      {view === 'term-structure' && (
        <TermStructureChart data={termStructure} targetDelta={targetDelta} />
      )}
      {view === 'smile' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {expirations.map((exp) => (
              <button
                key={exp}
                onClick={() => setSelectedExpiration(exp)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeExp === exp
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {exp}
              </button>
            ))}
          </div>
          <SmileChart data={smile} expiration={activeExp} spxPrice={spxPrice} />
        </div>
      )}
      {view === 'surface' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SurfaceHeatmap data={data} spxPrice={spxPrice} optionType="call" />
          <SurfaceHeatmap data={data} spxPrice={spxPrice} optionType="put" />
        </div>
      )}
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [chartView, setChartView] = useState<ChartView>('term-structure');
  const [targetDelta, setTargetDelta] = useState(20);
  const [liveData, setLiveData] = useState<VolatilityDataPoint[]>([]);

  const { status, serverError, start, stop, takeNow, updateSettings } = useRecorder();
  const playback = usePlayback();

  // Local shadow of recorder settings for the UI sliders
  const intervalMinutes = status?.settings.intervalMinutes ?? DEFAULT_UI_SETTINGS.intervalMinutes;
  const maxExpirations = status?.settings.maxExpirations ?? DEFAULT_UI_SETTINGS.maxExpirations;

  // Reload live chart data whenever a new snapshot is saved
  useEffect(() => {
    if (!status?.lastSnapshotAt) return;
    fetchLatestSnapshot().then((snap) => {
      if (snap) fetchSnapshotData(snap.id).then(setLiveData);
    });
  }, [status?.lastSnapshotAt, status?.totalSnapshots]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header status={status} serverError={serverError} />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {serverError && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
            <strong>Server not reachable:</strong> {serverError}
            <br />
            <span className="text-red-500 text-xs">
              Make sure the Node.js server is running (<code>npm run dev</code> or <code>npm start</code>).
            </span>
          </div>
        )}

        <Settings
          intervalMinutes={intervalMinutes}
          maxExpirations={maxExpirations}
          hasApiKey={status?.hasApiKey ?? false}
          disabled={status?.isRecording}
          onChange={(patch) => updateSettings(patch)}
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
          {(['live', 'playback'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'live' ? '● Live' : '▶ Playback'}
            </button>
          ))}
        </div>

        {activeTab === 'live' && (
          <div className="space-y-5">
            <RecordingControls
              status={status}
              onStart={() => start(intervalMinutes, maxExpirations)}
              onStop={stop}
              onTakeNow={takeNow}
            />

            <div className="flex items-center gap-3">
              {/* Chart view selector */}
              <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
                {CHART_VIEWS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setChartView(id)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      chartView === id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Delta selector */}
              <select
                value={targetDelta}
                onChange={(e) => setTargetDelta(parseInt(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                {DELTA_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}Δ
                  </option>
                ))}
              </select>
            </div>

            <ChartPanel
              data={liveData}
              spxPrice={status?.spxPrice ?? null}
              targetDelta={targetDelta}
              view={chartView}
            />
          </div>
        )}

        {activeTab === 'playback' && (
          <div className="space-y-5">
            <PlaybackControls
              snapshots={playback.state.snapshots}
              currentIndex={playback.state.currentIndex}
              currentSnapshot={playback.currentSnapshot}
              isPlaying={playback.state.isPlaying}
              isLoading={playback.state.isLoading}
              speed={playback.state.speed}
              dateRange={playback.state.dateRange}
              onPlay={playback.play}
              onPause={playback.pause}
              onSeek={playback.seekTo}
              onSetSpeed={playback.setSpeed}
              onLoad={playback.loadSnapshots}
              onDateRangeChange={playback.setDateRange}
            />

            {playback.state.error && (
              <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
                {playback.state.error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
                {CHART_VIEWS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setChartView(id)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      chartView === id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={targetDelta}
                onChange={(e) => setTargetDelta(parseInt(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                {DELTA_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}Δ
                  </option>
                ))}
              </select>
            </div>

            <ChartPanel
              data={playback.state.currentData}
              spxPrice={playback.currentSnapshot?.spx_price ?? null}
              targetDelta={targetDelta}
              view={chartView}
            />
          </div>
        )}
      </main>
    </div>
  );
}
