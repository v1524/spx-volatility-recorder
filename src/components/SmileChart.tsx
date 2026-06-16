import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface SmilePoint {
  strike: number;
  call_iv: number | null;
  put_iv: number | null;
  call_delta: number | null;
  put_delta: number | null;
}

interface SmileChartProps {
  data: SmilePoint[];
  expiration: string;
  spxPrice: number | null;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: SmilePoint }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-white font-medium mb-1">Strike: {label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: <span className="font-mono">{item.value?.toFixed(2)}%</span>
        </p>
      ))}
      {p.call_delta !== null && (
        <p className="text-slate-400 mt-1 text-xs">Call Δ: {p.call_delta?.toFixed(3)}</p>
      )}
      {p.put_delta !== null && (
        <p className="text-slate-400 text-xs">Put Δ: {p.put_delta?.toFixed(3)}</p>
      )}
    </div>
  );
};

export function SmileChart({ data, expiration, spxPrice }: SmileChartProps) {
  if (!data.length) {
    return (
      <div className="h-72 flex items-center justify-center text-slate-500">
        Select an expiration to view the volatility smile
      </div>
    );
  }

  const allIVs = data.flatMap((d) => [d.call_iv, d.put_iv]).filter((v): v is number => v !== null);
  const minIV = Math.max(0, Math.floor(Math.min(...allIVs) - 1));
  const maxIV = Math.ceil(Math.max(...allIVs) + 1);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">
        $SPX — Volatility Smile{expiration ? ` · ${expiration}` : ''}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="strike"
            tickFormatter={(v) => v.toLocaleString()}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            domain={[minIV, maxIV]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />
          {spxPrice && (
            <ReferenceLine
              x={Math.round(spxPrice / 5) * 5}
              stroke="#64748b"
              strokeDasharray="4 4"
              label={{ value: 'ATM', fill: '#64748b', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="call_iv"
            name="Call IV"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="put_iv"
            name="Put IV"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
