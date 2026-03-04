const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const LEADERBOARD_KEY = 'dogged:leaderboard';
const MAX_ENTRIES = 100;

// Simple hash matching the client-side algorithm exactly
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = ((h << 5) - h) + c;
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

// Verify using the same hash algorithm and secret the client uses.
// Secret is stored in the DOGGED_CLIENT_SECRET Vercel environment variable.
function verifyPayload(data, signature) {
  const CLIENT_SECRET = process.env.DOGGED_CLIENT_SECRET;
  if (!CLIENT_SECRET) {
    console.error('DOGGED_CLIENT_SECRET env var is not set');
    return false;
  }
  const str = `${data.name}|${data.score}|${data.prestige}|${data.ts}|${CLIENT_SECRET}`;
  return simpleHash(str) === signature;
}

// Validate score is plausible
function isScorePlausible(data) {
  const now = Date.now();
  // Timestamp must be within last 10 minutes
  if (Math.abs(now - data.ts) > 10 * 60 * 1000) return false;
  // Score must be positive
  if (data.score <= 0) return false;
  // Name must be 1-20 chars, no HTML
  if (!data.name || data.name.length < 1 || data.name.length > 20) return false;
  if (/<|>|&/.test(data.name)) return false;
  // Prestige must be non-negative integer
  if (data.prestige < 0 || !Number.isInteger(data.prestige)) return false;
  return true;
}

module.exports = async function handler(req, res) {
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
        const raw = await kv.get(LEADERBOARD_KEY);
        if (raw === null || raw === undefined) {
          // No data yet
          entries = [];
        } else if (Array.isArray(raw)) {
          // SDK auto-parsed it
          entries = raw;
        } else if (typeof raw === 'string') {
          // Stored as a raw JSON string (e.g. manually via Upstash console)
          try { entries = JSON.parse(raw); } catch { entries = []; }
        } else if (typeof raw === 'object') {
          // Unexpected object shape — try wrapping or ignore
          entries = Array.isArray(raw) ? raw : [];
        }
      } catch (e) {
        console.error('Redis GET error:', e.message);
        return res.status(200).json({
          ok: true,
          leaderboard: [],
          message: 'Could not reach leaderboard storage.',
        });
      }
      return res.status(200).json({ ok: true, leaderboard: entries, ts: Date.now() });
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

      // Rate limit check
      let entries = [];
      try {
        const raw = await kv.get(LEADERBOARD_KEY);
        if (Array.isArray(raw)) {
          entries = raw;
        } else if (typeof raw === 'string') {
          try { entries = JSON.parse(raw); } catch { entries = []; }
        }
      } catch (e) {
        console.error('Redis GET error:', e.message);
        return res.status(503).json({ ok: false, error: 'Leaderboard storage not available' });
      }

      const existing = entries.find(e => e.name === name);
      if (existing && (Date.now() - existing.updatedAt) < 30000) {
        return res.status(429).json({ ok: false, error: 'Too many submissions. Wait 30 seconds.' });
      }

      // Update or insert
      if (existing) {
        if (score > existing.score) {
          existing.score = score;
          existing.prestige = prestige;
          existing.realm = stats?.realm || 'prime';
          existing.stats = stats || {};
          existing.updatedAt = Date.now();
        }
      } else {
        entries.push({
          name,
          score,
          prestige,
          realm: stats?.realm || 'prime',
          stats: stats || {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Sort by score descending, keep top N
      entries.sort((a, b) => b.score - a.score);
      entries = entries.slice(0, MAX_ENTRIES);

      try {
        await kv.set(LEADERBOARD_KEY, entries);
      } catch (e) {
        console.error('Redis SET error:', e);
        return res.status(503).json({ ok: false, error: 'Could not save to leaderboard' });
      }

      const rank = entries.findIndex(e => e.name === name) + 1;
      return res.status(200).json({ ok: true, rank, total: entries.length });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
