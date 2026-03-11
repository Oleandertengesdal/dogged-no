// ============================================================
// DOGGED TOWER DEFENCE — Full Game Engine
// ============================================================
(() => {
'use strict';

// ============= CONSTANTS =============
const TS = 40;       // tile size px
const COLS = 25;
const ROWS = 15;
const CW = COLS * TS; // 1000
const CH = ROWS * TS; // 600

// ============= PATH =============
const PATH_WAYPOINTS = [
  { x: 0, y: 3 },
  { x: 6, y: 3 },
  { x: 6, y: 11 },
  { x: 12, y: 11 },
  { x: 12, y: 4 },
  { x: 18, y: 4 },
  { x: 18, y: 12 },
  { x: 24, y: 12 },
];

function buildPathCells() {
  const s = new Set();
  const wp = PATH_WAYPOINTS;
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[i], b = wp[i + 1];
    if (a.x === b.x) {
      const minR = Math.min(a.y, b.y), maxR = Math.max(a.y, b.y);
      for (let r = minR; r <= maxR; r++) s.add(`${a.x},${r}`);
    } else {
      const minC = Math.min(a.x, b.x), maxC = Math.max(a.x, b.x);
      for (let c = minC; c <= maxC; c++) s.add(`${c},${a.y}`);
    }
  }
  return s;
}

function buildPathPixels() {
  const pts = [];
  const wp = PATH_WAYPOINTS;
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[i], b = wp[i + 1];
    if (a.x === b.x) {
      const dir = b.y > a.y ? 1 : -1;
      for (let r = a.y; r !== b.y; r += dir) {
        pts.push({ x: a.x * TS + TS / 2, y: r * TS + TS / 2 });
      }
    } else {
      const dir = b.x > a.x ? 1 : -1;
      for (let c = a.x; c !== b.x; c += dir) {
        pts.push({ x: c * TS + TS / 2, y: a.y * TS + TS / 2 });
      }
    }
  }
  const last = wp[wp.length - 1];
  pts.push({ x: last.x * TS + TS / 2, y: last.y * TS + TS / 2 });
  // Add exit point beyond canvas
  pts.push({ x: (last.x + 1) * TS + TS / 2, y: last.y * TS + TS / 2 });
  return pts;
}

const PATH_SET = buildPathCells();
const PATH_PX = buildPathPixels();

// ============= TOWER DEFINITIONS =============
const TOWER_DEFS = {
  speaker: {
    name: 'Dogged Speaker', emoji: '🔊',
    desc: 'Basic sound tower. Reliable dogged delivery at moderate range.',
    cost: 50, range: 120, damage: 10, atkSpd: 1.0,
    projSpeed: 300, projColor: '#ff6b35', color: '#ff6b35',
    upgrades: [
      { cost: 75,  dmg: 15, range: 130, atkSpd: 1.15, label: 'Louder Bass' },
      { cost: 175, dmg: 25, range: 145, atkSpd: 1.35, label: 'Surround Sound' },
      { cost: 400, dmg: 42, range: 165, atkSpd: 1.6,  label: 'Stadium Speaker' },
    ],
  },
  megaphone: {
    name: 'Mega Phone', emoji: '📢',
    desc: 'Long range, powerful dogged blasts that hit hard.',
    cost: 100, range: 180, damage: 25, atkSpd: 0.7,
    projSpeed: 350, projColor: '#f7c948', color: '#f7c948',
    upgrades: [
      { cost: 125, dmg: 38, range: 200, atkSpd: 0.8,  label: 'Extended Horn' },
      { cost: 275, dmg: 55, range: 225, atkSpd: 0.9,  label: 'Power Amp' },
      { cost: 600, dmg: 85, range: 260, atkSpd: 1.05, label: 'Sonic Boom' },
    ],
  },
  bass: {
    name: 'Bass Cannon', emoji: '🎵',
    desc: 'Slow but devastating area-of-effect sonic blasts.',
    cost: 150, range: 120, damage: 40, atkSpd: 0.4,
    splash: 60, projSpeed: 200, projColor: '#9b59b6', color: '#9b59b6',
    upgrades: [
      { cost: 200, dmg: 60,  splash: 70,  atkSpd: 0.45, label: 'Sub Woofer' },
      { cost: 450, dmg: 95,  splash: 85,  atkSpd: 0.5,  label: 'Earthquake Bass' },
      { cost: 950, dmg: 150, splash: 105, atkSpd: 0.55, label: '808 Apocalypse' },
    ],
  },
  freeze: {
    name: 'Freeze Speaker', emoji: '❄️',
    desc: 'Slows enemies with bone-chilling dogged frequencies.',
    cost: 125, range: 120, damage: 5, atkSpd: 0.8,
    slow: 0.5, slowDur: 2000,
    projSpeed: 250, projColor: '#00bcd4', color: '#00bcd4',
    upgrades: [
      { cost: 150, dmg: 8,  slow: 0.55, slowDur: 2500, label: 'Cryo Tone' },
      { cost: 325, dmg: 14, slow: 0.65, slowDur: 3000, label: 'Arctic Blast' },
      { cost: 700, dmg: 24, slow: 0.75, slowDur: 3500, label: 'Absolute Zero' },
    ],
  },
  tweet: {
    name: 'Viral Tweet Tower', emoji: '📱',
    desc: '"Dogged" goes viral — chains to nearby enemies.',
    cost: 200, range: 140, damage: 15, atkSpd: 0.6,
    chains: 3, chainRange: 80,
    projSpeed: 400, projColor: '#1da1f2', color: '#1da1f2',
    upgrades: [
      { cost: 250, dmg: 22, chains: 4, atkSpd: 0.7,  label: 'Retweet Storm' },
      { cost: 550, dmg: 34, chains: 5, atkSpd: 0.8,  label: 'Trending #Dogged' },
      { cost: 1100, dmg: 50, chains: 7, atkSpd: 0.95, label: 'Global Viral' },
    ],
  },
  djbooth: {
    name: 'DJ Booth', emoji: '🎧',
    desc: 'Aura tower — all enemies in range take continuous dogged DPS.',
    cost: 250, range: 100, damage: 15, atkSpd: 0,
    isAura: true, color: '#e91e63',
    upgrades: [
      { cost: 300, dmg: 25, range: 115, label: 'Bass Drop Zone' },
      { cost: 650, dmg: 42, range: 130, label: 'Rave Mode' },
      { cost: 1400, dmg: 70, range: 150, label: 'Festival Stage' },
    ],
  },
  sigve: {
    name: 'Sigve Clone', emoji: '🐶',
    desc: 'A clone of Sigve — extreme close-range dogged barrage.',
    cost: 300, range: 80, damage: 50, atkSpd: 1.5,
    projSpeed: 500, projColor: '#ff4500', color: '#ff4500',
    upgrades: [
      { cost: 400, dmg: 78,  atkSpd: 1.7, label: 'Dogged Fury' },
      { cost: 850, dmg: 120, atkSpd: 2.0, range: 90, label: 'Twin Dogged' },
      { cost: 1800, dmg: 185, atkSpd: 2.5, range: 100, label: 'Ultimate Sigve' },
    ],
  },
  billboard: {
    name: 'Dogged Billboard', emoji: '📺',
    desc: 'Support tower — buffs damage of all nearby towers.',
    cost: 200, range: 110, damage: 0, atkSpd: 0,
    isSupport: true, buff: 0.25, color: '#4caf50',
    upgrades: [
      { cost: 300, buff: 0.35, range: 120, label: 'LED Upgrade' },
      { cost: 650, buff: 0.50, range: 135, label: 'Hologram Board' },
      { cost: 1400, buff: 0.75, range: 155, label: 'Dogged Propaganda' },
    ],
  },
  satellite: {
    name: 'Dogged Satellite', emoji: '🛸',
    desc: 'Orbital dogged beams from space. Massive range, steady damage.',
    cost: 500, range: 280, damage: 80, atkSpd: 0.5,
    projSpeed: 600, projColor: '#ffd700', color: '#ffd700',
    upgrades: [
      { cost: 600, dmg: 125, atkSpd: 0.55, label: 'Focused Beam' },
      { cost: 1300, dmg: 190, atkSpd: 0.65, label: 'Dual Satellite' },
      { cost: 2800, dmg: 300, atkSpd: 0.8, range: 320, label: 'Orbital Cannon' },
    ],
  },
  golden: {
    name: 'Golden Megaphone', emoji: '✨',
    desc: 'The ultimate dogged weapon. Splash + extreme damage + fast.',
    cost: 750, range: 160, damage: 100, atkSpd: 1.2,
    splash: 50, projSpeed: 400, projColor: '#ffd700', color: '#ffd700',
    upgrades: [
      { cost: 1000, dmg: 155, splash: 60, atkSpd: 1.3, label: 'Diamond Amp' },
      { cost: 2200, dmg: 240, splash: 75, atkSpd: 1.5, label: 'Platinum Blast' },
      { cost: 4500, dmg: 380, splash: 95, atkSpd: 1.8, range: 185, label: 'Dogged Supreme' },
    ],
  },
};

