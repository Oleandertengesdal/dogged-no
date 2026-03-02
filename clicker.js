// ============================================================
// DOGGED CLICKER v2 — Full Idle Game Engine
// ============================================================

(() => {
'use strict';

// ===== ANTI-CHEAT =====
const AC = {
  SECRET: 'D0GG3D-S1GV3-2026',
  maxCPS: 35, // max clicks per second
  clickTimestamps: [],
  lastTickTime: 0,
  integrityWarnings: 0,

  // Rate limit clicks
  canClick() {
    const now = Date.now();
    this.clickTimestamps.push(now);
    // Keep only last 1 second of clicks
    this.clickTimestamps = this.clickTimestamps.filter(t => now - t < 1000);
    return this.clickTimestamps.length <= this.maxCPS;
  },

  // Simple hash for save integrity
  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h = ((h << 5) - h) + c;
      h |= 0;
    }
    return (h >>> 0).toString(36);
  },

  // Create checksum for save data
  checksum(data) {
    const core = `${data.totalEarned}|${data.totalClicks}|${data.prestigeLevel}|${this.SECRET}`;
    return this.hash(core);
  },

  // HMAC for leaderboard submission
  async hmac(data) {
    const msg = JSON.stringify({ name: data.name, score: data.score, prestige: data.prestige, ts: data.ts });
    // Simple client-side hash (server does real HMAC)
    return this.hash(msg + this.SECRET);
  },

  // Validate save data integrity
  validate(data) {
    if (!data || !data._checksum) return false;
    const expected = this.checksum(data);
    if (data._checksum !== expected) {
      this.integrityWarnings++;
      return this.integrityWarnings <= 3; // Allow a few mismatches (version upgrades etc)
    }
    return true;
  },

  // Validate numbers aren't ridiculous
  sanityCheck(game) {
    // Max theoretical DPS after long play with many prestiges
    const maxReasonableDPS = 1e18;
    if (game.dps > maxReasonableDPS) return false;
    if (game.doggeds < 0 || game.totalEarned < 0) return false;
    if (game.clickMultiplier > 1e10) return false;
    return true;
  }
};

// ===== GAME DATA =====

const BUILDINGS = [
  { id: 'echo',       name: "Sigve's Echo",       icon: '🗣️', desc: 'A whisper of "dogged" in the void',        baseCost: 15,           baseDps: 0.1    },
  { id: 'parrot',     name: 'Dogged Parrot',       icon: '🦜', desc: 'Only knows one word. Guess which.',        baseCost: 100,          baseDps: 1      },
  { id: 'groupchat',  name: 'Group Chat Bot',      icon: '💬', desc: 'Auto-spams dogged in every chat',          baseCost: 1100,         baseDps: 8      },
  { id: 'printer',    name: 'Dogged Printer',      icon: '🖨️', desc: 'Prints dogged on everything',              baseCost: 12000,        baseDps: 47     },
  { id: 'factory',    name: 'Dogged Factory',      icon: '🏭', desc: 'Mass-produces dogged merch',               baseCost: 130000,       baseDps: 260    },
  { id: 'university', name: 'Dogged University',   icon: '🎓', desc: 'PhD in Dogged Studies. Sigve is dean.',    baseCost: 1400000,      baseDps: 1400   },
  { id: 'satellite',  name: 'Dogged Satellite',    icon: '🛰️', desc: 'Broadcasts dogged planet-wide',            baseCost: 20000000,     baseDps: 7800   },
  { id: 'clonelab',   name: 'Sigve Clone Lab',     icon: '🧬', desc: 'Each clone says dogged independently',     baseCost: 330000000,    baseDps: 44000  },
  { id: 'dimension',  name: 'Dogged Dimension',    icon: '🌌', desc: 'An entire universe of dogged',             baseCost: 5.1e9,        baseDps: 260000 },
  { id: 'singularity',name: 'Dogged Singularity',  icon: '🕳️', desc: 'All reality is dogged',                    baseCost: 7.5e10,       baseDps: 1.6e6  },
  { id: 'hivemind',   name: 'Dogged Hivemind',     icon: '🤖', desc: 'AI network that only outputs dogged',      baseCost: 1e12,         baseDps: 1e7    },
  { id: 'godmode',    name: 'The Dogged Itself',   icon: '👁️', desc: 'You have become dogged incarnate',          baseCost: 1.5e13,       baseDps: 6.5e7  },
];

const COST_MULTIPLIER = 1.15;

// Upgrades: tiered per building + click upgrades + synergy + global
const UPGRADES = [
  // Click multipliers (increasingly expensive)
  { id: 'click1',  name: 'Stronger Finger',    icon: '👆',  desc: 'Clicks ×2',                  cost: 100,       type: 'click_mult', value: 2,  clicks: 1 },
  { id: 'click2',  name: 'Double Tap',         icon: '✌️',  desc: 'Clicks ×2',                  cost: 5000,      type: 'click_mult', value: 2,  clicks: 1 },
  { id: 'click3',  name: 'Power Slap',         icon: '🫲',  desc: 'Clicks ×3',                  cost: 50000,     type: 'click_mult', value: 3,  clicks: 3 },
  { id: 'click4',  name: 'Fist of Dogged',     icon: '👊',  desc: 'Clicks ×5',                  cost: 5e6,       type: 'click_mult', value: 5,  clicks: 5 },
  { id: 'click5',  name: 'Mind Click',         icon: '🧠',  desc: 'Clicks ×10',                 cost: 5e8,       type: 'click_mult', value: 10, clicks: 10 },
  { id: 'click6',  name: 'Dogged Telekinesis', icon: '🔮',  desc: 'Clicks ×25',                 cost: 5e11,      type: 'click_mult', value: 25, clicks: 15 },

  // Building tier upgrades (at 10, 25, 50, 100, 150, 200)
  ...generateBuildingUpgrades(),

  // Global multipliers
  { id: 'coffee',       name: "Sigve's Coffee",    icon: '☕', desc: 'All production +10%',    cost: 50000,     type: 'global_mult', value: 1.10, clicks: 1 },
  { id: 'energy',       name: 'Monster Dogged',    icon: '🥤', desc: 'All production +15%',    cost: 5e6,       type: 'global_mult', value: 1.15, clicks: 1 },
  { id: 'spirit',       name: 'Dogged Spirit',     icon: '✨', desc: 'All production +25%',    cost: 5e8,       type: 'global_mult', value: 1.25, clicks: 3 },
  { id: 'transcend',    name: 'Transcendence',     icon: '🌟', desc: 'All production +50%',    cost: 5e11,      type: 'global_mult', value: 1.50, clicks: 5 },
  { id: 'dogged_god',   name: 'Dogged God Mode',   icon: '⚡', desc: 'All production ×2',      cost: 5e13,      type: 'global_mult', value: 2.00, clicks: 10 },

  // Synergy upgrades
  { id: 'syn_echo_parrot',   name: 'Echo Chamber',     icon: '📣', desc: 'Echoes + Parrots synergy: both ×1.5',   cost: 2000,    type: 'synergy', buildings: ['echo', 'parrot'], value: 1.5, req: { buildings: { echo: 5, parrot: 5 } }, clicks: 1 },
  { id: 'syn_chat_printer',  name: 'Spam Infrastructure', icon: '🖥️', desc: 'Chat Bots + Printers synergy: both ×1.5', cost: 100000, type: 'synergy', buildings: ['groupchat', 'printer'], value: 1.5, req: { buildings: { groupchat: 10, printer: 10 } }, clicks: 2 },
  { id: 'syn_factory_uni',   name: 'Industrial Studies', icon: '📚', desc: 'Factory + Uni synergy: both ×2',       cost: 15e6,    type: 'synergy', buildings: ['factory', 'university'], value: 2, req: { buildings: { factory: 15, university: 15 } }, clicks: 3 },
  { id: 'syn_sat_clone',     name: 'Space Clones',       icon: '👽', desc: 'Satellites + Clones synergy: both ×2', cost: 5e9,     type: 'synergy', buildings: ['satellite', 'clonelab'], value: 2, req: { buildings: { satellite: 10, clonelab: 10 } }, clicks: 3 },
  { id: 'syn_dim_sing',      name: 'Reality Collapse',   icon: '💥', desc: 'Dimensions + Singularities: both ×3', cost: 5e12,    type: 'synergy', buildings: ['dimension', 'singularity'], value: 3, req: { buildings: { dimension: 5, singularity: 5 } }, clicks: 5 },
];

