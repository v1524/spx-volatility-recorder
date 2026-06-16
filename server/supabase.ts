import { createClient } from '@supabase/supabase-js';
import type { VolatilityRow } from './tradier.js';

// Bolt.new native Supabase integration injects VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// We prefer the non-VITE_ server-side vars (service role key bypasses RLS) but fall back
// to the Bolt.new-injected ones so the app works out of the box.
const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('[db] Supabase URL or key not found in environment — DB writes will fail');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveSnapshot(
  spxPrice: number | null,
  rows: VolatilityRow[]
): Promise<string> {
  const { data: snapshot, error } = await supabase
    .from('volatility_snapshots')
    .insert({ spx_price: spxPrice, recorded_at: new Date().toISOString() })
    .select('id')
    .single();

  if (error || !snapshot) throw new Error(`Snapshot insert failed: ${error?.message}`);

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map((r) => ({ ...r, snapshot_id: snapshot.id }));
    const { error: batchErr } = await supabase.from('volatility_data').insert(batch);
    if (batchErr) console.error('[db] Batch insert error:', batchErr.message);
  }

  return snapshot.id;
}

export async function getTotalSnapshots(): Promise<number> {
  const { count } = await supabase
    .from('volatility_snapshots')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}
