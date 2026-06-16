import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  startRecording,
  stopRecording,
  captureNow,
  getStatus,
  updateSettings,
  isRecording,
} from './recorder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '3001');
const app = express();

app.use(cors());
app.use(express.json());

// ── API routes ────────────────────────────────────────────────────────────────

app.get('/api/recorder/status', (_req, res) => {
  res.json(getStatus());
});

app.post('/api/recorder/start', (req, res) => {
  const { intervalMinutes, maxExpirations } = req.body ?? {};
  startRecording({
    ...(intervalMinutes ? { intervalMinutes: parseInt(intervalMinutes) } : {}),
    ...(maxExpirations ? { maxExpirations: parseInt(maxExpirations) } : {}),
  });
  res.json({ ok: true, status: getStatus() });
});

app.post('/api/recorder/stop', (_req, res) => {
  stopRecording();
  res.json({ ok: true });
});

app.post('/api/recorder/capture-now', async (_req, res) => {
  try {
    await captureNow();
    res.json({ ok: true, status: getStatus() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.put('/api/recorder/settings', (req, res) => {
  const { intervalMinutes, maxExpirations } = req.body ?? {};
  updateSettings({
    ...(intervalMinutes ? { intervalMinutes: parseInt(intervalMinutes) } : {}),
    ...(maxExpirations ? { maxExpirations: parseInt(maxExpirations) } : {}),
  });
  res.json({ ok: true, status: getStatus() });
});

// ── Serve React app in production ─────────────────────────────────────────────

const distPath = join(__dirname, '../dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
  console.log(`[server] TRADIER_API_KEY: ${process.env.TRADIER_API_KEY ? '✓ set' : '✗ NOT SET'}`);
  console.log(`[server] SUPABASE_URL:    ${process.env.SUPABASE_URL ? '✓ set' : '✗ NOT SET'}`);

  // Auto-start recording if configured — this is the "set and forget" mode.
  // Set AUTO_RECORD=true in your environment and recording begins on boot,
  // no browser needed.
  if (process.env.AUTO_RECORD === 'true') {
    console.log('[server] AUTO_RECORD=true — starting recording automatically');
    startRecording();
  } else if (!isRecording()) {
    console.log('[server] Waiting for recording to be started via UI or AUTO_RECORD=true');
  }
});