function generateBuildingUpgrades() {
  const tiers = [
    { count: 10,  mult: 2,  suffix: 'I',   clicksNeeded: 1 },
    { count: 25,  mult: 2,  suffix: 'II',  clicksNeeded: 2 },
    { count: 50,  mult: 2,  suffix: 'III', clicksNeeded: 3 },
    { count: 100, mult: 3,  suffix: 'IV',  clicksNeeded: 5 },
    { count: 150, mult: 3,  suffix: 'V',   clicksNeeded: 7 },
    { count: 200, mult: 5,  suffix: 'VI',  clicksNeeded: 10 },
  ];

  const results = [];
  for (const b of BUILDINGS) {
    for (const tier of tiers) {
      const costMult = Math.pow(COST_MULTIPLIER, tier.count) * b.baseCost * 5;
      results.push({
        id: `${b.id}_t${tier.count}`,
        name: `${b.name} ${tier.suffix}`,
        icon: b.icon,
        desc: `${b.name} production ×${tier.mult} (need ${tier.count})`,
        cost: Math.floor(costMult),
        type: 'building_mult',
        building: b.id,
        value: tier.mult,
        req: { building: b.id, count: tier.count },
        clicks: tier.clicksNeeded,
      });
    }
  }
  return results;
}

// Prestige upgrades (bought with souls)
const PRESTIGE_UPGRADES = [
  { id: 'p_click1',     name: 'Soulful Click',     icon: '💀👆', desc: 'Start with ×2 click power after ascension', cost: 1,   effect: 'start_click_mult', value: 2 },
  { id: 'p_click2',     name: 'Ghost Click',        icon: '👻👆', desc: 'Start with ×5 click power after ascension', cost: 5,   effect: 'start_click_mult', value: 5 },
  { id: 'p_cheapBuild', name: 'Soul Discount',      icon: '💀🏷️', desc: 'All buildings cost 10% less',              cost: 3,   effect: 'building_discount', value: 0.90 },
  { id: 'p_cheapBuild2',name: 'Deep Discount',      icon: '💀💰', desc: 'All buildings cost 20% less',              cost: 10,  effect: 'building_discount', value: 0.80 },
  { id: 'p_golden1',    name: 'Lucky Dogged',       icon: '🍀',    desc: 'Golden doggeds appear 2× more often',     cost: 5,   effect: 'golden_freq', value: 2 },
  { id: 'p_golden2',    name: 'Golden Magnet',      icon: '🧲',    desc: 'Golden doggeds give 3× reward',           cost: 10,  effect: 'golden_mult', value: 3 },
  { id: 'p_golden3',    name: 'Golden Age',         icon: '👑',    desc: 'Golden doggeds last 2× longer',           cost: 8,   effect: 'golden_duration', value: 2 },
  { id: 'p_offline',    name: 'Dream Doggeds',      icon: '💤',    desc: 'Earn 50% production while offline',       cost: 15,  effect: 'offline_mult', value: 0.5 },
  { id: 'p_offline2',   name: 'Sleepwalking Sigve', icon: '🌙',    desc: 'Earn 100% production while offline',      cost: 50,  effect: 'offline_mult', value: 1.0 },
  { id: 'p_combo',      name: 'Combo Master',       icon: '🔥',    desc: 'Click combos give 2× bonus',             cost: 8,   effect: 'combo_mult', value: 2 },
  { id: 'p_soul_boost', name: 'Soul Harvester',     icon: '⚡💀',  desc: 'Earn 50% more souls on ascension',       cost: 25,  effect: 'soul_bonus', value: 1.5 },
  { id: 'p_soul_boost2',name: 'Supreme Harvester',  icon: '🔥💀',  desc: 'Earn 100% more souls on ascension',      cost: 75,  effect: 'soul_bonus', value: 2.0 },
  { id: 'p_start_dps',  name: 'Head Start',         icon: '🚀',    desc: 'Start each run with 10 of first building',cost: 20,  effect: 'start_buildings', value: 10 },
  { id: 'p_crit',       name: 'Critical Dogged',    icon: '💥',    desc: '5% chance for 10× click',                 cost: 15,  effect: 'crit_chance', value: 0.05 },
  { id: 'p_crit2',      name: 'Super Critical',     icon: '🌋',    desc: '10% chance for 25× click',                cost: 50,  effect: 'crit_chance', value: 0.10 },
];

