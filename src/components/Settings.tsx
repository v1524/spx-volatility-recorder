import { useState } from 'react';
import { Settings as SettingsIcon, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';

interface SettingsProps {
  intervalMinutes: number;
  maxExpirations: number;
  hasApiKey: boolean;
  disabled?: boolean;
  onChange: (patch: { intervalMinutes?: number; maxExpirations?: number }) => void;
}

const INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30];
const EXPIRATION_OPTIONS = [5, 10, 20, 30, 50, 100];

export function Settings({
  intervalMinutes,
  maxExpirations,
  hasApiKey,
  disabled,
  onChange,
}: SettingsProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          <SettingsIcon className="w-4 h-4 text-violet-400" />
          Settings
        </div>
        <div className="flex items-center gap-3">
          {/* API key status */}
          {hasApiKey ? (
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <CheckCircle className="w-3.5 h-3.5" /> Tradier key configured
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 text-xs">
              <XCircle className="w-3.5 h-3.5" /> Set TRADIER_API_KEY env var
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4">
          {/* API Key info */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm">
            <p className="text-slate-300 font-medium mb-1">Tradier API Key</p>
            {hasApiKey ? (
              <p className="text-green-400">
                ✓ Key is configured on the server via <code className="bg-slate-800 px-1 rounded">TRADIER_API_KEY</code> environment variable.
              </p>
            ) : (
              <div className="text-slate-400 space-y-1">
                <p>
                  Set <code className="bg-slate-800 text-violet-300 px-1 rounded">TRADIER_API_KEY</code> as an environment variable on the server.
                </p>
                <p className="text-xs text-slate-500">
                  In Bolt.new: click the Environment Variables panel and add the key there. The server reads it on startup — never exposed to the browser.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Interval */}
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                Record Every: {intervalMinutes} minute{intervalMinutes !== 1 ? 's' : ''}
              </label>
              <input
                type="range"
                min={0}
                max={INTERVAL_OPTIONS.length - 1}
                value={INTERVAL_OPTIONS.indexOf(intervalMinutes)}
                onChange={(e) =>
                  onChange({ intervalMinutes: INTERVAL_OPTIONS[parseInt(e.target.value)] })
                }
                disabled={disabled}
                className="w-full accent-violet-500 disabled:opacity-50"
              />
              <div className="flex justify-between text-slate-500 text-xs mt-1">
                {INTERVAL_OPTIONS.map((v) => (
                  <span key={v}>{v}m</span>
                ))}
              </div>
            </div>

            {/* Max Expirations */}
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                Max Expirations to Fetch
              </label>
              <select
                value={maxExpirations}
                onChange={(e) => onChange({ maxExpirations: parseInt(e.target.value) })}
                disabled={disabled}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
              >
                {EXPIRATION_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} expirations (~{(n * 400 / 1000).toFixed(0)}k rows/snapshot)
                  </option>
                ))}
              </select>
              <p className="text-slate-500 text-xs mt-1">
                More expirations = more data but slower fetch and more API calls
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