// ============= ENEMY DEFINITIONS =============
const ENEMY_DEFS = {
  friend:     { name: 'Annoyed Friend',       emoji: '😤', hp: 30,  speed: 40,  reward: 5,  color: '#e74c3c' },
  coworker:   { name: 'Irritated Coworker',    emoji: '😠', hp: 60,  speed: 50,  reward: 8,  color: '#e67e22' },
  teacher:    { name: 'Angry Teacher',          emoji: '👨‍🏫', hp: 100, speed: 35,  reward: 12, color: '#f39c12' },
  speedster:  { name: 'Speed Runner',           emoji: '🏃', hp: 40,  speed: 90,  reward: 10, color: '#2ecc71' },
  canceller:  { name: 'Noise Canceller',        emoji: '🎧', hp: 150, speed: 30,  reward: 15, color: '#3498db', armor: 0.5 },
  earplugs:   { name: 'Ear Plugger',            emoji: '🔇', hp: 80,  speed: 55,  reward: 12, color: '#9b59b6', immuneSlow: true },
  parent:     { name: 'Enraged Parent',          emoji: '😡', hp: 300, speed: 25,  reward: 25, color: '#c0392b' },
  group:      { name: 'Group Intervention',      emoji: '👥', hp: 50,  speed: 45,  reward: 3,  color: '#95a5a6' },
};

const BOSS_DEFS = {
  hr:        { name: 'The HR Manager',         emoji: '👔', hp: 800,   speed: 20, reward: 100,  color: '#2c3e50' },
  principal: { name: 'The School Principal',    emoji: '🏫', hp: 2000,  speed: 25, reward: 200,  color: '#8b4513', regen: 10 },
  therapist: { name: 'The Therapist',           emoji: '🧠', hp: 4000,  speed: 18, reward: 400,  color: '#00695c', heals: true, healRange: 100, healAmt: 5 },
  lawyer:    { name: 'The Lawyer',              emoji: '⚖️', hp: 8000,  speed: 22, reward: 600,  color: '#1a237e', shield: 0.8 },
  judge:     { name: 'The Judge',               emoji: '🔨', hp: 15000, speed: 15, reward: 1000, color: '#4a148c' },
  supreme:   { name: 'Anti-Dogged Supreme',     emoji: '👑', hp: 30000, speed: 20, reward: 2000, color: '#b71c1c', regen: 50, armor: 0.3 },
};

// ============= WAVE DEFINITIONS =============
const WAVES = [
  { enemies: [{ t: 'friend', n: 8, i: 1500 }] },
  { enemies: [{ t: 'friend', n: 12, i: 1200 }] },
  { enemies: [{ t: 'friend', n: 8, i: 1000 }, { t: 'coworker', n: 4, i: 1500 }] },
  { enemies: [{ t: 'coworker', n: 10, i: 1200 }] },
  { enemies: [{ t: 'friend', n: 10, i: 800 }, { t: 'coworker', n: 5, i: 1000 }], boss: 'hr' },
  { enemies: [{ t: 'coworker', n: 8, i: 1000 }, { t: 'speedster', n: 4, i: 2000 }] },
  { enemies: [{ t: 'friend', n: 15, i: 600 }, { t: 'speedster', n: 6, i: 1500 }] },
  { enemies: [{ t: 'teacher', n: 6, i: 1500 }, { t: 'coworker', n: 8, i: 1000 }] },
  { enemies: [{ t: 'group', n: 25, i: 400 }] },
  { enemies: [{ t: 'teacher', n: 8, i: 1000 }, { t: 'speedster', n: 6, i: 800 }], boss: 'principal' },
  { enemies: [{ t: 'canceller', n: 5, i: 2000 }, { t: 'coworker', n: 10, i: 800 }] },
  { enemies: [{ t: 'teacher', n: 10, i: 1000 }, { t: 'speedster', n: 8, i: 700 }] },
  { enemies: [{ t: 'earplugs', n: 6, i: 1500 }, { t: 'canceller', n: 4, i: 2000 }] },
  { enemies: [{ t: 'friend', n: 20, i: 500 }, { t: 'speedster', n: 10, i: 600 }] },
  { enemies: [{ t: 'canceller', n: 6, i: 1500 }, { t: 'earplugs', n: 6, i: 1200 }], boss: 'therapist' },
  { enemies: [{ t: 'parent', n: 3, i: 3000 }, { t: 'teacher', n: 10, i: 900 }] },
  { enemies: [{ t: 'parent', n: 5, i: 2500 }, { t: 'canceller', n: 8, i: 1200 }] },
  { enemies: [{ t: 'speedster', n: 20, i: 400 }] },
  { enemies: [{ t: 'parent', n: 8, i: 2000 }, { t: 'earplugs', n: 10, i: 800 }] },
  { enemies: [{ t: 'parent', n: 5, i: 2000 }, { t: 'canceller', n: 8, i: 1000 }], boss: 'lawyer' },
  { enemies: [{ t: 'teacher', n: 15, i: 600 }, { t: 'parent', n: 5, i: 1800 }] },
  { enemies: [{ t: 'group', n: 40, i: 300 }, { t: 'speedster', n: 10, i: 500 }] },
  { enemies: [{ t: 'canceller', n: 10, i: 1000 }, { t: 'earplugs', n: 10, i: 800 }] },
  { enemies: [{ t: 'parent', n: 10, i: 1500 }, { t: 'speedster', n: 15, i: 500 }] },
  { enemies: [{ t: 'parent', n: 8, i: 1500 }, { t: 'canceller', n: 10, i: 800 }], boss: 'judge' },
  { enemies: [{ t: 'parent', n: 12, i: 1200 }, { t: 'earplugs', n: 15, i: 600 }] },
  { enemies: [{ t: 'group', n: 60, i: 200 }] },
  { enemies: [{ t: 'canceller', n: 15, i: 800 }, { t: 'parent', n: 10, i: 1000 }] },
  { enemies: [{ t: 'speedster', n: 25, i: 300 }, { t: 'parent', n: 8, i: 1500 }] },
  { enemies: [{ t: 'parent', n: 10, i: 1000 }, { t: 'canceller', n: 10, i: 800 }], boss: 'supreme' },
];