// Achievements
const ACHIEVEMENTS = [
  { id: 'click1',     name: 'First!',            icon: '👶', desc: '1 click',                    check: g => g.totalClicks >= 1 },
  { id: 'click100',   name: 'Clicker',           icon: '👆', desc: '100 clicks',                  check: g => g.totalClicks >= 100 },
  { id: 'click1k',    name: 'Carpal Tunnel',     icon: '🤕', desc: '1,000 clicks',                check: g => g.totalClicks >= 1000 },
  { id: 'click10k',   name: 'Finger Destroyer',  icon: '💀', desc: '10,000 clicks',               check: g => g.totalClicks >= 10000 },
  { id: 'click100k',  name: 'Machine Gun',       icon: '🔫', desc: '100,000 clicks',              check: g => g.totalClicks >= 100000 },
  { id: 'earn100',    name: 'Starter',            icon: '🌱', desc: 'Earn 100 doggeds',           check: g => g.totalEarned >= 100 },
  { id: 'earn1k',     name: 'Getting There',      icon: '📈', desc: 'Earn 1K doggeds',            check: g => g.totalEarned >= 1000 },
  { id: 'earn1m',     name: 'Mega Dogged',        icon: '🚀', desc: 'Earn 1M doggeds',            check: g => g.totalEarned >= 1e6 },
  { id: 'earn1b',     name: 'Giga Dogged',        icon: '🌍', desc: 'Earn 1B doggeds',            check: g => g.totalEarned >= 1e9 },
  { id: 'earn1t',     name: 'Tera Dogged',        icon: '🌌', desc: 'Earn 1T doggeds',            check: g => g.totalEarned >= 1e12 },
  { id: 'earn1q',     name: 'Quadrillion Dogged', icon: '🕳️', desc: 'Earn 1Q doggeds',           check: g => g.totalEarned >= 1e15 },
  { id: 'build1',     name: 'Investor',            icon: '📈', desc: 'Buy first building',        check: g => getTotalBuildings(g) >= 1 },
  { id: 'build50',    name: 'Tycoon',              icon: '🏢', desc: 'Own 50 buildings',           check: g => getTotalBuildings(g) >= 50 },
  { id: 'build100',   name: 'Empire',              icon: '👑', desc: 'Own 100 buildings',          check: g => getTotalBuildings(g) >= 100 },
  { id: 'build500',   name: 'Dogged Dynasty',      icon: '🏰', desc: 'Own 500 buildings',          check: g => getTotalBuildings(g) >= 500 },
  { id: 'dps100',     name: 'Passive Income',      icon: '💤', desc: '100/s',                      check: g => g.dps >= 100 },
  { id: 'dps10k',     name: 'Dogged Machine',      icon: '⚙️', desc: '10K/s',                     check: g => g.dps >= 10000 },
  { id: 'dps1m',      name: 'Unstoppable',         icon: '🔥', desc: '1M/s',                       check: g => g.dps >= 1e6 },
  { id: 'dps1b',      name: 'Dogged Overload',     icon: '💥', desc: '1B/s',                       check: g => g.dps >= 1e9 },
  { id: 'prestige1',  name: 'Ascended',            icon: '⭐', desc: 'Prestige for the first time', check: g => g.prestigeLevel >= 1 },
  { id: 'prestige5',  name: 'Veteran',             icon: '🎖️', desc: 'Prestige 5 times',          check: g => g.prestigeLevel >= 5 },
  { id: 'prestige10', name: 'Eternal Dogged',      icon: '♾️', desc: 'Prestige 10 times',          check: g => g.prestigeLevel >= 10 },
  { id: 'prestige25', name: 'Dogged God',          icon: '🙏', desc: 'Prestige 25 times',          check: g => g.prestigeLevel >= 25 },
  { id: 'golden1',    name: 'Lucky!',              icon: '🍀', desc: 'Catch a golden dogged',      check: g => g.goldensCaught >= 1 },
  { id: 'golden10',   name: 'Golden Hunter',       icon: '🏹', desc: 'Catch 10 golden doggeds',    check: g => g.goldensCaught >= 10 },
  { id: 'golden50',   name: 'Midas Touch',         icon: '✨', desc: 'Catch 50 golden doggeds',    check: g => g.goldensCaught >= 50 },
  { id: 'combo25',    name: 'Combo Starter',       icon: '🔥', desc: '25× click combo',            check: g => g.maxCombo >= 25 },
  { id: 'combo100',   name: 'Combo King',          icon: '👑', desc: '100× click combo',           check: g => g.maxCombo >= 100 },
  { id: 'combo500',   name: 'Combo Legend',        icon: '🏆', desc: '500× click combo',           check: g => g.maxCombo >= 500 },
  { id: 'allbuilds',  name: 'Collector',           icon: '🎯', desc: 'Own 1 of every building',   check: g => BUILDINGS.every(b => (g.buildings[b.id]?.count || 0) >= 1) },
  { id: 'souls100',   name: 'Soul Collector',      icon: '💀', desc: 'Earn 100 total souls',       check: g => g.totalSoulsEarned >= 100 },
  { id: 'souls1k',    name: 'Soul Lord',           icon: '☠️', desc: 'Earn 1000 total souls',     check: g => g.totalSoulsEarned >= 1000 },
];

const CLICK_QUOTES = [
  '"dogged"', '"that\'s dogged"', '"so dogged bro"', '"absolutely dogged"',
  '"mega dogged"', '"pure dogged energy"', '"dogged moment"',
  '"dogged af"', '"lowkey dogged"', '"highkey dogged"',
  '"certified dogged"', '"dogged is a lifestyle"',
  '"why say many word when dogged do trick"',
  '"I\'m not addicted. That\'s a dogged accusation."',
  '"My therapist asked me to stop. I said that\'s dogged."',
  '*clears throat* "dogged"', '"everything is dogged if you believe"',
  '"Dog City represent 🐶"', '"Vadsø? You mean Dog City."',
  '"dogged? dogged."',
];

// ===== GAME STATE =====
const game = {
  doggeds: 0,
  totalEarned: 0,
  totalEarnedThisRun: 0,
  totalClicks: 0,
  clickPower: 1,
  clickMultiplier: 1,
  dps: 0,
  buildings: {},
  upgrades: {},         // { id: true }
  upgradeProgress: {},  // { id: clicksSoFar } for multi-click
  achievements: {},
  prestigeLevel: 0,
  souls: 0,
  totalSoulsEarned: 0,
  prestigeUpgrades: {},
  goldensCaught: 0,
  maxCombo: 0,
  combo: 0,
  comboTimer: null,
  startTime: Date.now(),
  lastSave: Date.now(),
  lastTick: Date.now(),
  buyAmount: 1, // 1, 10, 25, 'max'
};

