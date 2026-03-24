import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const GAME = '2048';
const LB_KEY = 'leaderboard:2048';
const NAME_KEY = 'leaderboard:2048:names';
const RATE_KEY = 'leaderboard:2048:rate';

const MAX_SCORE = 500000;
const WINDOW_MS = 10_000;
const MAX_POSTS_PER_WINDOW = 4;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function secret() {
  return ['D0G', 'G3D', '-S1', 'GV3', '-20', '26'].join('');
}

function expectedSig(pid, score, at) {
  return hash(`${GAME}|${pid}|${score}|${at}|${secret()}`);
}

function sanitizeName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 12);
}

async function withRateLimit(pid) {
  const key = `${RATE_KEY}:${pid}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, WINDOW_MS);
  }
  return count <= MAX_POSTS_PER_WINDOW;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const leaderboard = await redis.zrange(LB_KEY, 0, 4, { rev: true, withScores: true });
      const items = [];

      if (Array.isArray(leaderboard)) {
        for (let i = 0; i < leaderboard.length; i += 2) {
          const raw = leaderboard[i];
          const score = Number(leaderboard[i + 1] || 0);
          const [pid, name] = String(raw || '').split('|');
          if (!pid || !name) continue;
          items.push({ pid, name, score });
        }
      }

      return res.status(200).json({ ok: true, leaderboard: items });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const pid = String(body.pid || '').trim().slice(0, 40);
      const name = sanitizeName(body.name);
      const score = Math.floor(Number(body.score));
      const at = Number(body.at);
      const sig = String(body.sig || '');

      if (!pid || pid.length < 8) {
        return res.status(400).json({ ok: false, error: 'Invalid player id' });
      }
      if (!name || name.length < 2) {
        return res.status(400).json({ ok: false, error: 'Invalid name' });
      }
      if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
        return res.status(400).json({ ok: false, error: 'Invalid score' });
      }
      if (!Number.isFinite(at) || Math.abs(Date.now() - at) > 5 * 60 * 1000) {
        return res.status(400).json({ ok: false, error: 'Invalid timestamp' });
      }

      const expected = expectedSig(pid, score, at);
      if (sig !== expected) {
        return res.status(403).json({ ok: false, error: 'Bad signature' });
      }

      const allowed = await withRateLimit(pid);
      if (!allowed) {
        return res.status(429).json({ ok: false, error: 'Too many submissions. Slow down.' });
      }

      const existingPidForName = await redis.hget(NAME_KEY, name);
      if (existingPidForName && existingPidForName !== pid) {
        return res.status(409).json({ ok: false, error: 'Name already in use' });
      }

      const existingEntry = await redis.zrange(LB_KEY, 0, -1, { rev: true });
      let currentBest = 0;
      let existingMember = null;

      if (Array.isArray(existingEntry)) {
        for (const member of existingEntry) {
          const [memberPid, memberName] = String(member || '').split('|');
          if (memberPid === pid) {
            existingMember = member;
            if (memberName !== name) {
              await redis.hdel(NAME_KEY, memberName);
            }
            break;
          }
        }
      }

      if (existingMember) {
        const scoreArr = await redis.zscore(LB_KEY, existingMember);
        currentBest = Number(scoreArr || 0);
      }

      if (score <= currentBest) {
        return res.status(200).json({ ok: true, improved: false, message: 'Score not higher than your best' });
      }

      const newMember = `${pid}|${name}`;
      if (existingMember && existingMember !== newMember) {
        await redis.zrem(LB_KEY, existingMember);
      }

      await redis.zadd(LB_KEY, { score, member: newMember });
      await redis.hset(NAME_KEY, { [name]: pid });

      const keep = await redis.zrange(LB_KEY, 0, -1, { rev: true });
      if (Array.isArray(keep) && keep.length > 50) {
        const toTrim = keep.slice(50);
        for (const member of toTrim) {
          const [, trimName] = String(member || '').split('|');
          if (trimName) await redis.hdel(NAME_KEY, trimName);
          await redis.zrem(LB_KEY, member);
        }
      }

      return res.status(200).json({ ok: true, improved: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
