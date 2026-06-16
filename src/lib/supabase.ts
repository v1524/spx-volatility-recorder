import { createClient } from '@supabase/supabase-js';
import type { VolatilityDataPoint, VolatilitySnapshot } from '../types';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Will be a no-op client if Supabase isn't connected yet — all queries
// will return errors that the callers handle gracefully.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

export async function saveSnapshot(
  spxPrice: number | null,
  dataPoints: VolatilityDataPoint[]
): Promise<string> {
  const { data: snapshot, error: snapshotError } = await supabase
    .from('volatility_snapshots')
    .insert({ spx_price: spxPrice, recorded_at: new Date().toISOString() })
    .select('id')
    .single();

  if (snapshotError || !snapshot) {
    throw new Error(`Failed to save snapshot: ${snapshotError?.message}`);
  }

  const rows = dataPoints.map((d) => ({
    snapshot_id: snapshot.id,
    expiration_date: d.expiration_date,
    strike: d.strike,
    option_type: d.option_type,
    implied_volatility: d.implied_volatility,
    delta: d.delta,
    gamma: d.gamma,
    theta: d.theta,
    vega: d.vega,
    volume: d.volume,
    open_interest: d.open_interest,
    bid: d.bid,
    ask: d.ask,
  }));

  // Insert in batches of 500 to avoid payload limits
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('volatility_data').insert(batch);
    if (error) throw new Error(`Failed to save data batch: ${error.message}`);
  }

  return snapshot.id;
}

export async function fetchSnapshots(
  from: string,
  to: string
): Promise<VolatilitySnapshot[]> {
  const { data, error } = await supabase
    .from('volatility_snapshots')
    .select('id, recorded_at, spx_price')
    .gte('recorded_at', from)
    .lte('recorded_at', to)
    .order('recorded_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch snapshots: ${error.message}`);
  return data ?? [];
}

export async function fetchSnapshotData(
  snapshotId: string
): Promise<VolatilityDataPoint[]> {
  const { data, error } = await supabase
    .from('volatility_data')
    .select('*')
    .eq('snapshot_id', snapshotId);

  if (error) throw new Error(`Failed to fetch snapshot data: ${error.message}`);
  return (data ?? []) as VolatilityDataPoint[];
}

export async function fetchLatestSnapshot(): Promise<VolatilitySnapshot | null> {
  const { data, error } = await supabase
    .from('volatility_snapshots')
    .select('id, recorded_at, spx_price')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function fetchSnapshotCount(): Promise<number> {
  const { count, error } = await supabase
    .from('volatility_snapshots')
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count ?? 0;
}