// ===== DOM CACHE =====
const $ = id => document.getElementById(id);
const DOM = {};
function cacheDom() {
  const ids = [
    'doggedCount', 'dpsDisplay', 'clickPowerDisplay', 'bigClicker', 'clickRing',
    'sigveQuote', 'buildingsContainer', 'upgradesContainer', 'achievementsContainer',
    'prestigeUpgradesContainer', 'statTotalEarned', 'statThisRun', 'statTotalClicks',
    'statPerClick', 'statPerSecond', 'statBuildings', 'statPrestige', 'statSouls',
    'statTotalSouls', 'statMaxCombo', 'statGoldens', 'statTimePlayed',
    'saveBtn', 'exportBtn', 'importBtn', 'resetBtn', 'particles',
    'prestigeSection', 'prestigeSoulsPreview', 'prestigeBtn',
    'prestigeModal', 'modalSouls', 'confirmPrestige', 'cancelPrestige',
    'importModal', 'importTextarea', 'confirmImport', 'cancelImport',
    'goldenDogged', 'prestigeBadge', 'soulsDisplay', 'soulsBalance',
    'multDisplay', 'comboDisplay', 'achievementProgress',
    'playerName', 'submitScoreBtn', 'leaderboardList', 'refreshLeaderboard',
    'shopPanel', 'statsPanel', 'clickerArea',
  ];
  ids.forEach(id => { DOM[id] = $(id); });
}

// ===== HELPERS =====
function formatNumber(n) {
  if (n === Infinity) return '∞';
  if (n < 0) return '-' + formatNumber(-n);
  if (n < 1000) return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
  const suffixes = [
    { v: 1e18, s: 'Qi' }, { v: 1e15, s: 'Q' }, { v: 1e12, s: 'T' },
    { v: 1e9, s: 'B' }, { v: 1e6, s: 'M' }, { v: 1e3, s: 'K' },
  ];
  for (const { v, s } of suffixes) {
    if (n >= v) return (n / v).toFixed(n >= v * 10 ? 1 : 2) + s;
  }
  return Math.floor(n).toLocaleString();
}

function getTotalBuildings(g) {
  return Object.values(g.buildings).reduce((s, b) => s + (b.count || 0), 0);
}

// ===== PRESTIGE HELPERS =====
function getPrestigeEffect(effectType) {
  let value = effectType === 'building_discount' ? 1 :
              effectType === 'soul_bonus' ? 1 :
              effectType === 'golden_freq' ? 1 :
              effectType === 'golden_mult' ? 1 :
              effectType === 'golden_duration' ? 1 :
              effectType === 'offline_mult' ? 0.1 : // base 10% offline
              effectType === 'combo_mult' ? 1 :
              effectType === 'crit_chance' ? 0 :
              effectType === 'start_click_mult' ? 1 :
              effectType === 'start_buildings' ? 0 :
              0;

  for (const pu of PRESTIGE_UPGRADES) {
    if (game.prestigeUpgrades[pu.id] && pu.effect === effectType) {
      if (effectType === 'building_discount') value *= pu.value;
      else if (effectType === 'soul_bonus') value = Math.max(value, pu.value);
      else if (effectType === 'crit_chance') value = Math.max(value, pu.value);
      else if (effectType === 'offline_mult') value = Math.max(value, pu.value);
      else if (effectType === 'start_click_mult') value *= pu.value;
      else if (effectType === 'start_buildings') value += pu.value;
      else value *= pu.value;
    }
  }
  return value;
}

function getSoulsForCurrentRun() {
  // Souls = floor(sqrt(totalEarnedThisRun / 1e9))
  const base = Math.floor(Math.pow(game.totalEarnedThisRun / 1e9, 0.5));
  const soulBonus = getPrestigeEffect('soul_bonus');
  return Math.floor(base * soulBonus);
}

function getSoulBoostMultiplier() {
  return 1 + (game.souls * 0.05); // +5% per soul
}

// ===== COST CALCULATIONS =====
function getBuildingCost(buildingData, amount = 1) {
  const count = game.buildings[buildingData.id]?.count || 0;
  const discount = getPrestigeEffect('building_discount');
  let total = 0;
  for (let i = 0; i < amount; i++) {
    total += Math.floor(buildingData.baseCost * Math.pow(COST_MULTIPLIER, count + i) * discount);
  }
  return total;
}

function getMaxAffordable(buildingData) {
  const count = game.buildings[buildingData.id]?.count || 0;
  const discount = getPrestigeEffect('building_discount');
  let total = 0;
  let n = 0;
  while (true) {
    const next = Math.floor(buildingData.baseCost * Math.pow(COST_MULTIPLIER, count + n) * discount);
    if (total + next > game.doggeds) break;
    total += next;
    n++;
    if (n > 1000) break; // safety
  }
  return Math.max(n, 0);
}

function getEffectiveBuyAmount(buildingData) {
  if (game.buyAmount === 'max') return getMaxAffordable(buildingData);
  return Math.min(game.buyAmount, getMaxAffordable(buildingData) || game.buyAmount);
}

// ===== CLICK VALUE =====
function getClickValue() {
  let base = game.clickPower * game.clickMultiplier;

  // Combo bonus: +1% per combo, capped at 100%
  const comboMult = getPrestigeEffect('combo_mult');
  const comboBonus = 1 + (Math.min(game.combo, 500) * 0.01 * comboMult);
  base *= comboBonus;

  // Critical hit
  const critChance = getPrestigeEffect('crit_chance');
  let isCrit = false;
  if (critChance > 0 && Math.random() < critChance) {
    base *= (critChance >= 0.10 ? 25 : 10);
    isCrit = true;
  }

  return { value: base, isCrit };
}

// ===== DPS RECALCULATION =====
function recalculateDps() {
  let globalMult = 1;

  // Global upgrade multipliers
  for (const u of UPGRADES) {
    if (u.type === 'global_mult' && game.upgrades[u.id]) {
      globalMult *= u.value;
    }
  }

  // Soul boost
  globalMult *= getSoulBoostMultiplier();

  let total = 0;
  for (const b of BUILDINGS) {
    const state = game.buildings[b.id];
    if (!state || state.count === 0) continue;
    total += b.baseDps * state.count * state.multiplier;
  }

  game.dps = total * globalMult;
}

// ===== TOAST =====
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== CLICK HANDLER =====
function handleClick(e) {
  if (!AC.canClick()) return; // Rate limited

  const { value, isCrit } = getClickValue();
  game.doggeds += value;
  game.totalEarned += value;
  game.totalEarnedThisRun += value;
  game.totalClicks++;

  // Combo
  game.combo++;
  if (game.combo > game.maxCombo) game.maxCombo = game.combo;
  clearTimeout(game.comboTimer);
  game.comboTimer = setTimeout(() => { game.combo = 0; }, 1500);

  // Visual feedback
  DOM.bigClicker.classList.remove('clicked');
  void DOM.bigClicker.offsetWidth;
  DOM.bigClicker.classList.add('clicked');

  DOM.clickRing.classList.remove('active');
  void DOM.clickRing.offsetWidth;
  DOM.clickRing.classList.add('active');

  DOM.doggedCount.classList.add('bump');
  setTimeout(() => DOM.doggedCount.classList.remove('bump'), 80);

  spawnClickFloat(e, value, isCrit);

  // Quote (5% chance)
  if (Math.random() < 0.05) {
    DOM.sigveQuote.textContent = CLICK_QUOTES[Math.floor(Math.random() * CLICK_QUOTES.length)];
    DOM.sigveQuote.style.opacity = 1;
    setTimeout(() => { DOM.sigveQuote.style.opacity = 0; }, 2000);
  }

  updateDisplay();
  checkAchievements();
}