// ============= ANTI-CHEAT =============
const AC = {
  SECRET: ['D0G','G3D','-S1','GV3','-20','26'].join(''),
  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h = ((h << 5) - h) + c;
      h |= 0;
    }
    return (h >>> 0).toString(36);
  },
  sign(data) {
    const str = `TD|${data.name}|${data.score}|${data.wave}|${data.kills}|${data.ts}|${data.pid}|${this.SECRET}`;
    return this.hash(str);
  },
};

// ============= PLAYER ID =============
function getPlayerId() {
  let pid = localStorage.getItem('dogged-td-pid');
  if (!pid) {
    pid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    localStorage.setItem('dogged-td-pid', pid);
  }
  return pid;
}
const PID = getPlayerId();

// ============= GAME STATE =============
const G = {
  gold: 200, lives: 20, wave: 0, score: 0,
  kills: 0, bossKills: 0, totalGold: 200,
  state: 'pre', // pre, idle, spawning, active, gameover
  speed: 1,
  selType: null,     // tower type to place
  selTower: null,    // placed tower being inspected
  towers: [], enemies: [], projectiles: [],
  particles: [], floats: [],
  spawnQueue: [], spawnTimer: 0, bossQueued: null,
  lastTime: 0,
  canvas: null, ctx: null,
  mouse: { x: -1, y: -1, col: -1, row: -1 },
  occupied: new Set(),
  sigveImg: null,
};

// ============= HELPERS =============
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

// ============= TOWER CLASS =============
function createTower(type, col, row) {
  const def = TOWER_DEFS[type];
  return {
    type, col, row,
    x: col * TS + TS / 2,
    y: row * TS + TS / 2,
    level: 0,      // 0 = base, 1-3 = upgraded
    damage: def.damage,
    range: def.range,
    atkSpd: def.atkSpd,
    splash: def.splash || 0,
    slow: def.slow || 0,
    slowDur: def.slowDur || 0,
    chains: def.chains || 0,
    chainRange: def.chainRange || 0,
    buff: def.buff || 0,
    cooldown: 0,
    totalInvested: def.cost,
    targeting: 'first', // first, last, strong, near
    kills: 0,
    damageDealt: 0,
    _buffedDamage: 0,  // cached
  };
}

function getTowerStats(tower) {
  const def = TOWER_DEFS[tower.type];
  return {
    damage: tower.damage,
    range: tower.range,
    atkSpd: tower.atkSpd,
    splash: tower.splash,
    slow: tower.slow,
    slowDur: tower.slowDur,
    chains: tower.chains,
    buff: tower.buff,
    isAura: def.isAura || false,
    isSupport: def.isSupport || false,
  };
}

function upgradeTower(tower) {
  const def = TOWER_DEFS[tower.type];
  if (tower.level >= 3) return false;
  const upg = def.upgrades[tower.level];
  if (G.gold < upg.cost) return false;
  G.gold -= upg.cost;
  tower.totalInvested += upg.cost;
  tower.level++;
  if (upg.dmg !== undefined) tower.damage = upg.dmg;
  if (upg.range !== undefined) tower.range = upg.range;
  if (upg.atkSpd !== undefined) tower.atkSpd = upg.atkSpd;
  if (upg.splash !== undefined) tower.splash = upg.splash;
  if (upg.slow !== undefined) tower.slow = upg.slow;
  if (upg.slowDur !== undefined) tower.slowDur = upg.slowDur;
  if (upg.chains !== undefined) tower.chains = upg.chains;
  if (upg.buff !== undefined) tower.buff = upg.buff;
  updateUI();
  return true;
}

function sellTower(tower) {
  const refund = Math.floor(tower.totalInvested * 0.7);
  G.gold += refund;
  G.towers = G.towers.filter(t => t !== tower);
  G.occupied.delete(`${tower.col},${tower.row}`);
  if (G.selTower === tower) G.selTower = null;
  addFloat(tower.x, tower.y, `+${refund}💰`, '#f7c948');
  updateUI();
  updateInfoPanel();
}

function getEffectiveDamage(tower) {
  const def = TOWER_DEFS[tower.type];
  if (def.isSupport) return 0;
  let dmg = tower.damage;
  // Add buff from nearby billboards
  for (const t of G.towers) {
    if (t === tower) continue;
    if (!TOWER_DEFS[t.type].isSupport) continue;
    const d = dist(tower, t);
    if (d <= t.range) {
      dmg *= (1 + t.buff);
    }
  }
  return dmg;
}

// ============= ENEMY CLASS =============
function createEnemy(type, hpMult = 1) {
  const def = ENEMY_DEFS[type] || BOSS_DEFS[type];
  if (!def) return null;
  const isBoss = !!BOSS_DEFS[type];
  const baseHp = Math.floor(def.hp * hpMult);
  return {
    type, isBoss,
    x: PATH_PX[0].x - TS, y: PATH_PX[0].y,
    hp: baseHp, maxHp: baseHp,
    speed: def.speed,
    baseSpeed: def.speed,
    reward: Math.floor(def.reward * (hpMult > 1 ? Math.sqrt(hpMult) : 1)),
    color: def.color,
    emoji: def.emoji,
    armor: def.armor || 0,
    immuneSlow: def.immuneSlow || false,
    regen: def.regen || 0,
    heals: def.heals || false,
    healRange: def.healRange || 0,
    healAmt: def.healAmt || 0,
    shield: def.shield || 0,
    pathIdx: 0,
    pathProgress: 0, // 0 to 1 between current and next waypoint
    slowTimer: 0,
    slowAmount: 0,
    alive: true,
    reachedEnd: false,
  };
}

function moveEnemy(enemy, dt) {
  if (!enemy.alive || enemy.reachedEnd) return;

  // Apply slow
  let spd = enemy.baseSpeed;
  if (enemy.slowTimer > 0 && !enemy.immuneSlow) {
    spd *= (1 - enemy.slowAmount);
    enemy.slowTimer -= dt * 1000;
    if (enemy.slowTimer <= 0) { enemy.slowTimer = 0; enemy.slowAmount = 0; }
  }
  enemy.speed = spd;

  // Regen
  if (enemy.regen > 0) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen * dt);
  }

  // Boss heal nearby
  if (enemy.heals && enemy.isBoss) {
    for (const e of G.enemies) {
      if (e === enemy || !e.alive || e.reachedEnd) continue;
      const d = dist(enemy, e);
      if (d <= enemy.healRange) {
        e.hp = Math.min(e.maxHp, e.hp + enemy.healAmt * dt);
      }
    }
  }

  // Move along path
  if (enemy.pathIdx >= PATH_PX.length - 1) {
    enemy.reachedEnd = true;
    enemy.alive = false;
    G.lives--;
    if (enemy.isBoss) G.lives -= 4; // bosses cost 5 lives total
    if (G.lives <= 0) { G.lives = 0; gameOver(); }
    updateUI();
    return;
  }

  const curr = PATH_PX[enemy.pathIdx];
  const next = PATH_PX[enemy.pathIdx + 1];
  const segLen = dist(curr, next);
  if (segLen === 0) { enemy.pathIdx++; return; }

  const move = spd * dt;
  enemy.pathProgress += move / segLen;

  while (enemy.pathProgress >= 1 && enemy.pathIdx < PATH_PX.length - 1) {
    enemy.pathProgress -= 1;
    enemy.pathIdx++;
  }

  if (enemy.pathIdx < PATH_PX.length - 1) {
    const c = PATH_PX[enemy.pathIdx];
    const n = PATH_PX[enemy.pathIdx + 1];
    enemy.x = lerp(c.x, n.x, enemy.pathProgress);
    enemy.y = lerp(c.y, n.y, enemy.pathProgress);
  } else {
    enemy.reachedEnd = true;
    enemy.alive = false;
    G.lives--;
    if (enemy.isBoss) G.lives -= 4;
    if (G.lives <= 0) { G.lives = 0; gameOver(); }
    updateUI();
  }
}

