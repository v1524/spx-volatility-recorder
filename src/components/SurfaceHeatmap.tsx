import { useMemo } from 'react';
import type { VolatilityDataPoint } from '../types';

interface SurfaceHeatmapProps {
  data: VolatilityDataPoint[];
  spxPrice: number | null;
  optionType: 'call' | 'put';
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function ivToColor(iv: number, minIV: number, maxIV: number): string {
  const t = Math.min(1, Math.max(0, (iv - minIV) / (maxIV - minIV)));
  // Low IV = blue/violet, high IV = orange/red
  const r = Math.round(lerp(88, 239, t));
  const g = Math.round(lerp(28, 68, t));
  const b = Math.round(lerp(135, 68, t));
  return `rgb(${r},${g},${b})`;
}

export function SurfaceHeatmap({ data, spxPrice, optionType }: SurfaceHeatmapProps) {
  const { expirations, strikes, grid, minIV, maxIV } = useMemo(() => {
    const filtered = data.filter((d) => d.option_type === optionType && d.implied_volatility !== null);

    const expSet = new Set<string>();
    const strikeSet = new Set<number>();
    for (const d of filtered) {
      expSet.add(d.expiration_date);
      strikeSet.add(d.strike);
    }

    const expirations = Array.from(expSet).sort();
    const strikes = Array.from(strikeSet).sort((a, b) => a - b);

    // Only use strikes within ±15% of ATM to keep the heatmap readable
    const atm = spxPrice ?? 0;
    const filteredStrikes = atm
      ? strikes.filter((s) => s >= atm * 0.85 && s <= atm * 1.15)
      : strikes.slice(0, 40);

    const lookup = new Map<string, number>();
    for (const d of filtered) {
      lookup.set(`${d.expiration_date}:${d.strike}`, d.implied_volatility!);
    }

    const allIVs = filtered.map((d) => d.implied_volatility!);
    const minIV = Math.min(...allIVs);
    const maxIV = Math.max(...allIVs);

    const grid = expirations.map((exp) =>
      filteredStrikes.map((strike) => lookup.get(`${exp}:${strike}`) ?? null)
    );

    return { expirations, strikes: filteredStrikes, grid, minIV, maxIV };
  }, [data, optionType, spxPrice]);

  if (!data.length || !expirations.length) {
    return (
      <div className="h-72 flex items-center justify-center text-slate-500">
        No surface data available
      </div>
    );
  }

  const cellW = Math.max(8, Math.min(24, Math.floor(680 / strikes.length)));
  const cellH = Math.max(12, Math.min(30, Math.floor(240 / expirations.length)));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">
          $SPX — IV Surface ({optionType === 'call' ? 'Calls' : 'Puts'}) ±15% of ATM
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{(minIV * 100).toFixed(1)}%</span>
          <div
            className="w-24 h-3 rounded"
            style={{
              background: `linear-gradient(to right, ${ivToColor(minIV, minIV, maxIV)}, ${ivToColor(maxIV, minIV, maxIV)})`,
            }}
          />
          <span>{(maxIV * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Strike headers */}
          <div style={{ display: 'flex', paddingLeft: 60 }}>
            {strikes.map((s, i) => (
              <div
                key={i}
                style={{
                  width: cellW,
                  fontSize: 8,
                  color: s === (spxPrice ? Math.round(spxPrice / 5) * 5 : 0) ? '#a78bfa' : '#64748b',
                  textAlign: 'center',
                  overflow: 'hidden',
                  transform: 'rotate(-45deg)',
                  transformOrigin: 'bottom left',
                  height: 32,
                  whiteSpace: 'nowrap',
                }}
              >
                {s >= 1000 ? `${(s / 1000).toFixed(1)}k` : s}
              </div>
            ))}
          </div>

          {/* Heatmap rows */}
          {expirations.map((exp, ei) => (
            <div key={exp} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <div
                style={{
                  width: 56,
                  fontSize: 9,
                  color: '#64748b',
                  textAlign: 'right',
                  paddingRight: 4,
                  flexShrink: 0,
                }}
              >
                {exp.slice(5)}
              </div>
              {grid[ei].map((iv, si) => (
                <div
                  key={si}
                  title={iv !== null ? `${exp} / ${strikes[si]}: ${(iv * 100).toFixed(2)}%` : 'N/A'}
                  style={{
                    width: cellW,
                    height: cellH,
                    backgroundColor: iv !== null ? ivToColor(iv, minIV, maxIV) : '#1e293b',
                    flexShrink: 0,
                    borderRadius: 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
