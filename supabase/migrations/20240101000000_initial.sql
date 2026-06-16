-- SPX Volatility Surface Recorder — Initial Schema
-- Compatible with Bolt.new native Supabase integration.
-- RLS is enabled but anon is allowed to read and write so the app works
-- out of the box with Bolt.new's auto-injected anon key.

CREATE TABLE IF NOT EXISTS volatility_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  spx_price DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_recorded_at
  ON volatility_snapshots(recorded_at DESC);

CREATE TABLE IF NOT EXISTS volatility_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES volatility_snapshots(id) ON DELETE CASCADE,
  expiration_date DATE NOT NULL,
  strike DECIMAL(10, 2) NOT NULL,
  option_type CHAR(4) NOT NULL CHECK (option_type IN ('call', 'put')),
  implied_volatility DECIMAL(8, 6),
  delta DECIMAL(8, 6),
  gamma DECIMAL(10, 8),
  theta DECIMAL(10, 6),
  vega DECIMAL(10, 6),
  volume INTEGER,
  open_interest INTEGER,
  bid DECIMAL(10, 2),
  ask DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vol_data_snapshot    ON volatility_data(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_vol_data_expiration  ON volatility_data(expiration_date);
CREATE INDEX IF NOT EXISTS idx_vol_data_exp_type    ON volatility_data(expiration_date, option_type);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enabled so the schema is production-ready, but anon is permitted to read
-- and write because this is a personal tool using Bolt.new's anon key.
-- If you add auth later, tighten these policies.

ALTER TABLE volatility_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE volatility_data ENABLE ROW LEVEL SECURITY;

-- snapshots: anon can read and write
CREATE POLICY "anon full access" ON volatility_snapshots
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- data: anon can read and write
CREATE POLICY "anon full access" ON volatility_data
  FOR ALL TO anon USING (true) WITH CHECK (true);