function damageEnemy(enemy, rawDmg, tower) {
  let dmg = rawDmg;
  // Armor reduces damage
  if (enemy.armor > 0) dmg *= (1 - enemy.armor);
  // Shield (boss): first 20% of hp takes half damage
  if (enemy.shield > 0 && enemy.hp > enemy.maxHp * enemy.shield) {
    dmg *= 0.5;
  }
  enemy.hp -= dmg;
  if (tower) tower.damageDealt += dmg;

  if (enemy.hp <= 0) {
    enemy.alive = false;
    G.gold += enemy.reward;
    G.totalGold += enemy.reward;
    G.kills++;
    if (enemy.isBoss) G.bossKills++;
    if (tower) tower.kills++;
    addFloat(enemy.x, enemy.y - 10, `+${enemy.reward}💰`, '#f7c948');
    // Death particles
    for (let i = 0; i < (enemy.isBoss ? 20 : 8); i++) {
      addParticle(enemy.x, enemy.y, enemy.color);
    }
    updateUI();
  }
}

// ============= PROJECTILES =============
function createProjectile(tower, target) {
  const def = TOWER_DEFS[tower.type];
  return {
    x: tower.x, y: tower.y,
    tx: target.x, ty: target.y,
    target: target,
    tower: tower,
    speed: def.projSpeed,
    damage: getEffectiveDamage(tower),
    splash: tower.splash,
    slow: tower.slow,
    slowDur: tower.slowDur,
    chains: tower.chains,
    chainRange: tower.chainRange || 80,
    color: def.projColor,
    alive: true,
    chainHit: new Set(),
  };
}

function moveProjectile(proj, dt) {
  if (!proj.alive) return;

  // Move toward target position
  const target = proj.target;
  if (target && target.alive) {
    proj.tx = target.x;
    proj.ty = target.y;
  }

  const dx = proj.tx - proj.x;
  const dy = proj.ty - proj.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d < 8) {
    // Hit!
    proj.alive = false;
    projectileHit(proj);
    return;
  }

  const move = proj.speed * dt;
  proj.x += (dx / d) * move;
  proj.y += (dy / d) * move;

  // Kill projectile if it goes way off screen
  if (proj.x < -50 || proj.x > CW + 50 || proj.y < -50 || proj.y > CH + 50) {
    proj.alive = false;
  }
}

function projectileHit(proj) {
  // Direct hit
  if (proj.target && proj.target.alive) {
    damageEnemy(proj.target, proj.damage, proj.tower);
    // Apply slow
    if (proj.slow > 0 && !proj.target.immuneSlow) {
      proj.target.slowAmount = Math.max(proj.target.slowAmount, proj.slow);
      proj.target.slowTimer = Math.max(proj.target.slowTimer, proj.slowDur);
    }
    proj.chainHit.add(proj.target);
  }

  // Splash damage
  if (proj.splash > 0) {
    for (const e of G.enemies) {
      if (!e.alive || e === proj.target) continue;
      if (dist({ x: proj.tx, y: proj.ty }, e) <= proj.splash) {
        damageEnemy(e, proj.damage * 0.5, proj.tower);
        if (proj.slow > 0 && !e.immuneSlow) {
          e.slowAmount = Math.max(e.slowAmount, proj.slow * 0.5);
          e.slowTimer = Math.max(e.slowTimer, proj.slowDur * 0.5);
        }
      }
    }
    // Splash visual
    addSplashParticle(proj.tx, proj.ty, proj.splash, proj.color);
  }

  // Chain
  if (proj.chains > 0) {
    let chainTarget = proj.target || { x: proj.tx, y: proj.ty };
    let remaining = proj.chains;
    while (remaining > 0) {
      let closest = null, closestDist = Infinity;
      for (const e of G.enemies) {
        if (!e.alive || proj.chainHit.has(e)) continue;
        const d = dist(chainTarget, e);
        if (d <= proj.chainRange && d < closestDist) {
          closest = e; closestDist = d;
        }
      }
      if (!closest) break;
      damageEnemy(closest, proj.damage * 0.6, proj.tower);
      if (proj.slow > 0 && !closest.immuneSlow) {
        closest.slowAmount = Math.max(closest.slowAmount, proj.slow * 0.5);
        closest.slowTimer = Math.max(closest.slowTimer, proj.slowDur * 0.5);
      }
      proj.chainHit.add(closest);
      // Chain visual line
      G.particles.push({
        x: chainTarget.x, y: chainTarget.y, x2: closest.x, y2: closest.y,
        color: proj.color, life: 0.3, isLine: true,
      });
      chainTarget = closest;
      remaining--;
    }
  }
}

// ============= PARTICLES & EFFECTS =============
function addParticle(x, y, color) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 30 + Math.random() * 60;
  G.particles.push({
    x, y, color,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.4 + Math.random() * 0.4,
    size: 2 + Math.random() * 3,
  });
}

function addSplashParticle(x, y, radius, color) {
  G.particles.push({
    x, y, color, radius, life: 0.3,
    isSplash: true,
  });
}

function addFloat(x, y, text, color, size) {
  G.floats.push({ x, y, text, color, size: size || 14, life: 1.2, vy: -35 });
}

// ============= TOWER LOGIC =============
function towerUpdate(tower, dt) {
  const def = TOWER_DEFS[tower.type];

  // Aura towers: damage all enemies in range
  if (def.isAura) {
    const dmg = getEffectiveDamage(tower) * dt;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      if (dist(tower, e) <= tower.range) {
        damageEnemy(e, dmg, tower);
      }
    }
    return;
  }

  // Support towers: no attacking
  if (def.isSupport) return;

  // Regular towers: cooldown & shoot
  if (tower.cooldown > 0) {
    tower.cooldown -= dt;
    return;
  }

  // Find target
  const target = findTarget(tower);
  if (!target) return;

  // Shoot
  tower.cooldown = 1 / tower.atkSpd;
  G.projectiles.push(createProjectile(tower, target));
}

function findTarget(tower) {
  let candidates = G.enemies.filter(e => e.alive && dist(tower, e) <= tower.range);
  if (candidates.length === 0) return null;

  switch (tower.targeting) {
    case 'first':
      // Closest to end = highest pathIdx + pathProgress
      return candidates.reduce((best, e) => {
        const prog = e.pathIdx + e.pathProgress;
        const bestProg = best.pathIdx + best.pathProgress;
        return prog > bestProg ? e : best;
      });
    case 'last':
      return candidates.reduce((best, e) => {
        const prog = e.pathIdx + e.pathProgress;
        const bestProg = best.pathIdx + best.pathProgress;
        return prog < bestProg ? e : best;
      });
    case 'strong':
      return candidates.reduce((best, e) => e.hp > best.hp ? e : best);
    case 'near':
      return candidates.reduce((best, e) => dist(tower, e) < dist(tower, best) ? e : best);
    default:
      return candidates[0];
  }
}