function spawnClickFloat(e, value, isCrit) {
  const float = document.createElement('div');
  float.className = 'click-float' + (isCrit ? ' crit' : '');
  float.textContent = (isCrit ? '💥 ' : '+') + formatNumber(value);

  const rect = DOM.bigClicker.getBoundingClientRect();
  const cx = e.clientX || (rect.left + rect.width / 2);
  const cy = e.clientY || (rect.top + rect.height / 4);
  float.style.left = (cx + (Math.random() - 0.5) * 60) + 'px';
  float.style.top = (cy - 10) + 'px';

  document.body.appendChild(float);
  setTimeout(() => float.remove(), isCrit ? 1000 : 800);
}

// ===== BUY BUILDING =====
function buyBuilding(buildingData) {
  let amount = getEffectiveBuyAmount(buildingData);
  if (amount <= 0) return;
  if (game.buyAmount !== 'max') amount = Math.min(amount, typeof game.buyAmount === 'number' ? game.buyAmount : 1);

  const cost = getBuildingCost(buildingData, amount);
  if (game.doggeds < cost) return;

  game.doggeds -= cost;

  if (!game.buildings[buildingData.id]) {
    game.buildings[buildingData.id] = { count: 0, multiplier: 1 };
  }
  game.buildings[buildingData.id].count += amount;

  recalculateDps();
  renderShop();
  updateDisplay();
  checkAchievements();

  showToast(`+${amount} ${buildingData.name} (${game.buildings[buildingData.id].count})`);
}

// ===== BUY UPGRADE (multi-click) =====
function clickUpgrade(upgradeData) {
  if (game.upgrades[upgradeData.id]) return;
  if (game.doggeds < upgradeData.cost) return;

  // Check requirements
  if (upgradeData.req) {
    if (upgradeData.req.building) {
      const count = game.buildings[upgradeData.req.building]?.count || 0;
      if (count < upgradeData.req.count) return;
    }
    if (upgradeData.req.buildings) {
      for (const [bid, needed] of Object.entries(upgradeData.req.buildings)) {
        if ((game.buildings[bid]?.count || 0) < needed) return;
      }
    }
  }

  const clicksNeeded = upgradeData.clicks || 1;

  if (clicksNeeded <= 1) {
    purchaseUpgrade(upgradeData);
    return;
  }

  // Multi-click: increment progress
  if (!game.upgradeProgress[upgradeData.id]) {
    game.upgradeProgress[upgradeData.id] = 0;
  }
  game.upgradeProgress[upgradeData.id]++;

  if (game.upgradeProgress[upgradeData.id] >= clicksNeeded) {
    purchaseUpgrade(upgradeData);
    delete game.upgradeProgress[upgradeData.id];
  } else {
    showToast(`${upgradeData.name}: ${game.upgradeProgress[upgradeData.id]}/${clicksNeeded} clicks`);
    renderShop();
  }
}

function purchaseUpgrade(upgradeData) {
  game.doggeds -= upgradeData.cost;
  game.upgrades[upgradeData.id] = true;

  if (upgradeData.type === 'click_mult') {
    game.clickMultiplier *= upgradeData.value;
  } else if (upgradeData.type === 'building_mult') {
    if (!game.buildings[upgradeData.building]) {
      game.buildings[upgradeData.building] = { count: 0, multiplier: 1 };
    }
    game.buildings[upgradeData.building].multiplier *= upgradeData.value;
  } else if (upgradeData.type === 'synergy') {
    for (const bid of upgradeData.buildings) {
      if (!game.buildings[bid]) game.buildings[bid] = { count: 0, multiplier: 1 };
      game.buildings[bid].multiplier *= upgradeData.value;
    }
  }
  // global_mult applied in recalculateDps

  recalculateDps();
  renderShop();
  updateDisplay();
  checkAchievements();

  showToast(`✅ ${upgradeData.name}!`);
}

// ===== BUY PRESTIGE UPGRADE =====
function buyPrestigeUpgrade(pu) {
  if (game.prestigeUpgrades[pu.id]) return;
  if (game.souls < pu.cost) return;

  game.souls -= pu.cost;
  game.prestigeUpgrades[pu.id] = true;

  recalculateDps();
  renderShop();
  updateDisplay();

  showToast(`💀 ${pu.name} unlocked!`);
}

// ===== PRESTIGE (ASCENSION) =====
function showPrestigeModal() {
  const souls = getSoulsForCurrentRun();
  if (souls < 1) {
    showToast('Need at least 1B total earned to ascend!');
    return;
  }
  DOM.modalSouls.textContent = formatNumber(souls);
  DOM.prestigeModal.classList.remove('hidden');
}

function doPrestige() {
  const souls = getSoulsForCurrentRun();
  if (souls < 1) return;

  game.souls += souls;
  game.totalSoulsEarned += souls;
  game.prestigeLevel++;

  // Reset run-specific state
  game.doggeds = 0;
  game.totalEarnedThisRun = 0;
  game.buildings = {};
  game.upgrades = {};
  game.upgradeProgress = {};
  game.clickPower = 1;
  game.clickMultiplier = getPrestigeEffect('start_click_mult');
  game.combo = 0;

  // Apply start buildings prestige effect
  const startBuildings = getPrestigeEffect('start_buildings');
  if (startBuildings > 0) {
    game.buildings['echo'] = { count: startBuildings, multiplier: 1 };
  }

  recalculateDps();

  DOM.prestigeModal.classList.add('hidden');

  saveGame();
  renderShop();
  renderAchievements();
  updateDisplay();

  showToast(`⭐ Ascended! +${souls} souls (Level ${game.prestigeLevel})`);
}

// ===== GOLDEN DOGGED =====
let goldenTimeout = null;

function scheduleGolden() {
  const freqMult = getPrestigeEffect('golden_freq');
  // Base: 2-5 minutes
  const minDelay = 120000 / freqMult;
  const maxDelay = 300000 / freqMult;
  const delay = minDelay + Math.random() * (maxDelay - minDelay);

  goldenTimeout = setTimeout(spawnGoldenDogged, delay);
}

