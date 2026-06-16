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
import { format, parseISO } from 'date-fns';

interface TermStructurePoint {
  expiration_date: string;
  dte: number;
  call_iv: number | null;
  put_iv: number | null;
}

interface TermStructureChartProps {
  data: TermStructurePoint[];
  targetDelta: number;
  title?: string;
}

function formatExpDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MM/dd');
  } catch {
    return dateStr;
  }
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-slate-300 font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-mono">{p.value?.toFixed(2)}%</span>
        </p>
      ))}
    </div>
  );
};

export function TermStructureChart({ data, targetDelta, title }: TermStructureChartProps) {
  if (!data.length) {
    return (
      <div className="h-72 flex items-center justify-center text-slate-500">
        No data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatExpDate(d.expiration_date),
  }));

  const allIVs = data.flatMap((d) => [d.call_iv, d.put_iv]).filter((v): v is number => v !== null);
  const minIV = Math.max(0, Math.floor(Math.min(...allIVs) - 2));
  const maxIV = Math.ceil(Math.max(...allIVs) + 2);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-sm">
        {title ?? `$SPX — Volatility Term Structure (${targetDelta}Δ)`}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="label"
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
            wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
            formatter={(value) => (
              <span style={{ color: '#94a3b8' }}>{value}</span>
            )}
          />
          <ReferenceLine y={data[0]?.call_iv ?? 0} stroke="#475569" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="call_iv"
            name={`Call IV (${targetDelta}Δ)`}
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ fill: '#a78bfa', r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="put_iv"
            name={`Put IV (${targetDelta}Δ)`}
            stroke="#fbbf24"
            strokeWidth={2}
            dot={{ fill: '#fbbf24', r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
