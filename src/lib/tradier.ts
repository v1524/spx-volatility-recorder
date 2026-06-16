import type { OptionContract, VolatilityDataPoint } from '../types';

const TRADIER_BASE = 'https://api.tradier.com/v1';

async function tradierGet<T>(
  apiKey: string,
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${TRADIER_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Tradier API error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchSpxPrice(apiKey: string): Promise<number | null> {
  try {
    const data = await tradierGet<{ quotes: { quote: { last: number } } }>(
      apiKey,
      '/markets/quotes',
      { symbols: 'SPX', greeks: 'false' }
    );
    return data?.quotes?.quote?.last ?? null;
  } catch {
    return null;
  }
}

export async function fetchExpirations(apiKey: string): Promise<string[]> {
  const data = await tradierGet<{
    expirations: { date: string[] } | null;
  }>(apiKey, '/markets/options/expirations', {
    symbol: 'SPX',
    includeAllRoots: 'true',
    strikes: 'false',
  });

  const dates = data?.expirations?.date;
  if (!dates) return [];
  return Array.isArray(dates) ? dates : [dates];
}

export async function fetchOptionsChain(
  apiKey: string,
  expiration: string
): Promise<OptionContract[]> {
  const data = await tradierGet<{
    options: { option: OptionContract | OptionContract[] } | null;
  }>(apiKey, '/markets/options/chains', {
    symbol: 'SPX',
    expiration,
    greeks: 'true',
  });

  const raw = data?.options?.option;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function daysBetween(dateStr: string): number {
  const now = new Date();
  const exp = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export async function fetchFullVolatilitySurface(
  apiKey: string,
  maxExpirations: number,
  onProgress?: (current: number, total: number) => void
): Promise<{ spxPrice: number | null; dataPoints: VolatilityDataPoint[] }> {
  const [spxPrice, allExpirations] = await Promise.all([
    fetchSpxPrice(apiKey),
    fetchExpirations(apiKey),
  ]);

  const expirations = allExpirations.slice(0, maxExpirations);
  const dataPoints: VolatilityDataPoint[] = [];

  for (let i = 0; i < expirations.length; i++) {
    const expiration = expirations[i];
    onProgress?.(i + 1, expirations.length);

    try {
      const contracts = await fetchOptionsChain(apiKey, expiration);

      for (const contract of contracts) {
        if (!contract.greeks) continue;

        const iv = contract.greeks.mid_iv;
        if (iv === null || iv === undefined || iv <= 0 || iv > 5) continue;

        dataPoints.push({
          expiration_date: contract.expiration_date,
          strike: contract.strike,
          option_type: contract.option_type,
          implied_volatility: iv,
          delta: contract.greeks.delta,
          gamma: contract.greeks.gamma,
          theta: contract.greeks.theta,
          vega: contract.greeks.vega,
          volume: contract.volume,
          open_interest: contract.open_interest,
          bid: contract.bid,
          ask: contract.ask,
        });
      }

      // Respect rate limits with a small delay between requests
      if (i < expirations.length - 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (err) {
      console.warn(`Skipping expiration ${expiration}:`, err);
    }
  }

  return { spxPrice, dataPoints };
}

export function buildTermStructure(
  dataPoints: VolatilityDataPoint[],
  targetDelta: number
): {
  expiration_date: string;
  dte: number;
  call_iv: number | null;
  put_iv: number | null;
}[] {
  const byExpiration = new Map<string, VolatilityDataPoint[]>();

  for (const d of dataPoints) {
    const arr = byExpiration.get(d.expiration_date) ?? [];
    arr.push(d);
    byExpiration.set(d.expiration_date, arr);
  }

  const result: {
    expiration_date: string;
    dte: number;
    call_iv: number | null;
    put_iv: number | null;
  }[] = [];

  for (const [expDate, points] of byExpiration) {
    const calls = points.filter((p) => p.option_type === 'call' && p.delta !== null);
    const puts = points.filter((p) => p.option_type === 'put' && p.delta !== null);

    const targetCallDelta = targetDelta / 100;
    const targetPutDelta = -(targetDelta / 100);

    const closestCall = calls.reduce<VolatilityDataPoint | null>((best, p) => {
      if (!best || !p.delta) return best;
      return Math.abs((p.delta ?? 0) - targetCallDelta) <
        Math.abs((best.delta ?? 0) - targetCallDelta)
        ? p
        : best;
    }, calls[0] ?? null);

    const closestPut = puts.reduce<VolatilityDataPoint | null>((best, p) => {
      if (!best || !p.delta) return best;
      return Math.abs((p.delta ?? 0) - targetPutDelta) <
        Math.abs((best.delta ?? 0) - targetPutDelta)
        ? p
        : best;
    }, puts[0] ?? null);

    result.push({
      expiration_date: expDate,
      dte: daysBetween(expDate),
      call_iv: closestCall?.implied_volatility
        ? Math.round(closestCall.implied_volatility * 10000) / 100
        : null,
      put_iv: closestPut?.implied_volatility
        ? Math.round(closestPut.implied_volatility * 10000) / 100
        : null,
    });
  }

  return result.sort((a, b) => a.dte - b.dte);
}

export function buildSmile(
  dataPoints: VolatilityDataPoint[],
  expiration: string
): {
  strike: number;
  call_iv: number | null;
  put_iv: number | null;
  call_delta: number | null;
  put_delta: number | null;
}[] {
  const filtered = dataPoints.filter((d) => d.expiration_date === expiration);
  const byStrike = new Map<
    number,
    { call?: VolatilityDataPoint; put?: VolatilityDataPoint }
  >();

  for (const d of filtered) {
    const entry = byStrike.get(d.strike) ?? {};
    if (d.option_type === 'call') entry.call = d;
    else entry.put = d;
    byStrike.set(d.strike, entry);
  }

  return Array.from(byStrike.entries())
    .map(([strike, { call, put }]) => ({
      strike,
      call_iv: call?.implied_volatility
        ? Math.round(call.implied_volatility * 10000) / 100
        : null,
      put_iv: put?.implied_volatility
        ? Math.round(put.implied_volatility * 10000) / 100
        : null,
      call_delta: call?.delta ?? null,
      put_delta: put?.delta ?? null,
    }))
    .sort((a, b) => a.strike - b.strike);
}