// ============= WAVE MANAGEMENT =============
function startWave() {
  G.wave++;
  G.state = 'spawning';
  G.spawnQueue = [];
  G.bossQueued = null;

  let waveDef;
  if (G.wave <= WAVES.length) {
    waveDef = WAVES[G.wave - 1];
  } else {
    waveDef = generateEndlessWave(G.wave);
  }

  const hpMult = waveDef.hpMult || 1;

  // Build spawn queue
  for (const group of waveDef.enemies) {
    for (let i = 0; i < group.n; i++) {
      G.spawnQueue.push({ type: group.t, delay: group.i, hpMult: hpMult * (group.hpMult || 1) });
    }
  }

  if (waveDef.boss) {
    G.bossQueued = { type: waveDef.boss, hpMult };
  }

  G.spawnTimer = 500; // small delay before first spawn

  // Announce wave
  announceWave(G.wave, !!waveDef.boss);
  updateUI();
  updateWaveInfo();
}

function generateEndlessWave(waveNum) {
  const scale = 1 + (waveNum - 30) * 0.25;
  const countScale = 1 + (waveNum - 30) * 0.1;
  const types = Object.keys(ENEMY_DEFS);
  const groups = [];
  const numGroups = 2 + Math.floor((waveNum - 30) / 3);

  for (let i = 0; i < Math.min(numGroups, 5); i++) {
    const t = types[Math.floor(Math.random() * types.length)];
    const n = Math.floor((8 + Math.random() * 15) * countScale);
    const baseInterval = 1000 - (waveNum - 30) * 15;
    const interval = Math.max(150, baseInterval - Math.random() * 200);
    groups.push({ t, n, i: interval, hpMult: scale });
  }

  // Boss every 5 waves
  let boss = null;
  if (waveNum % 5 === 0) {
    const bossTypes = Object.keys(BOSS_DEFS);
    boss = bossTypes[Math.floor(Math.random() * bossTypes.length)];
  }

  return { enemies: groups, boss, hpMult: scale };
}

function spawnUpdate(dt) {
  if (G.state !== 'spawning') return;

  G.spawnTimer -= dt * 1000;
  if (G.spawnTimer <= 0 && G.spawnQueue.length > 0) {
    const next = G.spawnQueue.shift();
    const enemy = createEnemy(next.type, next.hpMult);
    if (enemy) G.enemies.push(enemy);
    G.spawnTimer = G.spawnQueue.length > 0 ? G.spawnQueue[0].delay : 0;
  }

  // Spawn boss after regulars
  if (G.spawnQueue.length === 0 && G.bossQueued) {
    const boss = createEnemy(G.bossQueued.type, G.bossQueued.hpMult || 1);
    if (boss) {
      G.enemies.push(boss);
      showBossWarning();
    }
    G.bossQueued = null;
  }

  // All spawned? Switch to active
  if (G.spawnQueue.length === 0 && !G.bossQueued) {
    G.state = 'active';
  }
}

function checkWaveComplete() {
  if (G.state !== 'active' && G.state !== 'spawning') return;
  if (G.spawnQueue.length > 0 || G.bossQueued) return;
  const aliveEnemies = G.enemies.filter(e => e.alive && !e.reachedEnd);
  if (aliveEnemies.length === 0) {
    G.state = 'idle';
    G.enemies = [];
    G.projectiles = [];
    // Wave completion bonus
    const bonus = 10 + G.wave * 5;
    G.gold += bonus;
    G.totalGold += bonus;
    addFloat(CW / 2, CH / 2 - 30, `Wave ${G.wave} Complete! +${bonus}💰`, '#4caf50', 18);
    calculateScore();
    updateUI();
    updateWaveInfo();
    showWaveButton();
  }
}

function calculateScore() {
  G.score = (G.wave * 100) + (G.kills * 10) + Math.floor(G.totalGold * 0.5) +
            (G.lives * 50) + (G.bossKills * 500);
}

// ============= GAME FLOW =============
function gameOver() {
  G.state = 'gameover';
  calculateScore();
  updateUI();
  // Show game over overlay
  const el = document.getElementById('gameOverOverlay');
  el.classList.remove('hidden');
  document.getElementById('goWave').textContent = G.wave;
  document.getElementById('goKills').textContent = G.kills;
  document.getElementById('goScore').textContent = fmt(G.score);
  // Load saved name
  const savedName = localStorage.getItem('dogged-td-name') || '';
  document.getElementById('goName').value = savedName;
}

function resetGame() {
  G.gold = 200; G.lives = 20; G.wave = 0;
  G.score = 0; G.kills = 0; G.bossKills = 0; G.totalGold = 200;
  G.state = 'idle'; G.speed = 1;
  G.selType = null; G.selTower = null;
  G.towers = []; G.enemies = []; G.projectiles = [];
  G.particles = []; G.floats = [];
  G.spawnQueue = []; G.spawnTimer = 0; G.bossQueued = null;
  G.occupied = new Set();
  document.getElementById('gameOverOverlay').classList.add('hidden');
  document.getElementById('preOverlay').classList.add('hidden');
  updateUI();
  updateInfoPanel();
  updateWaveInfo();
  showWaveButton();
  renderShop();
  // Reset speed buttons
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b.dataset.speed === '1'));
}

// ============= RENDERING =============
function render() {
  const ctx = G.ctx;
  ctx.clearRect(0, 0, CW, CH);

  drawGround(ctx);
  drawPath(ctx);
  drawGrid(ctx);
  drawTowerRanges(ctx);
  drawPlacementPreview(ctx);
  drawTowers(ctx);
  drawEnemies(ctx);
  drawProjectiles(ctx);
  drawParticles(ctx);
  drawFloats(ctx);
}

function drawGround(ctx) {
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(0, 0, CW, CH);

  // Subtle grass pattern
  ctx.fillStyle = 'rgba(30, 60, 30, 0.3)';
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if ((c + r) % 2 === 0) {
        ctx.fillRect(c * TS, r * TS, TS, TS);
      }
    }
  }
}

function drawPath(ctx) {
  // Draw path tiles
  for (const key of PATH_SET) {
    const [c, r] = key.split(',').map(Number);
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(c * TS, r * TS, TS, TS);
    // Inner path (slightly lighter)
    ctx.fillStyle = '#a0896c';
    ctx.fillRect(c * TS + 3, r * TS + 3, TS - 6, TS - 6);
  }

  // Draw path direction arrows (subtle)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Entry arrow
  ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
  ctx.font = '16px sans-serif';
  ctx.fillText('▶', 0 * TS + TS / 2, 3 * TS + TS / 2);

  // Exit arrow
  ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
  ctx.fillText('▶', 24 * TS + TS / 2, 12 * TS + TS / 2);
}

function drawGrid(ctx) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * TS, 0);
    ctx.lineTo(c * TS, CH);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * TS);
    ctx.lineTo(CW, r * TS);
    ctx.stroke();
  }
}

