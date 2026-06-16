export interface OptionGreeks {
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  mid_iv: number | null;
  bid_iv: number | null;
  ask_iv: number | null;
}

export interface OptionContract {
  symbol: string;
  strike: number;
  option_type: 'call' | 'put';
  expiration_date: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  open_interest: number | null;
  greeks: OptionGreeks | null;
}

export interface VolatilityDataPoint {
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

export interface VolatilitySnapshot {
  id: string;
  recorded_at: string;
  spx_price: number | null;
  volatility_data?: VolatilityDataPoint[];
}

export interface TermStructurePoint {
  expiration_date: string;
  dte: number;
  call_iv: number | null;
  put_iv: number | null;
  call_delta: number | null;
  put_delta: number | null;
}

export interface SmilePoint {
  strike: number;
  call_iv: number | null;
  put_iv: number | null;
  call_delta: number | null;
  put_delta: number | null;
}

export interface AppSettings {
  tradierApiKey: string;
  intervalMinutes: number;
  maxExpirations: number;
  targetDelta: number;
}

export type RecordingStatus = 'idle' | 'recording' | 'fetching' | 'error';
export type ActiveTab = 'live' | 'playback';
export type ChartView = 'term-structure' | 'smile' | 'surface';
