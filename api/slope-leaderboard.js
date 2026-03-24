const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY = 'dogged:slope-leaderboard';
const MAX_ENTRIES = 50;

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = ((h << 5) - h) + c;
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

function verifyPayload(data, signature) {
  const CLIENT_SECRET = process.env.DOGGED_CLIENT_SECRET;
  if (!CLIENT_SECRET) {
    console.error('DOGGED_CLIENT_SECRET env var is not set');
    return false;
  }
  const str = `SLOPE|${data.name}|${data.score}|${data.ts}|${data.pid}|${CLIENT_SECRET}`;
  return simpleHash(str) === signature;
}

function isSubmissionPlausible(data) {
  const now = Date.now();
  if (Math.abs(now - data.ts) > 10 * 60 * 1000) return false;
  if (!data.name || data.name.length < 1 || data.name.length > 20) return false;
  if (/<|>|&/.test(data.name)) return false;
  if (typeof data.score !== 'number' || data.score < 1 || data.score > 500000) return false;
  if (!data.pid || typeof data.pid !== 'string' || data.pid.length < 32) return false;
  return true;
}

async function getEntries() {
  try {
    const raw = await kv.get(KEY);
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  } catch (e) {
    console.error('Redis GET error:', e.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const entries = await getEntries();
      if (entries === null) {
        return res.status(200).json({ ok: true, leaderboard: [], message: 'Storage unavailable' });
      }
      return res.status(200).json({ ok: true, leaderboard: entries, ts: Date.now() });
    }

    if (req.method === 'POST') {
      const { name, score, ts, sig, pid } = req.body;

      if (!isSubmissionPlausible({ name, score, ts, pid })) {
        return res.status(400).json({ ok: false, error: 'Invalid submission' });
      }

      if (!verifyPayload({ name, score, ts, pid }, sig)) {
        return res.status(403).json({ ok: false, error: 'Signature mismatch' });
      }

      let entries = await getEntries();
      if (entries === null) {
        return res.status(503).json({ ok: false, error: 'Leaderboard storage not available' });
      }

      const byPid = entries.find(e => e.pid === pid);
      const byName = entries.find(e => e.name === name);

      if (byPid && (Date.now() - byPid.updatedAt) < 12000) {
        return res.status(429).json({ ok: false, error: 'Too many submissions. Wait a moment.' });
      }

      if (byName && byName.pid && byName.pid !== pid) {
        return res.status(409).json({ ok: false, error: 'Name taken by another player.' });
      }

      if (byPid) {
        if (byPid.name !== name) {
          entries = entries.filter(e => e.pid !== pid);
          entries.push({
            name, score, pid,
            createdAt: byPid.createdAt || Date.now(),
            updatedAt: Date.now(),
          });
        } else if (score > byPid.score) {
          byPid.score = score;
          byPid.updatedAt = Date.now();
        } else {
          byPid.updatedAt = Date.now();
        }
      } else if (byName) {
        byName.pid = pid;
        if (score > byName.score) byName.score = score;
        byName.updatedAt = Date.now();
      } else {
        entries.push({
          name, score, pid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      entries.sort((a, b) => b.score - a.score);
      entries = entries.slice(0, MAX_ENTRIES);

      try {
        await kv.set(KEY, entries);
      } catch (e) {
        console.error('Redis SET error:', e);
        return res.status(503).json({ ok: false, error: 'Could not save to leaderboard' });
      }

      const rank = entries.findIndex(e => e.name === name) + 1;
      return res.status(200).json({ ok: true, rank, total: entries.length });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Slope leaderboard error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