function spawnGoldenDogged() {
  const el = DOM.goldenDogged;
  el.classList.remove('hidden');

  // Random position
  const x = 100 + Math.random() * (window.innerWidth - 200);
  const y = 100 + Math.random() * (window.innerHeight - 200);
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  // Auto-hide after duration
  const durMult = getPrestigeEffect('golden_duration');
  const duration = 10000 * durMult;

  const hideTimer = setTimeout(() => {
    el.classList.add('hidden');
    scheduleGolden();
  }, duration);

  // Click handler
  const clickHandler = () => {
    el.classList.add('hidden');
    clearTimeout(hideTimer);
    collectGolden();
    el.removeEventListener('click', clickHandler);
    scheduleGolden();
  };

  el.addEventListener('click', clickHandler, { once: true });
}

function collectGolden() {
  game.goldensCaught++;
  const rewardMult = getPrestigeEffect('golden_mult');

  // Random reward type
  const roll = Math.random();
  let reward;

  if (roll < 0.5) {
    // Dogged rain: earn X seconds of production
    const seconds = 30 + Math.random() * 270; // 30-300 seconds
    const amount = game.dps * seconds * rewardMult;
    game.doggeds += amount;
    game.totalEarned += amount;
    game.totalEarnedThisRun += amount;
    reward = `🌧️ Dogged Rain! +${formatNumber(amount)} doggeds`;
  } else if (roll < 0.8) {
    // Click frenzy: massive click bonus for a bit
    const amount = getClickValue().value * 777 * rewardMult;
    game.doggeds += amount;
    game.totalEarned += amount;
    game.totalEarnedThisRun += amount;
    reward = `👆 Click Frenzy! +${formatNumber(amount)} doggeds`;
  } else {
    // Lucky: flat bonus based on total earned
    const amount = game.totalEarnedThisRun * 0.05 * rewardMult;
    game.doggeds += amount;
    game.totalEarned += amount;
    game.totalEarnedThisRun += amount;
    reward = `🍀 Lucky! +${formatNumber(amount)} doggeds`;
  }

  showToast(`✨ Golden Dogged: ${reward}`);
  updateDisplay();
  checkAchievements();
}

// ===== RENDER SHOP =====
function renderShop() {
  renderBuildings();
  renderUpgrades();
  renderPrestigeShop();
}

function renderBuildings() {
  const c = DOM.buildingsContainer;
  if (!c) return;
  c.innerHTML = '';

  for (const b of BUILDINGS) {
    const amount = game.buyAmount === 'max' ? getMaxAffordable(b) : (typeof game.buyAmount === 'number' ? game.buyAmount : 1);
    const actualAmount = game.buyAmount === 'max' ? amount : amount;
    const cost = getBuildingCost(b, Math.max(actualAmount, 1));
    const count = game.buildings[b.id]?.count || 0;
    const canAfford = game.doggeds >= cost && (game.buyAmount === 'max' ? amount > 0 : true);
    const dpsEach = b.baseDps * (game.buildings[b.id]?.multiplier || 1);

    const el = document.createElement('div');
    el.className = `shop-item ${canAfford ? '' : 'cannot-afford'}`;
    el.innerHTML = `
      <div class="shop-item-icon">${b.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${b.name}</div>
        <div class="shop-item-desc">${b.desc}</div>
        <div class="shop-item-cost">🐶 ${formatNumber(cost)}${actualAmount > 1 ? ` (×${actualAmount})` : ''} · +${formatNumber(dpsEach)}/s</div>
      </div>
      <div class="shop-item-count">${count}</div>
    `;
    el.addEventListener('click', () => buyBuilding(b));
    c.appendChild(el);
  }
}

function renderUpgrades() {
  const c = DOM.upgradesContainer;
  if (!c) return;
  c.innerHTML = '';

  let visible = 0;
  for (const u of UPGRADES) {
    if (game.upgrades[u.id]) continue;

    // Check requirements visibility
    if (u.req) {
      if (u.req.building) {
        const count = game.buildings[u.req.building]?.count || 0;
        if (count < u.req.count) continue;
      }
      if (u.req.buildings) {
        let met = true;
        for (const [bid, needed] of Object.entries(u.req.buildings)) {
          if ((game.buildings[bid]?.count || 0) < needed) { met = false; break; }
        }
        if (!met) continue;
      }
    }

    const canAfford = game.doggeds >= u.cost;
    const clicks = u.clicks || 1;
    const progress = game.upgradeProgress[u.id] || 0;
    const progressPct = clicks > 1 ? (progress / clicks * 100) : 0;

    const el = document.createElement('div');
    el.className = `shop-item ${canAfford ? '' : 'cannot-afford'}`;
    el.innerHTML = `
      <div class="shop-item-icon">${u.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${u.name}${clicks > 1 ? ` <span style="color:#666;font-size:0.65rem">[${progress}/${clicks}]</span>` : ''}</div>
        <div class="shop-item-desc">${u.desc}</div>
        <div class="shop-item-cost">🐶 ${formatNumber(u.cost)}</div>
      </div>
      ${clicks > 1 ? `<div class="upgrade-progress" style="width:${progressPct}%"></div>` : ''}
    `;
    el.addEventListener('click', () => clickUpgrade(u));
    c.appendChild(el);
    visible++;
  }

  if (visible === 0) {
    c.innerHTML = '<div style="color:#444;font-size:0.8rem;padding:1rem;text-align:center;">No upgrades available. Keep building!</div>';
  }
}

function renderPrestigeShop() {
  const c = DOM.prestigeUpgradesContainer;
  if (!c) return;
  c.innerHTML = '';

  DOM.soulsBalance.textContent = formatNumber(game.souls);

  for (const pu of PRESTIGE_UPGRADES) {
    const owned = game.prestigeUpgrades[pu.id];
    const canAfford = game.souls >= pu.cost;

    const el = document.createElement('div');
    el.className = `shop-item prestige-item ${owned ? 'purchased' : (canAfford ? '' : 'cannot-afford')}`;
    el.innerHTML = `
      <div class="shop-item-icon">${pu.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${pu.name}${owned ? ' ✅' : ''}</div>
        <div class="shop-item-desc">${pu.desc}</div>
        <div class="shop-item-cost">${owned ? 'Owned' : `💀 ${pu.cost}`}</div>
      </div>
    `;
    if (!owned) el.addEventListener('click', () => buyPrestigeUpgrade(pu));
    c.appendChild(el);
  }
}

