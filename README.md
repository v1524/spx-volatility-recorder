# SPX Volatility Surface Recorder

Records the full SPX options volatility surface every N minutes via the Tradier API, stores every strike × expiration in Supabase, and replays how IV changed over time.

**Recording runs on the server — the browser does NOT need to be open.**

---

## How to deploy on Bolt.new (step by step)

### 1. Import this project
Open Bolt.new → "Import from folder" → select this directory.

### 2. Connect a Supabase database
In Bolt.new, click **Connect to Supabase** and create or link a project.

### 3. Run the database migration
In the Supabase dashboard → SQL Editor → paste and run:

```
supabase/migrations/20240101000000_initial.sql
```

This creates the `volatility_snapshots` and `volatility_data` tables.

### 4. Set environment variables
Bolt.new **automatically injects** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when you connect Supabase — you don't set those yourself.

You only need to manually add **two variables** in Bolt.new's Environment Variables panel:

| Variable | Value | Notes |
|---|---|---|
| `TRADIER_API_KEY` | Your Tradier production API key | Get from tradier.com → API Access |
| `AUTO_RECORD` | `true` | Starts recording on boot — no browser needed |

Optional:

| Variable | Default | Notes |
|---|---|---|
| `RECORD_INTERVAL_MINUTES` | `5` | How often to capture |
| `MAX_EXPIRATIONS` | `20` | SPX expirations per snapshot |

### 5. Deploy
Click **Deploy** in Bolt.new. The server starts, sees `AUTO_RECORD=true`, and begins recording immediately — **no browser tab needs to stay open**.

The server only records during NYSE market hours (9:30 AM – 4:00 PM ET, Mon–Fri) to avoid wasting API calls overnight.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Node.js Express Server             │
│                                              │
│  node-cron ──► fetchFullSurface()            │
│               (Tradier API, server-side)     │
│                    │                         │
│                    ▼                         │
│              saveSnapshot()                  │
│              (Supabase service role)         │
│                                              │
│  GET /api/recorder/status ◄── React UI polls│
│  POST /api/recorder/start                   │
│  POST /api/recorder/stop                    │
│  POST /api/recorder/capture-now             │
└─────────────────────────────────────────────┘
         ▲ React reads Supabase directly
         │ (anon key, read-only via RLS)
┌────────┴────────────────────────────────────┐
│           React Frontend (Vite)              │
│  Live view + Term Structure / Smile / Surface│
│  Playback: timeline slider + play button     │
└─────────────────────────────────────────────┘
```

Key design: the **Tradier API key lives only on the server** and is never sent to the browser. The browser only ever talks to Supabase (read-only with the anon key) and to the local Express API.

---

## Running locally

```bash
cp .env.example .env
# Fill in your keys in .env

npm install
npm run dev
# Runs Express on :3001 + Vite on :5173 simultaneously
```

Open http://localhost:5173. The settings panel will show if the server has a Tradier key configured.

## Running in production (without Bolt.new)

Deploy to Railway, Render, Fly.io, or any platform that keeps Node.js running:

```bash
npm run build   # builds the React app to dist/
NODE_ENV=production AUTO_RECORD=true npm start
```

The server serves the React app at `/` and the API at `/api/*`.

---

## Features

- **Background recording** — `node-cron` fires every N minutes on the server; no browser required
- **Market hours guard** — skips captures outside 9:30 AM – 4:00 PM ET Mon–Fri  
- **Live progress** — the UI polls `/api/recorder/status` every 3s and shows which expiration is being fetched
- **Three chart views:**
  - **Term Structure** — IV by expiration at a target delta (e.g. 20Δ calls & puts), matching the Barchart style
  - **Volatility Smile** — IV by strike for a selected expiration, ATM reference line
  - **IV Surface Heatmap** — color-coded grid of all strikes vs. all expirations
- **Playback** — load any date range, scrub timeline, play at 1×/2×/5×/10×/30× speed

## Data volume estimate

- 20 expirations × ~200 strikes × 2 (call/put) ≈ 8,000 rows/snapshot
- Every 5 min during market hours ≈ 78 snapshots/day  
- ≈ 624,000 rows/day — well within Supabase free tier for weeks of data

## Tradier API notes

- Production API key required (sandbox doesn't return live greeks)
- SPX symbol is `SPX` (no `$` prefix) in all Tradier calls
- `greeks=true` returns `mid_iv` and `delta` per contract
- ~150 ms delay between expiration requests to stay within rate limits
