const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const LEADERBOARD_KEY = 'dogged:td-leaderboard';
const MAX_ENTRIES = 100;

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
  const str = `TD|${data.name}|${data.score}|${data.wave}|${data.kills}|${data.ts}|${data.pid}|${CLIENT_SECRET}`;
  return simpleHash(str) === signature;
}

function isScorePlausible(data) {
  const now = Date.now();
  if (Math.abs(now - data.ts) > 10 * 60 * 1000) return false;
  if (data.score <= 0) return false;
  if (!data.name || data.name.length < 1 || data.name.length > 20) return false;
  if (/<|>|&/.test(data.name)) return false;
  if (data.wave < 1 || !Number.isInteger(data.wave)) return false;
  if (data.kills < 0 || !Number.isInteger(data.kills)) return false;
  if (!data.pid || typeof data.pid !== 'string' || data.pid.length < 32) return false;
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — return leaderboard
    if (req.method === 'GET') {
      let entries = [];
      try {
        const raw = await kv.get(LEADERBOARD_KEY);
        if (raw === null || raw === undefined) {
          entries = [];
        } else if (Array.isArray(raw)) {
          entries = raw;
        } else if (typeof raw === 'string') {
          try { entries = JSON.parse(raw); } catch { entries = []; }
        }
      } catch (e) {
        console.error('Redis GET error:', e.message);
        return res.status(200).json({ ok: true, leaderboard: [], message: 'Storage unavailable' });
      }
      return res.status(200).json({ ok: true, leaderboard: entries, ts: Date.now() });
    }

    // POST — submit score
    if (req.method === 'POST') {
      const { name, score, wave, kills, ts, sig, pid } = req.body;

      if (!isScorePlausible({ name, score, wave, kills, ts, pid })) {
        return res.status(400).json({ ok: false, error: 'Invalid submission' });
      }

      if (!verifyPayload({ name, score, wave, kills, ts, pid }, sig)) {
        return res.status(403).json({ ok: false, error: 'Signature mismatch' });
      }

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

      const byPid = entries.find(e => e.pid === pid);
      const byName = entries.find(e => e.name === name);

      // Rate limit: 60 seconds per device
      if (byPid && (Date.now() - byPid.updatedAt) < 60000) {
        return res.status(429).json({ ok: false, error: 'Too many submissions. Wait 60 seconds.' });
      }

      // Reject if name is claimed by another device
      if (byName && byName.pid && byName.pid !== pid) {
        return res.status(409).json({ ok: false, error: 'Name already taken by another player. Choose a different name.' });
      }

      if (byPid) {
        if (byPid.name !== name) {
          entries = entries.filter(e => e.pid !== pid);
          entries.push({
            name, score, wave, kills, pid,
            createdAt: byPid.createdAt || Date.now(),
            updatedAt: Date.now(),
          });
        } else if (score > byPid.score) {
          byPid.score = score;
          byPid.wave = wave;
          byPid.kills = kills;
          byPid.updatedAt = Date.now();
        } else {
          byPid.wave = Math.max(byPid.wave || 0, wave);
          byPid.kills = Math.max(byPid.kills || 0, kills);
          byPid.updatedAt = Date.now();
        }
      } else if (byName) {
        byName.pid = pid;
        if (score > byName.score) {
          byName.score = score;
          byName.wave = wave;
          byName.kills = kills;
        }
        byName.updatedAt = Date.now();
      } else {
        entries.push({
          name, score, wave, kills, pid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

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
    console.error('TD Leaderboard error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
