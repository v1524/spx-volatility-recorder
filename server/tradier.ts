const TRADIER_BASE = 'https://api.tradier.com/v1';

function getApiKey(): string {
  const key = process.env.TRADIER_API_KEY;
  if (!key) throw new Error('TRADIER_API_KEY environment variable is not set');
  return key;
}

async function tradierGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TRADIER_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tradier API ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchSpxPrice(): Promise<number | null> {
  try {
    const data = await tradierGet<{ quotes: { quote: { last: number } } }>(
      '/markets/quotes',
      { symbols: 'SPX', greeks: 'false' }
    );
    return data?.quotes?.quote?.last ?? null;
  } catch {
    return null;
  }
}

export async function fetchExpirations(): Promise<string[]> {
  const data = await tradierGet<{ expirations: { date: string | string[] } | null }>(
    '/markets/options/expirations',
    { symbol: 'SPX', includeAllRoots: 'true', strikes: 'false' }
  );
  const dates = data?.expirations?.date;
  if (!dates) return [];
  return Array.isArray(dates) ? dates : [dates];
}

interface RawOption {
  expiration_date: string;
  strike: number;
  option_type: 'call' | 'put';
  volume: number | null;
  open_interest: number | null;
  bid: number | null;
  ask: number | null;
  greeks?: {
    mid_iv: number | null;
    delta: number | null;
    gamma: number | null;
    theta: number | null;
    vega: number | null;
  } | null;
}

export async function fetchOptionsChain(expiration: string): Promise<RawOption[]> {
  const data = await tradierGet<{ options: { option: RawOption | RawOption[] } | null }>(
    '/markets/options/chains',
    { symbol: 'SPX', expiration, greeks: 'true' }
  );
  const raw = data?.options?.option;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export interface VolatilityRow {
  expiration_date: string;
  strike: number;
  option_type: 'call' | 'put';
  implied_volatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  volume: number | null;
  open_interest: number | null;
  bid: number | null;
  ask: number | null;
}

export async function fetchFullSurface(
  maxExpirations: number,
  onProgress?: (current: number, total: number, expiration: string) => void
): Promise<{ spxPrice: number | null; rows: VolatilityRow[] }> {
  const [spxPrice, allExpirations] = await Promise.all([
    fetchSpxPrice(),
    fetchExpirations(),
  ]);

  const expirations = allExpirations.slice(0, maxExpirations);
  const rows: VolatilityRow[] = [];

  for (let i = 0; i < expirations.length; i++) {
    const expiration = expirations[i];
    onProgress?.(i + 1, expirations.length, expiration);

    try {
      const contracts = await fetchOptionsChain(expiration);

      for (const c of contracts) {
        const iv = c.greeks?.mid_iv;
        if (!iv || iv <= 0 || iv > 5) continue;

        rows.push({
          expiration_date: c.expiration_date,
          strike: c.strike,
          option_type: c.option_type,
          implied_volatility: iv,
          delta: c.greeks?.delta ?? null,
          gamma: c.greeks?.gamma ?? null,
          theta: c.greeks?.theta ?? null,
          vega: c.greeks?.vega ?? null,
          volume: c.volume,
          open_interest: c.open_interest,
          bid: c.bid,
          ask: c.ask,
        });
      }

      if (i < expirations.length - 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (err) {
      console.warn(`[tradier] Skipping expiration ${expiration}:`, err);
    }
  }

  return { spxPrice, rows };
}

export function hasApiKey(): boolean {
  return !!process.env.TRADIER_API_KEY;
}
