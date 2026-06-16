/**
 * Supabase Edge Function: record-volatility
 *
 * Deploy this function and trigger it via pg_cron for background recording
 * that works even when the browser is closed.
 *
 * Deploy:  supabase functions deploy record-volatility
 * Schedule via SQL:
 *   select cron.schedule(
 *     'record-spx-vol',
 *     '*/5 * * * *',  -- every 5 minutes
 *     $$
 *       select net.http_post(
 *         url:='https://<project-ref>.supabase.co/functions/v1/record-volatility',
 *         headers:='{"Authorization": "Bearer <anon-key>", "Content-Type": "application/json"}'::jsonb,
 *         body:='{}'::jsonb
 *       ) as request_id;
 *     $$
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TRADIER_BASE = 'https://api.tradier.com/v1';
const MAX_EXPIRATIONS = 20;

async function tradierGet(apiKey: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TRADIER_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Tradier ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (_req) => {
  try {
    const tradierKey = Deno.env.get('TRADIER_API_KEY');
    if (!tradierKey) return new Response('Missing TRADIER_API_KEY', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch SPX price
    let spxPrice: number | null = null;
    try {
      const q = await tradierGet(tradierKey, '/markets/quotes', { symbols: 'SPX', greeks: 'false' });
      spxPrice = q?.quotes?.quote?.last ?? null;
    } catch (_) { /* non-fatal */ }

    // Fetch expirations
    const expData = await tradierGet(tradierKey, '/markets/options/expirations', {
      symbol: 'SPX',
      includeAllRoots: 'true',
    });
    const allDates: string[] = expData?.expirations?.date ?? [];
    const expirations = (Array.isArray(allDates) ? allDates : [allDates]).slice(0, MAX_EXPIRATIONS);

    // Create snapshot record
    const { data: snapshot, error: snapErr } = await supabase
      .from('volatility_snapshots')
      .insert({ spx_price: spxPrice, recorded_at: new Date().toISOString() })
      .select('id')
      .single();

    if (snapErr || !snapshot) throw new Error(`Snapshot insert failed: ${snapErr?.message}`);

    // Fetch each expiration chain
    const allRows: Record<string, unknown>[] = [];

    for (const expiration of expirations) {
      try {
        const chain = await tradierGet(tradierKey, '/markets/options/chains', {
          symbol: 'SPX',
          expiration,
          greeks: 'true',
        });

        const options = chain?.options?.option;
        const contracts = Array.isArray(options) ? options : options ? [options] : [];

        for (const c of contracts) {
          const iv = c?.greeks?.mid_iv;
          if (!iv || iv <= 0 || iv > 5) continue;
          allRows.push({
            snapshot_id: snapshot.id,
            expiration_date: c.expiration_date,
            strike: c.strike,
            option_type: c.option_type,
            implied_volatility: iv,
            delta: c.greeks?.delta ?? null,
            gamma: c.greeks?.gamma ?? null,
            theta: c.greeks?.theta ?? null,
            vega: c.greeks?.vega ?? null,
            volume: c.volume ?? null,
            open_interest: c.open_interest ?? null,
            bid: c.bid ?? null,
            ask: c.ask ?? null,
          });
        }

        await new Promise((r) => setTimeout(r, 150));
      } catch (e) {
        console.warn(`Skipping ${expiration}:`, e);
      }
    }

    // Insert data in batches
    for (let i = 0; i < allRows.length; i += 500) {
      const { error } = await supabase.from('volatility_data').insert(allRows.slice(i, i + 500));
      if (error) console.error('Batch insert error:', error);
    }

    return new Response(
      JSON.stringify({ ok: true, snapshotId: snapshot.id, rows: allRows.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
