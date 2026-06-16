import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { fetchFullSurface } from './tradier.js';
import { saveSnapshot, getTotalSnapshots } from './supabase.js';

export interface RecorderSettings {
  intervalMinutes: number;
  maxExpirations: number;
}

export interface RecorderStatus {
  isRecording: boolean;
  isFetching: boolean;
  marketOpen: boolean;
  hasApiKey: boolean;
  lastSnapshotAt: string | null;
  nextSnapshotAt: string | null;
  totalSnapshots: number;
  progress: { current: number; total: number; expiration: string } | null;
  lastError: string | null;
  spxPrice: number | null;
  settings: RecorderSettings;
}

let cronJob: ScheduledTask | null = null;
let isFetching = false;
let lastSnapshotAt: Date | null = null;
let nextSnapshotAt: Date | null = null;
let lastError: string | null = null;
let spxPrice: number | null = null;
let progress: RecorderStatus['progress'] = null;
let totalSnapshots = 0;

let settings: RecorderSettings = {
  intervalMinutes: parseInt(process.env.RECORD_INTERVAL_MINUTES ?? '5'),
  maxExpirations: parseInt(process.env.MAX_EXPIRATIONS ?? '20'),
};

// Load initial snapshot count from DB
getTotalSnapshots().then((n) => { totalSnapshots = n; }).catch(() => {});

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  // Get current ET time
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const [hStr, mStr] = et.split(':');
  const h = parseInt(hStr);
  const m = parseInt(mStr);
  const totalMin = h * 60 + m;

  // 9:30 AM = 570 min, 4:00 PM = 960 min
  return totalMin >= 570 && totalMin < 960;
}

async function runCapture(): Promise<void> {
  if (isFetching) {
    console.log('[recorder] Skipping — previous capture still running');
    return;
  }

  if (!isMarketOpen()) {
    console.log('[recorder] Market is closed — skipping capture');
    return;
  }

  isFetching = true;
  lastError = null;
  progress = null;
  console.log('[recorder] Starting capture at', new Date().toISOString());

  try {
    const { spxPrice: price, rows } = await fetchFullSurface(
      settings.maxExpirations,
      (current, total, expiration) => {
        progress = { current, total, expiration };
        process.stdout.write(`\r[recorder] Fetching ${current}/${total}: ${expiration}   `);
      }
    );

    process.stdout.write('\n');
    spxPrice = price;

    if (rows.length > 0) {
      const snapshotId = await saveSnapshot(price, rows);
      lastSnapshotAt = new Date();
      totalSnapshots++;
      console.log(
        `[recorder] Saved snapshot ${snapshotId} — ${rows.length} rows, SPX ${price}`
      );
    } else {
      lastError = 'No data returned — market may be closed or API key invalid';
      console.warn('[recorder]', lastError);
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error('[recorder] Capture failed:', lastError);
  } finally {
    isFetching = false;
    progress = null;
  }
}

function cronExpression(intervalMinutes: number): string {
  if (intervalMinutes === 1) return '* * * * *';
  return `*/${intervalMinutes} * * * *`;
}

export function startRecording(newSettings?: Partial<RecorderSettings>): void {
  if (newSettings) settings = { ...settings, ...newSettings };

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  const expr = cronExpression(settings.intervalMinutes);
  console.log(`[recorder] Starting — interval=${settings.intervalMinutes}min, cron="${expr}"`);

  // Capture immediately on start
  runCapture();

  cronJob = cron.schedule(expr, runCapture);
  nextSnapshotAt = new Date(Date.now() + settings.intervalMinutes * 60 * 1000);
}

export function stopRecording(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[recorder] Stopped');
  }
  nextSnapshotAt = null;
}

export async function captureNow(): Promise<void> {
  if (cronJob) {
    // Reset the timer so we don't double-fire soon after
    cronJob.stop();
    await runCapture();
    const expr = cronExpression(settings.intervalMinutes);
    cronJob = cron.schedule(expr, runCapture);
    nextSnapshotAt = new Date(Date.now() + settings.intervalMinutes * 60 * 1000);
  } else {
    await runCapture();
  }
}

export function isRecording(): boolean {
  return cronJob !== null;
}

export function updateSettings(patch: Partial<RecorderSettings>): void {
  settings = { ...settings, ...patch };
  if (cronJob) {
    // Restart with new settings
    startRecording();
  }
}

export function getStatus(): RecorderStatus {
  return {
    isRecording: cronJob !== null,
    isFetching,
    marketOpen: isMarketOpen(),
    hasApiKey: !!process.env.TRADIER_API_KEY,
    lastSnapshotAt: lastSnapshotAt?.toISOString() ?? null,
    nextSnapshotAt:
      cronJob && nextSnapshotAt ? new Date(nextSnapshotAt).toISOString() : null,
    totalSnapshots,
    progress,
    lastError,
    spxPrice,
    settings,
  };
}
