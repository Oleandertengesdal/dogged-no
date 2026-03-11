const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const MAX_ENTRIES = 50;
const VALID_DIFFS = ['easy', 'medium', 'hard'];

function getKey(diff) {
  return `dogged:minesweeper:${diff}`;
}

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
  const str = `MS|${data.name}|${data.time}|${data.difficulty}|${data.ts}|${data.pid}|${CLIENT_SECRET}`;
  return simpleHash(str) === signature;
}

function isSubmissionPlausible(data) {
  const now = Date.now();
  if (Math.abs(now - data.ts) > 10 * 60 * 1000) return false;
  if (!data.name || data.name.length < 1 || data.name.length > 20) return false;
  if (/<|>|&/.test(data.name)) return false;
  if (!VALID_DIFFS.includes(data.difficulty)) return false;
  if (typeof data.time !== 'number' || data.time < 1 || data.time > 86400) return false;
  if (!data.pid || typeof data.pid !== 'string' || data.pid.length < 32) return false;
  return true;
}

async function getEntries(key) {
  try {
    const raw = await kv.get(key);
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  } catch (e) {
    console.error('Redis GET error:', e.message);
    return null; // null = error
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — return leaderboard for a difficulty
    if (req.method === 'GET') {
      const diff = req.query.difficulty || 'easy';
      if (!VALID_DIFFS.includes(diff)) {
        return res.status(400).json({ ok: false, error: 'Invalid difficulty' });
      }
      const entries = await getEntries(getKey(diff));
      if (entries === null) {
        return res.status(200).json({ ok: true, leaderboard: [], message: 'Storage unavailable' });
      }
      return res.status(200).json({ ok: true, leaderboard: entries, ts: Date.now() });
    }

    // POST — submit time
    if (req.method === 'POST') {
      const { name, time, difficulty, ts, sig, pid } = req.body;

      if (!isSubmissionPlausible({ name, time, difficulty, ts, pid })) {
        return res.status(400).json({ ok: false, error: 'Invalid submission' });
      }

      if (!verifyPayload({ name, time, difficulty, ts, pid }, sig)) {
        return res.status(403).json({ ok: false, error: 'Signature mismatch' });
      }

      const key = getKey(difficulty);
      let entries = await getEntries(key);
      if (entries === null) {
        return res.status(503).json({ ok: false, error: 'Leaderboard storage not available' });
      }

      const byPid = entries.find(e => e.pid === pid);
      const byName = entries.find(e => e.name === name);

      // Rate limit: 30 seconds
      if (byPid && (Date.now() - byPid.updatedAt) < 30000) {
        return res.status(429).json({ ok: false, error: 'Too many submissions. Wait 30 seconds.' });
      }

      if (byName && byName.pid && byName.pid !== pid) {
        return res.status(409).json({ ok: false, error: 'Name taken by another player.' });
      }

      if (byPid) {
        // Update if better time
        if (byPid.name !== name) {
          entries = entries.filter(e => e.pid !== pid);
          entries.push({
            name, time, pid,
            createdAt: byPid.createdAt || Date.now(),
            updatedAt: Date.now(),
          });
        } else if (time < byPid.time) {
          byPid.time = time;
          byPid.updatedAt = Date.now();
        } else {
          byPid.updatedAt = Date.now();
        }
      } else if (byName) {
        byName.pid = pid;
        if (time < byName.time) {
          byName.time = time;
        }
        byName.updatedAt = Date.now();
      } else {
        entries.push({
          name, time, pid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Sort by time ascending (fastest first), keep top N
      entries.sort((a, b) => a.time - b.time);
      entries = entries.slice(0, MAX_ENTRIES);

      try {
        await kv.set(key, entries);
      } catch (e) {
        console.error('Redis SET error:', e);
        return res.status(503).json({ ok: false, error: 'Could not save to leaderboard' });
      }

      const rank = entries.findIndex(e => e.name === name) + 1;
      return res.status(200).json({ ok: true, rank, total: entries.length });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Minesweeper leaderboard error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