// ===== RENDER ACHIEVEMENTS =====
function renderAchievements() {
  const c = DOM.achievementsContainer;
  if (!c) return;
  c.innerHTML = '';

  let unlocked = 0;
  for (const a of ACHIEVEMENTS) {
    const isUnlocked = game.achievements[a.id] || false;
    if (isUnlocked) unlocked++;

    const el = document.createElement('div');
    el.className = `achievement ${isUnlocked ? 'unlocked' : ''}`;
    el.innerHTML = `
      <div class="achievement-icon">${isUnlocked ? a.icon : '🔒'}</div>
      <div class="achievement-info">
        <div class="achievement-name">${isUnlocked ? a.name : '???'}</div>
        <div class="achievement-desc">${isUnlocked ? a.desc : 'Keep playing...'}</div>
      </div>
    `;
    c.appendChild(el);
  }

  DOM.achievementProgress.textContent = `${unlocked}/${ACHIEVEMENTS.length}`;
}

function checkAchievements() {
  let newUnlock = false;
  for (const a of ACHIEVEMENTS) {
    if (!game.achievements[a.id] && a.check(game)) {
      game.achievements[a.id] = true;
      newUnlock = true;
      showToast(`🏆 ${a.name}!`);
    }
  }
  if (newUnlock) renderAchievements();
}

// ===== UPDATE DISPLAY =====
function updateDisplay() {
  DOM.doggedCount.textContent = formatNumber(game.doggeds);
  DOM.dpsDisplay.textContent = formatNumber(game.dps);
  DOM.clickPowerDisplay.textContent = formatNumber(getClickValue().value);

  // Multiplier display
  const totalMult = getSoulBoostMultiplier();
  DOM.multDisplay.textContent = `×${totalMult.toFixed(2)}`;
  DOM.comboDisplay.textContent = `🔥 ${game.combo}`;

  // Top bar
  DOM.prestigeBadge.textContent = `⭐ ${game.prestigeLevel}`;
  DOM.soulsDisplay.textContent = `💀 ${formatNumber(game.souls)}`;

  // Stats
  DOM.statTotalEarned.textContent = formatNumber(game.totalEarned);
  DOM.statThisRun.textContent = formatNumber(game.totalEarnedThisRun);
  DOM.statTotalClicks.textContent = formatNumber(game.totalClicks);
  DOM.statPerClick.textContent = formatNumber(getClickValue().value);
  DOM.statPerSecond.textContent = formatNumber(game.dps);
  DOM.statBuildings.textContent = getTotalBuildings(game);
  DOM.statPrestige.textContent = game.prestigeLevel;
  DOM.statSouls.textContent = formatNumber(game.souls);
  DOM.statTotalSouls.textContent = formatNumber(game.totalSoulsEarned);
  DOM.statMaxCombo.textContent = game.maxCombo;
  DOM.statGoldens.textContent = game.goldensCaught;

  const seconds = Math.floor((Date.now() - game.startTime) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  DOM.statTimePlayed.textContent = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  // Prestige section visibility
  const potentialSouls = getSoulsForCurrentRun();
  if (potentialSouls >= 1) {
    DOM.prestigeSection.classList.remove('hidden');
    DOM.prestigeSoulsPreview.textContent = formatNumber(potentialSouls);
  } else {
    DOM.prestigeSection.classList.add('hidden');
  }
}

// ===== GAME LOOP =====
let shopRenderCounter = 0;

function gameTick() {
  const now = Date.now();
  const delta = (now - game.lastTick) / 1000;
  game.lastTick = now;

  // Safety: max 60s catch-up per tick
  const safeDelta = Math.min(delta, 60);

  if (game.dps > 0) {
    const earned = game.dps * safeDelta;
    game.doggeds += earned;
    game.totalEarned += earned;
    game.totalEarnedThisRun += earned;
  }

  // Sanity check
  if (!AC.sanityCheck(game)) {
    console.warn('Anti-cheat: sanity check failed');
  }

  updateDisplay();

  // Render shop less frequently
  shopRenderCounter++;
  if (shopRenderCounter >= 30) { // ~1s at 30fps
    shopRenderCounter = 0;
    renderShop();
    checkAchievements();
  }
}

// ===== SAVE / LOAD =====
const SAVE_KEY = 'dogged_clicker_v2';

function getSaveData() {
  const data = {
    doggeds: game.doggeds,
    totalEarned: game.totalEarned,
    totalEarnedThisRun: game.totalEarnedThisRun,
    totalClicks: game.totalClicks,
    clickPower: game.clickPower,
    clickMultiplier: game.clickMultiplier,
    buildings: game.buildings,
    upgrades: game.upgrades,
    upgradeProgress: game.upgradeProgress,
    achievements: game.achievements,
    prestigeLevel: game.prestigeLevel,
    souls: game.souls,
    totalSoulsEarned: game.totalSoulsEarned,
    prestigeUpgrades: game.prestigeUpgrades,
    goldensCaught: game.goldensCaught,
    maxCombo: game.maxCombo,
    startTime: game.startTime,
    lastSave: Date.now(),
    version: 2,
  };
  data._checksum = AC.checksum(data);
  return data;
}

function saveGame() {
  const data = getSaveData();
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  showToast('💾 Saved!');
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    // Integrity check (warn but don't block - allow save migration)
    if (!AC.validate(data)) {
      console.warn('Save integrity warning');
    }

    game.doggeds = data.doggeds || 0;
    game.totalEarned = data.totalEarned || 0;
    game.totalEarnedThisRun = data.totalEarnedThisRun || 0;
    game.totalClicks = data.totalClicks || 0;
    game.clickPower = data.clickPower || 1;
    game.clickMultiplier = data.clickMultiplier || 1;
    game.buildings = data.buildings || {};
    game.upgrades = data.upgrades || {};
    game.upgradeProgress = data.upgradeProgress || {};
    game.achievements = data.achievements || {};
    game.prestigeLevel = data.prestigeLevel || 0;
    game.souls = data.souls || 0;
    game.totalSoulsEarned = data.totalSoulsEarned || 0;
    game.prestigeUpgrades = data.prestigeUpgrades || {};
    game.goldensCaught = data.goldensCaught || 0;
    game.maxCombo = data.maxCombo || 0;
    game.startTime = data.startTime || Date.now();

    // Offline earnings
    if (data.lastSave) {
      recalculateDps();
      const offlineSeconds = (Date.now() - data.lastSave) / 1000;
      const offlineMult = getPrestigeEffect('offline_mult');
      if (game.dps > 0 && offlineSeconds > 10) {
        const maxOffline = 8 * 3600; // Cap at 8 hours
        const effectiveSeconds = Math.min(offlineSeconds, maxOffline);
        const offlineEarned = game.dps * effectiveSeconds * offlineMult;
        game.doggeds += offlineEarned;
        game.totalEarned += offlineEarned;
        game.totalEarnedThisRun += offlineEarned;

        const timeStr = offlineSeconds > 3600 ? `${Math.floor(offlineSeconds / 3600)}h` :
                        offlineSeconds > 60 ? `${Math.floor(offlineSeconds / 60)}m` :
                        `${Math.floor(offlineSeconds)}s`;
        showToast(`💤 +${formatNumber(offlineEarned)} doggeds earned offline (${timeStr})`);
      }
    }

    return true;
  } catch (e) {
    console.error('Load failed:', e);
    return false;
  }
}