function drawTowerRanges(ctx) {
  // Selected tower range
  if (G.selTower) {
    ctx.beginPath();
    ctx.arc(G.selTower.x, G.selTower.y, G.selTower.range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 107, 53, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 107, 53, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPlacementPreview(ctx) {
  if (!G.selType || G.mouse.col < 0 || G.mouse.row < 0) return;
  if (G.mouse.col >= COLS || G.mouse.row >= ROWS) return;

  const col = G.mouse.col, row = G.mouse.row;
  const x = col * TS, y = row * TS;
  const key = `${col},${row}`;
  const valid = !PATH_SET.has(key) && !G.occupied.has(key);

  const def = TOWER_DEFS[G.selType];

  // Range preview
  const cx = x + TS / 2, cy = y + TS / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, def.range, 0, Math.PI * 2);
  ctx.fillStyle = valid ? 'rgba(76, 175, 80, 0.06)' : 'rgba(231, 76, 60, 0.06)';
  ctx.fill();
  ctx.strokeStyle = valid ? 'rgba(76, 175, 80, 0.25)' : 'rgba(231, 76, 60, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tile highlight
  ctx.fillStyle = valid ? 'rgba(76, 175, 80, 0.25)' : 'rgba(231, 76, 60, 0.25)';
  ctx.fillRect(x, y, TS, TS);

  // Ghost tower
  if (valid) {
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.5;
    ctx.fillText(def.emoji, cx, cy);
    ctx.globalAlpha = 1;
  }
}

function drawTowers(ctx) {
  for (const tower of G.towers) {
    const def = TOWER_DEFS[tower.type];
    const x = tower.x, y = tower.y;

    // Base circle
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Selected highlight
    if (G.selTower === tower) {
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Emoji
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, x, y);

    // Level dots
    if (tower.level > 0) {
      for (let i = 0; i < tower.level; i++) {
        const dotX = x - 8 + i * 8;
        const dotY = y + 18;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f7c948';
        ctx.fill();
      }
    }

    // Aura visual
    if (def.isAura) {
      ctx.beginPath();
      ctx.arc(x, y, tower.range, 0, Math.PI * 2);
      ctx.strokeStyle = `${def.color}44`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Support buff range
    if (def.isSupport) {
      ctx.beginPath();
      ctx.arc(x, y, tower.range, 0, Math.PI * 2);
      ctx.strokeStyle = `${def.color}33`;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawEnemies(ctx) {
  for (const enemy of G.enemies) {
    if (!enemy.alive) continue;
    const x = enemy.x, y = enemy.y;
    const size = enemy.isBoss ? 18 : 12;
    const emojiSize = enemy.isBoss ? 24 : 18;

    // Boss glow
    if (enemy.isBoss) {
      ctx.beginPath();
      ctx.arc(x, y, size + 6, 0, Math.PI * 2);
      ctx.fillStyle = `${enemy.color}33`;
      ctx.fill();
    }

    // Body circle
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = enemy.color;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Slow tint
    if (enemy.slowTimer > 0) {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 188, 212, 0.3)';
      ctx.fill();
    }

    // Emoji
    ctx.font = `${emojiSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemy.emoji, x, y);

    // Health bar
    const barW = enemy.isBoss ? 36 : 24;
    const barH = 3;
    const barX = x - barW / 2;
    const barY = y - size - 6;
    const hpPct = clamp(enemy.hp / enemy.maxHp, 0, 1);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // HP bar color
    const hpColor = hpPct > 0.6 ? '#4caf50' : hpPct > 0.3 ? '#f7c948' : '#e74c3c';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    // Shield indicator
    if (enemy.shield > 0 && enemy.hp > enemy.maxHp * enemy.shield) {
      ctx.fillStyle = 'rgba(100, 149, 237, 0.5)';
      ctx.fillRect(barX, barY, barW * hpPct, barH);
    }
  }
}

function drawProjectiles(ctx) {
  for (const proj of G.projectiles) {
    if (!proj.alive) continue;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = proj.color;
    ctx.fill();

    // Trail
    ctx.beginPath();
    const dx = proj.tx - proj.x;
    const dy = proj.ty - proj.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0) {
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(proj.x - (dx / d) * 8, proj.y - (dy / d) * 8);
      ctx.strokeStyle = proj.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawParticles(ctx) {
  for (const p of G.particles) {
    if (p.isLine) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x2, p.y2);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = p.life / 0.3;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.isSplash) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (1 - p.life / 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = p.life / 0.3 * 0.5;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / 0.8), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawFloats(ctx) {
  for (const f of G.floats) {
    ctx.font = `bold ${f.size}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = f.color;
    ctx.globalAlpha = clamp(f.life / 0.5, 0, 1);
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}

// ============= UPDATE =============
function update(dt) {
  // Spawn
  spawnUpdate(dt);

  // Move enemies
  for (const e of G.enemies) moveEnemy(e, dt);

  // Tower updates
  for (const t of G.towers) towerUpdate(t, dt);

  // Move projectiles
  for (const p of G.projectiles) moveProjectile(p, dt);

  // Update particles
  for (const p of G.particles) {
    if (!p.isLine && !p.isSplash) {
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
    }
    p.life -= dt;
  }
  G.particles = G.particles.filter(p => p.life > 0);

  // Update floating texts
  for (const f of G.floats) {
    f.y += f.vy * dt;
    f.life -= dt;
  }
  G.floats = G.floats.filter(f => f.life > 0);

  // Clean dead
  G.enemies = G.enemies.filter(e => e.alive);
  G.projectiles = G.projectiles.filter(p => p.alive);

  // Check wave complete
  checkWaveComplete();
}

// ============= GAME LOOP =============
function gameLoop(timestamp) {
  const rawDt = (timestamp - G.lastTime) / 1000;
  const dt = Math.min(rawDt, 0.1) * G.speed;
  G.lastTime = timestamp;

  if (G.state !== 'gameover' && G.state !== 'pre') {
    update(dt);
  }
  render();
  requestAnimationFrame(gameLoop);
}

// ============= UI =============
function updateUI() {
  document.getElementById('goldDisplay').textContent = `💰 ${fmt(G.gold)}`;
  document.getElementById('livesDisplay').textContent = `❤️ ${G.lives}`;
  document.getElementById('waveDisplay').textContent = `☠️ Wave ${G.wave}`;
  document.getElementById('killsDisplay').textContent = `💀 ${G.kills}`;
  document.getElementById('scoreDisplay').textContent = fmt(G.score);

  // Update shop affordability
  document.querySelectorAll('.tower-shop-item').forEach(el => {
    const type = el.dataset.type;
    const def = TOWER_DEFS[type];
    el.classList.toggle('cannot-afford', G.gold < def.cost);
  });
}

function renderShop() {
  const container = document.getElementById('towerList');
  container.innerHTML = '';
  for (const [type, def] of Object.entries(TOWER_DEFS)) {
    const el = document.createElement('div');
    el.className = 'tower-shop-item';
    el.dataset.type = type;
    if (G.gold < def.cost) el.classList.add('cannot-afford');
    if (G.selType === type) el.classList.add('selected');

    el.innerHTML = `
      <div class="tsi-icon">${def.emoji}</div>
      <div class="tsi-info">
        <div class="tsi-name">${def.name}</div>
        <div class="tsi-desc">${def.desc.substring(0, 40)}...</div>
      </div>
      <div class="tsi-cost">💰 ${def.cost}</div>
    `;

    el.addEventListener('click', () => {
      if (G.state === 'gameover' || G.state === 'pre') return;
      if (G.gold < def.cost) return;
      if (G.selType === type) {
        G.selType = null;
      } else {
        G.selType = type;
        G.selTower = null;
      }
      document.querySelectorAll('.tower-shop-item').forEach(e =>
        e.classList.toggle('selected', e.dataset.type === G.selType));
      updateInfoPanel();
    });

    // Hover shows tower info
    el.addEventListener('mouseenter', () => {
      if (!G.selTower && !G.selType) showTowerTypeInfo(type);
    });

    container.appendChild(el);
  }
}

function showTowerTypeInfo(type) {
  const def = TOWER_DEFS[type];
  const panel = document.getElementById('towerInfoContent');
  let statsHtml = '';
  if (def.damage > 0) statsHtml += `<div class="tower-stat-row"><span>Damage</span><strong>${def.damage}</strong></div>`;
  if (def.atkSpd > 0) statsHtml += `<div class="tower-stat-row"><span>Attack Speed</span><strong>${def.atkSpd}/s</strong></div>`;
  statsHtml += `<div class="tower-stat-row"><span>Range</span><strong>${def.range}px</strong></div>`;
  if (def.splash) statsHtml += `<div class="tower-stat-row"><span>Splash</span><strong>${def.splash}px</strong></div>`;
  if (def.slow) statsHtml += `<div class="tower-stat-row"><span>Slow</span><strong>${Math.round(def.slow * 100)}%</strong></div>`;
  if (def.chains) statsHtml += `<div class="tower-stat-row"><span>Chain</span><strong>${def.chains} targets</strong></div>`;
  if (def.buff) statsHtml += `<div class="tower-stat-row"><span>Buff</span><strong>+${Math.round(def.buff * 100)}% dmg</strong></div>`;
  if (def.isAura) statsHtml += `<div class="tower-stat-row"><span>Type</span><strong>Aura (DPS)</strong></div>`;

  panel.innerHTML = `
    <div class="tower-detail">
      <div class="tower-detail-header">
        <div class="tower-detail-icon">${def.emoji}</div>
        <div>
          <div class="tower-detail-name">${def.name}</div>
          <div class="tower-detail-level">💰 ${def.cost}</div>
        </div>
      </div>
      <div class="tower-desc">${def.desc}</div>
      <div class="tower-stats">${statsHtml}</div>
      <div style="font-size: 0.72rem; color: #666;">
        <strong>Upgrades:</strong><br>
        ${def.upgrades.map((u, i) => `Lv${i + 1}: ${u.label} (💰 ${u.cost})`).join('<br>')}
      </div>
    </div>
  `;
}

function updateInfoPanel() {
  if (G.selTower) {
    showPlacedTowerInfo(G.selTower);
  } else if (G.selType) {
    showTowerTypeInfo(G.selType);
  } else {
    document.getElementById('towerInfoContent').innerHTML = `
      <div class="info-placeholder">
        <p>🔊</p>
        <p>Select a tower from the shop or click a placed tower to see details.</p>
      </div>
    `;
  }
}

function showPlacedTowerInfo(tower) {
  const def = TOWER_DEFS[tower.type];
  const panel = document.getElementById('towerInfoContent');
  const effDmg = getEffectiveDamage(tower);

  let statsHtml = '';
  if (tower.damage > 0 || def.isAura) {
    statsHtml += `<div class="tower-stat-row"><span>Damage</span><strong>${tower.damage}${effDmg > tower.damage ? ` (${Math.floor(effDmg)})` : ''}</strong></div>`;
  }
  if (tower.atkSpd > 0) statsHtml += `<div class="tower-stat-row"><span>Attack Speed</span><strong>${tower.atkSpd.toFixed(2)}/s</strong></div>`;
  statsHtml += `<div class="tower-stat-row"><span>Range</span><strong>${tower.range}px</strong></div>`;
  if (tower.splash) statsHtml += `<div class="tower-stat-row"><span>Splash</span><strong>${tower.splash}px</strong></div>`;
  if (tower.slow) statsHtml += `<div class="tower-stat-row"><span>Slow</span><strong>${Math.round(tower.slow * 100)}%</strong></div>`;
  if (tower.chains) statsHtml += `<div class="tower-stat-row"><span>Chain</span><strong>${tower.chains} targets</strong></div>`;
  if (tower.buff) statsHtml += `<div class="tower-stat-row"><span>Buff</span><strong>+${Math.round(tower.buff * 100)}% dmg</strong></div>`;
  statsHtml += `<div class="tower-stat-row"><span>Kills</span><strong>${tower.kills}</strong></div>`;
  statsHtml += `<div class="tower-stat-row"><span>Dmg dealt</span><strong>${fmt(tower.damageDealt)}</strong></div>`;

  const canUpgrade = tower.level < 3;
  const upg = canUpgrade ? def.upgrades[tower.level] : null;
  const canAfford = upg && G.gold >= upg.cost;
  const refund = Math.floor(tower.totalInvested * 0.7);

  let upgradeHtml = '';
  if (canUpgrade && upg) {
    upgradeHtml = `<button class="upgrade-btn" id="upgBtn" ${canAfford ? '' : 'disabled'}>
      ⬆️ ${upg.label} (💰 ${upg.cost})
    </button>`;
  } else {
    upgradeHtml = `<button class="upgrade-btn" disabled>MAX LEVEL</button>`;
  }

  // Targeting buttons
  const targets = ['first', 'last', 'strong', 'near'];
  const targetLabels = { first: '1st', last: 'Last', strong: 'HP', near: 'Near' };

  const targetHtml = def.isSupport || def.isAura ? '' : `
    <div class="targeting-select">
      ${targets.map(t => `<button class="target-btn ${tower.targeting === t ? 'active' : ''}" data-target="${t}">${targetLabels[t]}</button>`).join('')}
    </div>
  `;

  panel.innerHTML = `
    <div class="tower-detail">
      <div class="tower-detail-header">
        <div class="tower-detail-icon">${def.emoji}</div>
        <div>
          <div class="tower-detail-name">${def.name}</div>
          <div class="tower-detail-level">Lv.${tower.level} ${tower.level >= 3 ? '⭐' : ''}</div>
        </div>
      </div>
      <div class="tower-stats">${statsHtml}</div>
      ${targetHtml}
      <div class="tower-actions">
        ${upgradeHtml}
        <button class="sell-btn" id="sellBtn">🗑️ Sell (💰 ${refund})</button>
      </div>
    </div>
  `;

  // Bind upgrade
  const upgBtn = document.getElementById('upgBtn');
  if (upgBtn) {
    upgBtn.addEventListener('click', () => {
      if (upgradeTower(tower)) {
        showPlacedTowerInfo(tower);
        updateUI();
      }
    });
  }

  // Bind sell
  document.getElementById('sellBtn').addEventListener('click', () => sellTower(tower));

  // Bind targeting
  panel.querySelectorAll('.target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tower.targeting = btn.dataset.target;
      showPlacedTowerInfo(tower);
    });
  });
}

function updateWaveInfo() {
  const container = document.getElementById('waveInfoContent');
  container.innerHTML = '';

  const start = Math.max(0, G.wave - 2);
  const end = Math.min(WAVES.length, G.wave + 5);

  for (let i = start; i < end; i++) {
    const w = WAVES[i];
    const waveNum = i + 1;
    const el = document.createElement('div');
    el.className = 'wave-info-item';
    if (waveNum === G.wave) el.classList.add('current');
    if (waveNum < G.wave) el.classList.add('completed');

    const enemyList = w.enemies.map(g => {
      const def = ENEMY_DEFS[g.t];
      return `${def ? def.emoji : '?'} ×${g.n}`;
    }).join(' ');

    const bossHtml = w.boss ? `<span class="boss-tag">👑 BOSS: ${BOSS_DEFS[w.boss].emoji} ${BOSS_DEFS[w.boss].name}</span>` : '';

    el.innerHTML = `
      <div class="wave-info-header">Wave ${waveNum} ${bossHtml}</div>
      <div class="wave-info-enemies">${enemyList}</div>
    `;
    container.appendChild(el);
  }

  if (G.wave >= WAVES.length) {
    const el = document.createElement('div');
    el.className = 'wave-info-item';
    el.innerHTML = `<div class="wave-info-header">♾️ Endless Mode</div>
      <div class="wave-info-enemies">Procedurally generated waves with scaling difficulty</div>`;
    container.appendChild(el);
  }
}

function showWaveButton() {
  const overlay = document.getElementById('waveOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('startWaveBtn').textContent = `▶ Start Wave ${G.wave + 1}`;
}

function hideWaveButton() {
  document.getElementById('waveOverlay').classList.add('hidden');
}

function announceWave(num, hasBoss) {
  const el = document.getElementById('waveAnnounce');
  const text = document.getElementById('waveAnnounceText');
  text.textContent = hasBoss ? `⚠️ Wave ${num} — BOSS ⚠️` : `Wave ${num}`;
  el.classList.remove('hidden');
  // Re-trigger animation
  el.style.animation = 'none';
  requestAnimationFrame(() => {
    el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 2500);
  });
}

function showBossWarning() {
  const el = document.getElementById('bossWarning');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ============= INPUT =============
function setupInput() {
  const canvas = G.canvas;

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('mousemove', e => {
    const pos = getCanvasPos(e);
    G.mouse.x = pos.x;
    G.mouse.y = pos.y;
    G.mouse.col = Math.floor(pos.x / TS);
    G.mouse.row = Math.floor(pos.y / TS);
  });

  canvas.addEventListener('mouseleave', () => {
    G.mouse.x = -1; G.mouse.y = -1;
    G.mouse.col = -1; G.mouse.row = -1;
  });

  canvas.addEventListener('click', e => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const col = Math.floor(pos.x / TS);
    const row = Math.floor(pos.y / TS);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    handleClick(col, row);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    G.mouse.x = pos.x;
    G.mouse.y = pos.y;
    G.mouse.col = Math.floor(pos.x / TS);
    G.mouse.row = Math.floor(pos.y / TS);
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const col = G.mouse.col;
    const row = G.mouse.row;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    handleClick(col, row);
  }, { passive: false });

  // Right click to deselect
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    G.selType = null;
    G.selTower = null;
    document.querySelectorAll('.tower-shop-item').forEach(el => el.classList.remove('selected'));
    updateInfoPanel();
  });
}

function handleClick(col, row) {
  if (G.state === 'gameover' || G.state === 'pre') return;
  const key = `${col},${row}`;

  // Placing a tower?
  if (G.selType) {
    if (PATH_SET.has(key) || G.occupied.has(key)) return;
    const def = TOWER_DEFS[G.selType];
    if (G.gold < def.cost) return;

    const tower = createTower(G.selType, col, row);
    G.towers.push(tower);
    G.occupied.add(key);
    G.gold -= def.cost;

    addFloat(tower.x, tower.y - 15, `-${def.cost}💰`, '#e74c3c');

    // Keep type selected for multi-place, deselect if can't afford another
    if (G.gold < def.cost) {
      G.selType = null;
      document.querySelectorAll('.tower-shop-item').forEach(el => el.classList.remove('selected'));
    }
    updateUI();
    return;
  }

  // Clicking on an existing tower?
  const clickedTower = G.towers.find(t => t.col === col && t.row === row);
  if (clickedTower) {
    G.selTower = clickedTower;
    updateInfoPanel();
    return;
  }

  // Click on empty space: deselect
  G.selTower = null;
  updateInfoPanel();
}

// ============= LEADERBOARD =============
async function loadLeaderboard() {
  const list = document.getElementById('tdLeaderboardList');
  list.innerHTML = '<div class="leaderboard-loading">Loading...</div>';
  try {
    const res = await fetch('/api/td-leaderboard');
    const data = await res.json();
    if (!data.ok || !data.leaderboard) throw new Error('Bad response');
    renderLeaderboard(data.leaderboard);
  } catch (e) {
    list.innerHTML = '<div class="leaderboard-loading">Could not load leaderboard</div>';
  }
}

function renderLeaderboard(entries) {
  const list = document.getElementById('tdLeaderboardList');
  if (entries.length === 0) {
    list.innerHTML = '<div class="leaderboard-loading">No scores yet — be the first!</div>';
    return;
  }
  list.innerHTML = entries.slice(0, 50).map((entry, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    return `<div class="lb-entry">
      <span class="lb-rank ${rankClass}">${medal}</span>
      <span class="lb-name">${escHtml(entry.name)}</span>
      <span class="lb-score">${fmt(entry.score)}</span>
      <span class="lb-wave">W${entry.wave || '?'}</span>
    </div>`;
  }).join('');
}

function escHtml(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}

async function submitScore(name) {
  if (!name || name.length < 1 || name.length > 20) return;
  localStorage.setItem('dogged-td-name', name);

  const ts = Date.now();
  const payload = {
    name, score: G.score, wave: G.wave, kills: G.kills,
    ts, pid: PID,
  };
  payload.sig = AC.sign(payload);

  const status = document.getElementById('goSubmitStatus');
  status.classList.remove('hidden', 'success', 'error');

  try {
    const res = await fetch('/api/td-leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      status.classList.add('success');
      status.textContent = `✅ Ranked #${data.rank} of ${data.total}!`;
      loadLeaderboard();
    } else {
      status.classList.add('error');
      status.textContent = `❌ ${data.error || 'Submission failed'}`;
    }
  } catch (e) {
    status.classList.add('error');
    status.textContent = '❌ Network error';
  }
}

// ============= MOBILE NAV =============
function setupMobileNav() {
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const panel = btn.dataset.panel;
      document.querySelector('.tower-shop').classList.toggle('mobile-show', panel === 'shop');
      document.querySelector('.info-panel').classList.toggle('mobile-show', panel === 'info');
    });
  });
}

