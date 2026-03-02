import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const LEADERBOARD_KEY = 'dogged:leaderboard';
const MAX_ENTRIES = 100;
const SECRET = process.env.DOGGED_SECRET || 'dogged-default-secret-change-me';

// Simple HMAC to verify score submissions
function verifyPayload(data, signature) {
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(JSON.stringify({ name: data.name, score: data.score, prestige: data.prestige, ts: data.ts }))
    .digest('hex');
  return expected === signature;
}

// Validate score is plausible
function isScorePlausible(data) {
  const now = Date.now();
  // Timestamp must be within last 5 minutes
  if (Math.abs(now - data.ts) > 5 * 60 * 1000) return false;
  // Score must be positive
  if (data.score <= 0) return false;
  // Name must be 1-20 chars
  if (!data.name || data.name.length < 1 || data.name.length > 20) return false;
  // Prestige must be non-negative integer
  if (data.prestige < 0 || !Number.isInteger(data.prestige)) return false;
  return true;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET — return leaderboard
    if (req.method === 'GET') {
      let entries = [];
      try {
        entries = (await kv.get(LEADERBOARD_KEY)) || [];
      } catch (e) {
        return res.status(200).json({
          ok: true,
          leaderboard: [],
          message: 'Leaderboard not configured yet. Connect Upstash Redis to enable.',
        });
      }
      return res.status(200).json({ ok: true, leaderboard: entries });
    }

    // POST — submit score
    if (req.method === 'POST') {
      const { name, score, prestige, ts, sig, stats } = req.body;

      // Basic validation
      if (!isScorePlausible({ name, score, prestige, ts })) {
        return res.status(400).json({ ok: false, error: 'Invalid submission' });
      }

      // Verify signature
      if (!verifyPayload({ name, score, prestige, ts }, sig)) {
        return res.status(403).json({ ok: false, error: 'Signature mismatch' });
      }

      // Rate limit check (simple: check if same name submitted in last 60s)
      let entries = [];
      try {
        entries = (await kv.get(LEADERBOARD_KEY)) || [];
      } catch (e) {
        return res.status(503).json({ ok: false, error: 'Leaderboard storage not available' });
      }

      const existing = entries.find(e => e.name === name);
      if (existing && (Date.now() - existing.updatedAt) < 60000) {
        return res.status(429).json({ ok: false, error: 'Too many submissions. Wait 60 seconds.' });
      }

      // Update or insert
      if (existing) {
        // Only update if new score is higher
        if (score > existing.score) {
          existing.score = score;
          existing.prestige = prestige;
          existing.stats = stats || {};
          existing.updatedAt = Date.now();
        }
      } else {
        entries.push({
          name,
          score,
          prestige,
          stats: stats || {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Sort by score descending, keep top N
      entries.sort((a, b) => b.score - a.score);
      entries = entries.slice(0, MAX_ENTRIES);

      await kv.set(LEADERBOARD_KEY, entries);

      const rank = entries.findIndex(e => e.name === name) + 1;

      return res.status(200).json({ ok: true, rank, total: entries.length });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