function exportSave() {
  const data = getSaveData();
  const str = btoa(JSON.stringify(data));
  navigator.clipboard.writeText(str).then(() => {
    showToast('📋 Save copied to clipboard!');
  }).catch(() => {
    // Fallback
    prompt('Copy this save code:', str);
  });
}

function importSave() {
  DOM.importModal.classList.remove('hidden');
}

function doImport() {
  const raw = DOM.importTextarea.value.trim();
  if (!raw) return;

  try {
    const data = JSON.parse(atob(raw));
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    DOM.importModal.classList.add('hidden');
    location.reload();
  } catch (e) {
    showToast('❌ Invalid save code');
  }
}

function resetGame() {
  if (!confirm('Reset ALL progress? This cannot be undone!')) return;
  if (!confirm('Are you REALLY sure? All doggeds, souls, everything — gone forever.')) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

// ===== LEADERBOARD =====
async function fetchLeaderboard() {
  const list = DOM.leaderboardList;
  list.innerHTML = '<div class="leaderboard-loading">Loading...</div>';

  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();

    if (!data.ok || !data.leaderboard || data.leaderboard.length === 0) {
      list.innerHTML = `<div class="leaderboard-loading">${data.message || 'No entries yet. Be the first!'}</div>`;
      return;
    }

    list.innerHTML = '';
    data.leaderboard.forEach((entry, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const el = document.createElement('div');
      el.className = 'lb-entry';
      el.innerHTML = `
        <span class="lb-rank ${rankClass}">#${i + 1}</span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <span class="lb-score">${formatNumber(entry.score)}</span>
        <span class="lb-prestige">⭐${entry.prestige || 0}</span>
      `;
      list.appendChild(el);
    });
  } catch (e) {
    list.innerHTML = '<div class="leaderboard-loading">Could not load leaderboard</div>';
  }
}

async function submitScore() {
  const name = DOM.playerName.value.trim();
  if (!name || name.length < 1 || name.length > 20) {
    showToast('Enter a name (1-20 chars)');
    return;
  }

  const ts = Date.now();
  const payload = {
    name,
    score: Math.floor(game.totalEarned),
    prestige: game.prestigeLevel,
    ts,
    stats: {
      clicks: game.totalClicks,
      dps: Math.floor(game.dps),
      souls: game.totalSoulsEarned,
    },
  };

  payload.sig = await AC.hmac(payload);

  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.ok) {
      showToast(`🌍 Submitted! Rank #${data.rank}`);
      fetchLeaderboard();
    } else {
      showToast(`❌ ${data.error || 'Submit failed'}`);
    }
  } catch (e) {
    showToast('❌ Could not submit score');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== TABS =====
function setupTabs() {
  // Shop tabs
  document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab)?.classList.add('active');
    });
  });

  // Right tabs
  document.querySelectorAll('.right-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.right-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.right-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $('rtab-' + tab.dataset.rtab)?.classList.add('active');
      if (tab.dataset.rtab === 'leaderboard') fetchLeaderboard();
    });
  });

  // Buy amount
  document.querySelectorAll('.buy-amt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.buy-amt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const amt = btn.dataset.amt;
      game.buyAmount = amt === 'max' ? 'max' : parseInt(amt);
      renderBuildings();
    });
  });
}

// ===== MOBILE NAV =====
function setupMobileNav() {
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const panel = btn.dataset.panel;

      DOM.shopPanel.classList.remove('mobile-visible');
      DOM.statsPanel.classList.remove('mobile-visible');
      DOM.clickerArea.classList.remove('mobile-hidden');

      if (panel === 'shop') {
        DOM.shopPanel.classList.add('mobile-visible');
        DOM.clickerArea.classList.add('mobile-hidden');
      } else if (panel === 'stats') {
        DOM.statsPanel.classList.add('mobile-visible');
        DOM.clickerArea.classList.add('mobile-hidden');
      }
    });
  });
}

// ===== BACKGROUND PARTICLES =====
function spawnParticle() {
  const p = document.createElement('div');
  p.style.cssText = `
    position:absolute;font-family:'Bangers',cursive;
    color:rgba(255,107,53,0.03);font-size:${1+Math.random()*1.2}rem;
    left:${Math.random()*100}%;top:-30px;pointer-events:none;
    animation:particleFall ${10+Math.random()*15}s linear forwards;white-space:nowrap;
  `;
  p.textContent = Math.random() > 0.5 ? 'dogged' : '🐶';
  DOM.particles.appendChild(p);
  setTimeout(() => p.remove(), 25000);
}

// ===== KEYBOARD =====
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault();
    handleClick({ clientX: 0, clientY: 0 });
  }
});

// ===== AUTO-SAVE =====
setInterval(() => {
  const data = getSaveData();
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}, 30000);

// ===== ANTI-DEVTOOLS (light) =====
// Detect if game state is modified externally
setInterval(() => {
  if (!AC.sanityCheck(game)) {
    showToast('⚠️ Anomaly detected');
    AC.integrityWarnings++;
  }
}, 10000);

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  cacheDom();

  loadGame();
  recalculateDps();

  renderShop();
  renderAchievements();
  updateDisplay();

  // Events
  DOM.bigClicker.addEventListener('click', handleClick);
  DOM.saveBtn.addEventListener('click', saveGame);
  DOM.exportBtn.addEventListener('click', exportSave);
  DOM.importBtn.addEventListener('click', importSave);
  DOM.resetBtn.addEventListener('click', resetGame);
  DOM.prestigeBtn.addEventListener('click', showPrestigeModal);
  DOM.confirmPrestige.addEventListener('click', doPrestige);
  DOM.cancelPrestige.addEventListener('click', () => DOM.prestigeModal.classList.add('hidden'));
  DOM.confirmImport.addEventListener('click', doImport);
  DOM.cancelImport.addEventListener('click', () => DOM.importModal.classList.add('hidden'));
  DOM.submitScoreBtn.addEventListener('click', submitScore);
  DOM.refreshLeaderboard.addEventListener('click', fetchLeaderboard);

  setupTabs();
  setupMobileNav();

  // Game loop
  game.lastTick = Date.now();
  setInterval(gameTick, 1000 / 30);

  // Particles
  setInterval(spawnParticle, 2500);

  // Golden doggeds
  scheduleGolden();

  // Initial leaderboard fetch (lazy)
  setTimeout(fetchLeaderboard, 2000);
});

})(); // End IIFE