// ============= INIT =============
function init() {
  G.canvas = document.getElementById('gameCanvas');
  G.ctx = G.canvas.getContext('2d');

  // Load Sigve image
  G.sigveImg = new Image();
  G.sigveImg.src = 'dogged-guy.jpg';

  setupInput();
  renderShop();
  updateUI();
  updateWaveInfo();
  setupMobileNav();

  // Tab switching
  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.info-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.info-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`itab-${tab.dataset.itab}`);
      if (target) target.classList.add('active');
      if (tab.dataset.itab === 'td-leaderboard') loadLeaderboard();
    });
  });

  // Speed controls
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      G.speed = parseInt(btn.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Start game button
  document.getElementById('startGameBtn').addEventListener('click', () => {
    document.getElementById('preOverlay').classList.add('hidden');
    G.state = 'idle';
    showWaveButton();
  });

  // Start wave button
  document.getElementById('startWaveBtn').addEventListener('click', () => {
    if (G.state !== 'idle') return;
    hideWaveButton();
    startWave();
  });

  // Game over buttons
  document.getElementById('goSubmitBtn').addEventListener('click', () => {
    const name = document.getElementById('goName').value.trim();
    submitScore(name);
  });

  document.getElementById('goRetryBtn').addEventListener('click', resetGame);

  // Refresh leaderboard
  document.getElementById('refreshTdLeaderboard').addEventListener('click', loadLeaderboard);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      G.selType = null;
      G.selTower = null;
      document.querySelectorAll('.tower-shop-item').forEach(el => el.classList.remove('selected'));
      updateInfoPanel();
    }
    if (e.key === ' ' && G.state === 'idle') {
      e.preventDefault();
      hideWaveButton();
      startWave();
    }
    // Number keys for tower selection
    const num = parseInt(e.key);
    if (num >= 1 && num <= 10) {
      const types = Object.keys(TOWER_DEFS);
      const idx = num === 10 ? 9 : num - 1;
      if (idx < types.length) {
        const type = types[idx];
        if (G.gold >= TOWER_DEFS[type].cost && G.state !== 'gameover' && G.state !== 'pre') {
          G.selType = G.selType === type ? null : type;
          G.selTower = null;
          document.querySelectorAll('.tower-shop-item').forEach(el =>
            el.classList.toggle('selected', el.dataset.type === G.selType));
          updateInfoPanel();
        }
      }
    }
    // Speed control
    if (e.key === ',') {
      G.speed = Math.max(1, G.speed - 1);
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.speed) === G.speed));
    }
    if (e.key === '.') {
      G.speed = Math.min(3, G.speed + 1);
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.speed) === G.speed));
    }
  });

  // Load leaderboard initially
  loadLeaderboard();

  // Start game loop
  G.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// Launch
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
