// ============================================================
// DOGGED CLICKER v3.1 — Full Idle Game Engine with Realms
// ============================================================

(() => {
'use strict';

const GAME_VERSION = '3.2';

// ===== ANTI-CHEAT =====
const AC = {
  // Secrets assembled at runtime — not stored as plain string literals
  SECRET: ['D0G','G3D','-S1','GV3','-20','26'].join(''),
  SAVE_KEY: ['D0G','G3D-','SA','V3-','X0R','-K3','Y-2','026'].join(''),
  maxCPS: 35,
  clickTimestamps: [],
  lastTickTime: 0,
  integrityWarnings: 0,

  canClick() {
    const now = Date.now();
    this.clickTimestamps.push(now);
    this.clickTimestamps = this.clickTimestamps.filter(t => now - t < 1000);
    return this.clickTimestamps.length <= this.maxCPS;
  },

  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h = ((h << 5) - h) + c;
      h |= 0;
    }
    return (h >>> 0).toString(36);
  },

  // XOR-encode a JSON string to hex — JSON.parse() on the stored value throws
  encodeSave(json) {
    const k = this.SAVE_KEY;
    let out = '';
    for (let i = 0; i < json.length; i++) {
      const code = json.charCodeAt(i) ^ k.charCodeAt(i % k.length);
      out += code.toString(16).padStart(4, '0');
    }
    return out;
  },

  decodeSave(str) {
    try {
      // Encoded saves are hex strings with length divisible by 4
      if (!/^[0-9a-f]+$/i.test(str) || str.length % 4 !== 0) return null;
      const k = this.SAVE_KEY;
      let out = '';
      for (let i = 0; i < str.length; i += 4) {
        const code = parseInt(str.substr(i, 4), 16) ^ k.charCodeAt((i / 4) % k.length);
        out += String.fromCharCode(code);
      }
      // Validate it's actually JSON
      JSON.parse(out);
      return out;
    } catch (e) {
      return null;
    }
  },

  checksum(data) {
    // Wider checksum — includes souls and buildings count so tampering more fields breaks it
    const bCount = Object.values(data.buildings || {}).reduce((s, b) => s + (b.count || 0), 0);
    const core = `${data.totalEarned}|${data.totalClicks}|${data.prestigeLevel}|${data.totalSoulsEarned || 0}|${bCount}|${this.SECRET}`;
    return this.hash(core);
  },

  // Fixed: deterministic string hash matching server-side algorithm
  async hmac(data) {
    // pid is included so the device identity is baked into the signature
    const str = `${data.name}|${data.score}|${data.prestige}|${data.ts}|${data.pid}|${this.SECRET}`;
    return this.hash(str);
  },

  // Returns { ok: boolean, tampered: boolean }
  validate(data) {
    if (!data || !data._checksum) return { ok: false, tampered: false };
    const expected = this.checksum(data);
    if (data._checksum !== expected) {
      this.integrityWarnings++;
      return { ok: false, tampered: true };
    }
    return { ok: true, tampered: false };
  },

  sanityCheck(game) {
    const maxReasonableDPS = 1e20;
    if (game.dps > maxReasonableDPS) return false;
    if (game.doggeds < 0 || game.totalEarned < 0) return false;
    if (game.clickMultiplier > 1e12) return false;
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
  { id: 'dogcity',    name: 'Dog City',            icon: '🏙️', desc: 'An entire city speaks only in dogged',      baseCost: 55000000,     baseDps: 16000  },
  { id: 'dognation',  name: 'Dog Nation',          icon: '🇳🇴', desc: 'A sovereign nation powered by dogged',     baseCost: 150000000,    baseDps: 29000  },
  { id: 'clonelab',   name: 'Sigve Clone Lab',     icon: '🧬', desc: 'Each clone says dogged independently',     baseCost: 330000000,    baseDps: 44000  },
  { id: 'dimension',  name: 'Dogged Dimension',    icon: '🌌', desc: 'An entire universe of dogged',             baseCost: 5.1e9,        baseDps: 260000 },
  { id: 'singularity',name: 'Dogged Singularity',  icon: '🕳️', desc: 'All reality is dogged',                    baseCost: 7.5e10,       baseDps: 1.6e6  },
  { id: 'hivemind',   name: 'Dogged Hivemind',     icon: '🤖', desc: 'AI network that only outputs dogged',      baseCost: 1e12,         baseDps: 1e7    },
  { id: 'godmode',    name: 'The Dogged Itself',   icon: '👁️', desc: 'You have become dogged incarnate',          baseCost: 1.5e13,       baseDps: 6.5e7  },
];

// ===== REALMS — Unlockable dimensions with different modifiers =====
const REALMS = [
  {
    id: 'prime',
    name: 'Dogged Prime',
    icon: '🌍',
    desc: 'The original reality. Standard gameplay.',
    costMult: 1,
    dpsMult: 1,
    clickMult: 1,
    soulMult: 1,
    goldenEnabled: true,
    unlock: 0,
    color: '#4caf50',
  },
  {
    id: 'frost',
    name: 'Frozen Dogged',
    icon: '❄️',
    desc: 'A frozen dimension. Costs ×2.5, Clicks ×0.5, DPS ×1.3, Souls ×2.',
    costMult: 2.5,
    dpsMult: 1.3,
    clickMult: 0.5,
    soulMult: 2,
    goldenEnabled: true,
    unlock: 5,
    color: '#64b5f6',
  },
  {
    id: 'inferno',
    name: 'Dogged Inferno',
    icon: '🔥',
    desc: 'Hellish costs. No golden doggeds. Costs ×5, DPS ×2, Souls ×5.',
    costMult: 5,
    dpsMult: 2,
    clickMult: 0.3,
    soulMult: 5,
    goldenEnabled: false,
    unlock: 15,
    color: '#ef5350',
  },
  {
    id: 'void',
    name: 'The Void',
    icon: '🕳️',
    desc: 'Costs ×20, Clicks ×0.1, DPS ×3, Souls ×15. True darkness.',
    costMult: 20,
    dpsMult: 3,
    clickMult: 0.1,
    soulMult: 15,
    goldenEnabled: true,
    unlock: 35,
    color: '#9c27b0',
  },
  {
    id: 'beyond',
    name: 'The Beyond',
    icon: '✨',
    desc: 'Costs ×100, Clicks ×0.05, DPS ×5, Souls ×50. The ultimate test.',
    costMult: 100,
    dpsMult: 5,
    clickMult: 0.05,
    soulMult: 50,
    goldenEnabled: false,
    unlock: 75,
    color: '#ffd700',
  },
];

const COST_MULTIPLIER = 1.15;

// Upgrades: tiered per building + click upgrades + synergy + global
const UPGRADES = [
  // Click multipliers
  { id: 'click1',  name: 'Stronger Finger',    icon: '👆',  desc: 'Clicks ×2',                  cost: 100,       type: 'click_mult', value: 2,  clicks: 1 },
  { id: 'click2',  name: 'Double Tap',         icon: '✌️',  desc: 'Clicks ×2',                  cost: 5000,      type: 'click_mult', value: 2,  clicks: 1 },
  { id: 'click3',  name: 'Power Slap',         icon: '🫲',  desc: 'Clicks ×3',                  cost: 50000,     type: 'click_mult', value: 3,  clicks: 3 },
  { id: 'click4',  name: 'Fist of Dogged',     icon: '👊',  desc: 'Clicks ×5',                  cost: 5e6,       type: 'click_mult', value: 5,  clicks: 5 },
  { id: 'click5',  name: 'Mind Click',         icon: '🧠',  desc: 'Clicks ×10',                 cost: 5e8,       type: 'click_mult', value: 10, clicks: 10 },
  { id: 'click6',  name: 'Dogged Telekinesis', icon: '🔮',  desc: 'Clicks ×25',                 cost: 5e11,      type: 'click_mult', value: 25, clicks: 15 },

  // Building tier upgrades
  ...generateBuildingUpgrades(),

  // Global multipliers
  { id: 'coffee',       name: "Sigve's Coffee",    icon: '☕', desc: 'All production +10%',    cost: 50000,     type: 'global_mult', value: 1.10, clicks: 1 },
  { id: 'energy',       name: 'Monster Dogged',    icon: '🥤', desc: 'All production +15%',    cost: 5e6,       type: 'global_mult', value: 1.15, clicks: 1 },
  { id: 'spirit',       name: 'Dogged Spirit',     icon: '✨', desc: 'All production +25%',    cost: 5e8,       type: 'global_mult', value: 1.25, clicks: 3 },
  { id: 'transcend',    name: 'Transcendence',     icon: '🌟', desc: 'All production +50%',    cost: 5e11,      type: 'global_mult', value: 1.50, clicks: 5 },
  { id: 'dogged_god',   name: 'Dogged God Mode',   icon: '⚡', desc: 'All production ×2',      cost: 5e13,      type: 'global_mult', value: 2.00, clicks: 10 },

  // Synergy upgrades
  { id: 'syn_echo_parrot',   name: 'Echo Chamber',       icon: '📣', desc: 'Echoes + Parrots synergy: both ×1.5',    cost: 2000,    type: 'synergy', buildings: ['echo', 'parrot'], value: 1.5, req: { buildings: { echo: 5, parrot: 5 } }, clicks: 1 },
  { id: 'syn_chat_printer',  name: 'Spam Infrastructure', icon: '🖥️', desc: 'Chat Bots + Printers synergy: both ×1.5', cost: 100000, type: 'synergy', buildings: ['groupchat', 'printer'], value: 1.5, req: { buildings: { groupchat: 10, printer: 10 } }, clicks: 2 },
  { id: 'syn_factory_uni',   name: 'Industrial Studies',  icon: '📚', desc: 'Factory + Uni synergy: both ×2',         cost: 15e6,    type: 'synergy', buildings: ['factory', 'university'], value: 2, req: { buildings: { factory: 15, university: 15 } }, clicks: 3 },
  { id: 'syn_sat_city',      name: 'Urban Broadcast',     icon: '📡', desc: 'Satellites + Dog City synergy: both ×2', cost: 2e9,     type: 'synergy', buildings: ['satellite', 'dogcity'], value: 2, req: { buildings: { satellite: 10, dogcity: 10 } }, clicks: 3 },
  { id: 'syn_city_nation',   name: 'Dogged Republic',    icon: '🏛️', desc: 'Dog City + Dog Nation synergy: both ×2.5', cost: 8e9,    type: 'synergy', buildings: ['dogcity', 'dognation'], value: 2.5, req: { buildings: { dogcity: 15, dognation: 15 } }, clicks: 4 },
  { id: 'syn_nation_clone',  name: 'Clone Army',         icon: '⚔️', desc: 'Dog Nation + Clones synergy: both ×2',    cost: 15e9,    type: 'synergy', buildings: ['dognation', 'clonelab'], value: 2, req: { buildings: { dognation: 10, clonelab: 10 } }, clicks: 4 },
  { id: 'syn_sat_clone',     name: 'Space Clones',        icon: '👽', desc: 'Satellites + Clones synergy: both ×2',   cost: 5e9,     type: 'synergy', buildings: ['satellite', 'clonelab'], value: 2, req: { buildings: { satellite: 10, clonelab: 10 } }, clicks: 3 },
  { id: 'syn_dim_sing',      name: 'Reality Collapse',    icon: '💥', desc: 'Dimensions + Singularities: both ×3',   cost: 5e12,    type: 'synergy', buildings: ['dimension', 'singularity'], value: 3, req: { buildings: { dimension: 5, singularity: 5 } }, clicks: 5 },
  { id: 'syn_hive_god',      name: 'Singularity Nexus',   icon: '🌀', desc: 'Hivemind + Dogged Itself: both ×3',     cost: 5e14,    type: 'synergy', buildings: ['hivemind', 'godmode'], value: 3, req: { buildings: { hivemind: 5, godmode: 5 } }, clicks: 8 },
];

function generateBuildingUpgrades() {
  const tiers = [
    { count: 10,  mult: 2,  suffix: 'I',     clicksNeeded: 1 },
    { count: 25,  mult: 2,  suffix: 'II',    clicksNeeded: 2 },
    { count: 50,  mult: 2,  suffix: 'III',   clicksNeeded: 3 },
    { count: 75,  mult: 2,  suffix: 'III½',  clicksNeeded: 4 },
    { count: 100, mult: 3,  suffix: 'IV',    clicksNeeded: 5 },
    { count: 150, mult: 3,  suffix: 'V',     clicksNeeded: 7 },
    { count: 200, mult: 4,  suffix: 'VI',    clicksNeeded: 10 },
    { count: 300, mult: 5,  suffix: 'VII',   clicksNeeded: 15 },
    { count: 400, mult: 5,  suffix: 'VIII',  clicksNeeded: 20 },
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

// Prestige upgrades (bought with souls) — REBALANCED: costs significantly increased
const PRESTIGE_UPGRADES = [
  // --- Early tier (affordable after 2-3 ascensions) ---
  { id: 'p_click1',     name: 'Soulful Click',      icon: '💀👆', desc: 'Start with ×2 click power after ascension',  cost: 5,    effect: 'start_click_mult', value: 2 },
  { id: 'p_cheapBuild', name: 'Soul Discount',       icon: '💀🏷️', desc: 'All buildings cost 5% less',                cost: 8,    effect: 'building_discount', value: 0.95 },
  { id: 'p_combo',      name: 'Combo Master',        icon: '🔥',    desc: 'Click combos give 2× bonus',              cost: 12,   effect: 'combo_mult', value: 2 },
  { id: 'p_golden1',    name: 'Lucky Dogged',        icon: '🍀',    desc: 'Golden doggeds appear 50% more often',     cost: 15,   effect: 'golden_freq', value: 1.5 },

  // --- Mid tier (requires 5-10 ascensions) ---
  { id: 'p_click2',     name: 'Ghost Click',         icon: '👻👆', desc: 'Start with ×3 click power after ascension',  cost: 25,   effect: 'start_click_mult', value: 3 },
  { id: 'p_cheapBuild2',name: 'Deep Discount',       icon: '💀💰', desc: 'All buildings cost 10% less',               cost: 35,   effect: 'building_discount', value: 0.90 },
  { id: 'p_golden2',    name: 'Golden Magnet',       icon: '🧲',    desc: 'Golden doggeds give 2× reward',            cost: 30,   effect: 'golden_mult', value: 2 },
  { id: 'p_golden3',    name: 'Golden Age',          icon: '👑',    desc: 'Golden doggeds last 2× longer',            cost: 25,   effect: 'golden_duration', value: 2 },
  { id: 'p_crit',       name: 'Critical Dogged',     icon: '💥',    desc: '5% chance for 10× click',                  cost: 40,   effect: 'crit_chance', value: 0.05 },
  { id: 'p_offline',    name: 'Dream Doggeds',       icon: '💤',    desc: 'Earn 25% production while offline',        cost: 50,   effect: 'offline_mult', value: 0.25 },

  // --- Late tier (requires 15-25 ascensions or hard realm runs) ---
  { id: 'p_soul_boost', name: 'Soul Harvester',      icon: '⚡💀',  desc: 'Earn 25% more souls on ascension',        cost: 75,   effect: 'soul_bonus', value: 1.25 },
  { id: 'p_start_dps',  name: 'Head Start',          icon: '🚀',    desc: 'Start each run with 10 of first building', cost: 60,   effect: 'start_buildings', value: 10 },
  { id: 'p_crit2',      name: 'Super Critical',      icon: '🌋',    desc: '10% chance for 25× click',                 cost: 100,  effect: 'crit_chance', value: 0.10 },
  { id: 'p_offline2',   name: 'Sleepwalking Sigve',  icon: '🌙',    desc: 'Earn 50% production while offline',        cost: 120,  effect: 'offline_mult', value: 0.5 },
  { id: 'p_cheapBuild3',name: 'Dogged Bargain',      icon: '🏷️✨', desc: 'All buildings cost 15% less',              cost: 100,  effect: 'building_discount', value: 0.85 },

  // --- Endgame tier (requires many ascensions or high realm runs) ---
  { id: 'p_soul_boost2',name: 'Supreme Harvester',   icon: '🔥💀',  desc: 'Earn 50% more souls on ascension',        cost: 200,  effect: 'soul_bonus', value: 1.5 },
  { id: 'p_click3',     name: 'Phantom Touch',       icon: '👻✨', desc: 'Start with ×5 click power after ascension',  cost: 150, effect: 'start_click_mult', value: 5 },
  { id: 'p_golden4',    name: 'Golden God',          icon: '🌟🧲', desc: 'Golden doggeds give 3× reward & appear 2× more', cost: 180, effect: 'golden_mult', value: 3 },
  { id: 'p_combo2',     name: 'Combo Legend',        icon: '🔥🔥', desc: 'Click combos give 3× bonus',              cost: 160,  effect: 'combo_mult', value: 3 },
  { id: 'p_offline3',   name: 'Eternal Dreamer',     icon: '💫',    desc: 'Earn 100% production while offline',       cost: 300,  effect: 'offline_mult', value: 1.0 },
  { id: 'p_start_dps2', name: 'Dogged Kickstart',    icon: '🚀🚀', desc: 'Start each run with 25 of first 2 buildings', cost: 250, effect: 'start_buildings', value: 25 },

  // --- Realm mastery tier ---
  { id: 'p_realm_frost',  name: 'Frostwalker',       icon: '❄️💀', desc: 'Frost realm costs reduced by 20%',         cost: 100,  effect: 'realm_discount_frost', value: 0.8 },
  { id: 'p_realm_inferno',name: 'Fireproof',         icon: '🔥💀', desc: 'Inferno realm costs reduced by 20%',       cost: 200,  effect: 'realm_discount_inferno', value: 0.8 },
  { id: 'p_realm_void',   name: 'Void Walker',       icon: '🕳️💀', desc: 'Void realm costs reduced by 25%',         cost: 400,  effect: 'realm_discount_void', value: 0.75 },
  { id: 'p_realm_beyond', name: 'Transcendent',      icon: '✨💀', desc: 'Beyond realm costs reduced by 30%',       cost: 800,  effect: 'realm_discount_beyond', value: 0.70 },
];

// ===== ACHIEVEMENTS =====
const ACHIEVEMENTS = [
  // Click milestones
  { id: 'click1',     name: 'First!',            icon: '👶', desc: '1 click',                     check: g => g.totalClicks >= 1 },
  { id: 'click100',   name: 'Clicker',           icon: '👆', desc: '100 clicks',                   check: g => g.totalClicks >= 100 },
  { id: 'click1k',    name: 'Carpal Tunnel',     icon: '🤕', desc: '1,000 clicks',                 check: g => g.totalClicks >= 1000 },
  { id: 'click10k',   name: 'Finger Destroyer',  icon: '💀', desc: '10,000 clicks',                check: g => g.totalClicks >= 10000 },
  { id: 'click100k',  name: 'Machine Gun',       icon: '🔫', desc: '100,000 clicks',               check: g => g.totalClicks >= 100000 },
  { id: 'click1m',    name: 'Click Deity',       icon: '🖱️', desc: '1,000,000 clicks',             check: g => g.totalClicks >= 1000000 },

  // Earning milestones
  { id: 'earn100',    name: 'Starter',            icon: '🌱', desc: 'Earn 100 doggeds',            check: g => g.totalEarned >= 100 },
  { id: 'earn1k',     name: 'Getting There',      icon: '📈', desc: 'Earn 1K doggeds',             check: g => g.totalEarned >= 1000 },
  { id: 'earn1m',     name: 'Mega Dogged',        icon: '🚀', desc: 'Earn 1M doggeds',             check: g => g.totalEarned >= 1e6 },
  { id: 'earn1b',     name: 'Giga Dogged',        icon: '🌍', desc: 'Earn 1B doggeds',             check: g => g.totalEarned >= 1e9 },
  { id: 'earn1t',     name: 'Tera Dogged',        icon: '🌌', desc: 'Earn 1T doggeds',             check: g => g.totalEarned >= 1e12 },
  { id: 'earn1q',     name: 'Quadrillion Dogged', icon: '🕳️', desc: 'Earn 1Q doggeds',            check: g => g.totalEarned >= 1e15 },
  { id: 'earn1qi',    name: 'Beyond Counting',    icon: '♾️', desc: 'Earn 1 Quintillion doggeds',  check: g => g.totalEarned >= 1e18 },

  // Building milestones
  { id: 'build1',     name: 'Investor',            icon: '📈', desc: 'Buy first building',         check: g => getTotalBuildings(g) >= 1 },
  { id: 'build50',    name: 'Tycoon',              icon: '🏢', desc: 'Own 50 buildings',            check: g => getTotalBuildings(g) >= 50 },
  { id: 'build100',   name: 'Empire',              icon: '👑', desc: 'Own 100 buildings',           check: g => getTotalBuildings(g) >= 100 },
  { id: 'build500',   name: 'Dogged Dynasty',      icon: '🏰', desc: 'Own 500 buildings',           check: g => getTotalBuildings(g) >= 500 },
  { id: 'build1000',  name: 'Mega Corporation',    icon: '🌐', desc: 'Own 1000 buildings',          check: g => getTotalBuildings(g) >= 1000 },
  { id: 'build2000',  name: 'Universal Empire',    icon: '🌠', desc: 'Own 2000 buildings',          check: g => getTotalBuildings(g) >= 2000 },

  // DPS milestones
  { id: 'dps100',     name: 'Passive Income',      icon: '💤', desc: '100/s',                       check: g => g.dps >= 100 },
  { id: 'dps10k',     name: 'Dogged Machine',      icon: '⚙️', desc: '10K/s',                      check: g => g.dps >= 10000 },
  { id: 'dps1m',      name: 'Unstoppable',         icon: '🔥', desc: '1M/s',                        check: g => g.dps >= 1e6 },
  { id: 'dps1b',      name: 'Dogged Overload',     icon: '💥', desc: '1B/s',                        check: g => g.dps >= 1e9 },
  { id: 'dps1t',      name: 'Tera Power',          icon: '⚡', desc: '1T/s',                        check: g => g.dps >= 1e12 },
  { id: 'dps1q',      name: 'Infinite Engine',     icon: '🌀', desc: '1Q/s',                        check: g => g.dps >= 1e15 },

  // Prestige milestones
  { id: 'prestige1',  name: 'Ascended',            icon: '⭐', desc: 'Prestige for the first time',  check: g => g.prestigeLevel >= 1 },
  { id: 'prestige5',  name: 'Veteran',             icon: '🎖️', desc: 'Prestige 5 times',           check: g => g.prestigeLevel >= 5 },
  { id: 'prestige10', name: 'Eternal Dogged',      icon: '♾️', desc: 'Prestige 10 times',           check: g => g.prestigeLevel >= 10 },
  { id: 'prestige25', name: 'Dogged God',          icon: '🙏', desc: 'Prestige 25 times',           check: g => g.prestigeLevel >= 25 },
  { id: 'prestige50', name: 'Dogged Ascendant',    icon: '🔱', desc: 'Prestige 50 times',           check: g => g.prestigeLevel >= 50 },
  { id: 'prestige100',name: 'Dogged Eternal',      icon: '🏛️', desc: 'Prestige 100 times',         check: g => g.prestigeLevel >= 100 },

  // Golden doggeds
  { id: 'golden1',    name: 'Lucky!',              icon: '🍀', desc: 'Catch a golden dogged',       check: g => g.goldensCaught >= 1 },
  { id: 'golden10',   name: 'Golden Hunter',       icon: '🏹', desc: 'Catch 10 golden doggeds',     check: g => g.goldensCaught >= 10 },
  { id: 'golden50',   name: 'Midas Touch',         icon: '✨', desc: 'Catch 50 golden doggeds',     check: g => g.goldensCaught >= 50 },
  { id: 'golden200',  name: 'Golden Legend',        icon: '🌟', desc: 'Catch 200 golden doggeds',   check: g => g.goldensCaught >= 200 },

  // Combos
  { id: 'combo25',    name: 'Combo Starter',       icon: '🔥', desc: '25× click combo',             check: g => g.maxCombo >= 25 },
  { id: 'combo100',   name: 'Combo King',          icon: '👑', desc: '100× click combo',            check: g => g.maxCombo >= 100 },
  { id: 'combo500',   name: 'Combo Legend',        icon: '🏆', desc: '500× click combo',            check: g => g.maxCombo >= 500 },

  // Collection
  { id: 'allbuilds',  name: 'Collector',           icon: '🎯', desc: 'Own 1 of every building',    check: g => BUILDINGS.every(b => (g.buildings[b.id]?.count || 0) >= 1) },

  // Souls
  { id: 'souls50',    name: 'Soul Collector',      icon: '💀', desc: 'Earn 50 total souls',         check: g => g.totalSoulsEarned >= 50 },
  { id: 'souls200',   name: 'Soul Lord',           icon: '☠️', desc: 'Earn 200 total souls',       check: g => g.totalSoulsEarned >= 200 },
  { id: 'souls1k',    name: 'Soul Emperor',        icon: '💀👑', desc: 'Earn 1000 total souls',    check: g => g.totalSoulsEarned >= 1000 },
  { id: 'souls5k',    name: 'Soul God',            icon: '💀🌟', desc: 'Earn 5000 total souls',    check: g => g.totalSoulsEarned >= 5000 },

  // Realm achievements
  { id: 'realm_frost',   name: 'Frost Pioneer',    icon: '❄️', desc: 'Complete a run in Frozen Dogged',  check: g => g.realmCompletions?.frost >= 1 },
  { id: 'realm_inferno', name: 'Hellwalker',        icon: '🔥', desc: 'Complete a run in Dogged Inferno', check: g => g.realmCompletions?.inferno >= 1 },
  { id: 'realm_void',    name: 'Void Touched',      icon: '🕳️', desc: 'Complete a run in The Void',      check: g => g.realmCompletions?.void >= 1 },
  { id: 'realm_beyond',  name: 'Beyond Mortal',     icon: '✨', desc: 'Complete a run in The Beyond',     check: g => g.realmCompletions?.beyond >= 1 },
  { id: 'realm_master',  name: 'Realm Master',      icon: '🌈', desc: 'Complete a run in every realm',    check: g => REALMS.every(r => r.id === 'prime' || (g.realmCompletions?.[r.id] || 0) >= 1) },

  // Specific building milestones
  { id: 'echo100',     name: 'Echo Lord',           icon: '🗣️', desc: 'Own 100 Echoes',             check: g => (g.buildings.echo?.count || 0) >= 100 },
  { id: 'godmode10',   name: 'Dogged Pantheon',     icon: '👁️', desc: 'Own 10 Dogged Itself',        check: g => (g.buildings.godmode?.count || 0) >= 10 },
  { id: 'godmode50',   name: 'Omnidogged',          icon: '👁️🌟', desc: 'Own 50 Dogged Itself',      check: g => (g.buildings.godmode?.count || 0) >= 50 },

  // Dog City & Dog Nation milestones
  { id: 'dogcity1',    name: 'City Founder',        icon: '🏙️', desc: 'Build your first Dog City',   check: g => (g.buildings.dogcity?.count || 0) >= 1 },
  { id: 'dogcity25',   name: 'City Planner',        icon: '🏗️', desc: 'Own 25 Dog Cities',           check: g => (g.buildings.dogcity?.count || 0) >= 25 },
  { id: 'dogcity100',  name: 'Metropolis',          icon: '🌆', desc: 'Own 100 Dog Cities',          check: g => (g.buildings.dogcity?.count || 0) >= 100 },
  { id: 'dognation1',  name: 'Nation Builder',      icon: '🇳🇴', desc: 'Found your first Dog Nation',  check: g => (g.buildings.dognation?.count || 0) >= 1 },
  { id: 'dognation25', name: 'Supreme Leader',      icon: '👑', desc: 'Own 25 Dog Nations',          check: g => (g.buildings.dognation?.count || 0) >= 25 },
  { id: 'dognation100',name: 'World Domination',    icon: '🌍🐶', desc: 'Own 100 Dog Nations',       check: g => (g.buildings.dognation?.count || 0) >= 100 },

  // Events
  { id: 'events5',     name: 'Event Enjoyer',       icon: '⚡', desc: 'Experience 5 random events',   check: g => (g.eventsTriggered || 0) >= 5 },
  { id: 'events25',    name: 'Event Hunter',        icon: '🎯', desc: 'Experience 25 random events',  check: g => (g.eventsTriggered || 0) >= 25 },
  { id: 'events100',   name: 'Event Legend',        icon: '🌟⚡', desc: 'Experience 100 random events', check: g => (g.eventsTriggered || 0) >= 100 },

  // Big number milestones
  { id: 'earn1sx',     name: 'Sextillion Dogged',   icon: '🚀🚀', desc: 'Earn 1 Sextillion doggeds',   check: g => g.totalEarned >= 1e21 },
  { id: 'earn1sp',     name: 'Septillion Dogged',   icon: '🌌🌌', desc: 'Earn 1 Septillion doggeds',   check: g => g.totalEarned >= 1e24 },
  { id: 'earn1oc',     name: 'Octillion Dogged',    icon: '✴️', desc: 'Earn 1 Octillion doggeds',    check: g => g.totalEarned >= 1e27 },
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
  '"Dog City never sleeps. Too busy being dogged."',
  '"The Dog Nation anthem is just someone saying dogged for 4 minutes."',
  '"Citizens of Dog Nation salute you."',
  '"Dog City council voted unanimously: more dogged."',
  '"Breaking news from Dog Nation: still dogged."',
  '"Dog City population: dogged."',
  '"Dog Nation GDP: 100% dogged exports."',
  '"The mayor of Dog City is literally a dog."',
  '"dogged? dogged."',
  '"I dream in dogged."', '"My first word was dogged."',
  '"Sigve would be proud."', '"dogged transcends language."',
  '"They said I couldn\'t dogged. I dogged."',
  '"In a world of dogs, be dogged."',
  '"My ancestors smile upon my dogged."',
  '"Is this dogged? No, this is Patrick."',
  '"One does not simply stop being dogged."',
  '"Dogged is not a hobby. It\'s a calling."',
  '"The void whispers: dogged."',
  '"I have seen the beyond. It\'s dogged."',
  '"Reality is just concentrated dogged."',
  '"E = mc dogged"', '"To dogged or not to dogged? dogged."',
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
  upgrades: {},
  upgradeProgress: {},
  achievements: {},
  prestigeLevel: 0,
  souls: 0,
  totalSoulsEarned: 0,
  prestigeUpgrades: {},
  goldensCaught: 0,
  eventsTriggered: 0,
  maxCombo: 0,
  combo: 0,
  comboTimer: null,
  activeEvent: null,
  activeEventTimer: null,
  startTime: Date.now(),
  lastSave: Date.now(),
  lastTick: Date.now(),
  buyAmount: 1,
  // v3 additions
  realm: 'prime',
  selectedRealm: 'prime',
  realmCompletions: {},
  runStartTime: Date.now(),
  fastestRun: {},
  // Anti-cheat — not persisted, set at runtime
  _verifiedSouls: 0,         // souls value as granted by legit game code
  _verifiedTotalSouls: 0,    // totalSoulsEarned as granted by legit game code
  _tickDoggeds: 0,           // expected doggeds at start of each tick
  _tickTotalEarned: 0,       // expected totalEarned at start of each tick
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
    'statTotalSouls', 'statMaxCombo', 'statGoldens', 'statTimePlayed', 'statRealm',
    'saveBtn', 'exportBtn', 'importBtn', 'resetBtn', 'particles',
    'prestigeSection', 'prestigeSoulsPreview', 'prestigeBtn',
    'prestigeModal', 'modalSouls', 'modalRealmInfo', 'confirmPrestige', 'cancelPrestige',
    'importModal', 'importTextarea', 'confirmImport', 'cancelImport',
    'goldenDogged', 'prestigeBadge', 'soulsDisplay', 'soulsBalance',
    'multDisplay', 'comboDisplay', 'achievementProgress',
    'playerName', 'submitScoreBtn', 'leaderboardList', 'refreshLeaderboard',
    'shopPanel', 'statsPanel', 'clickerArea',
    'realmBadge', 'realmListContainer', 'lbLastUpdated', 'trackingStatus',
    'statEvents', 'productionBreakdown',
    'prodTotalDps', 'prodSoulBoost', 'prodRealmMult', 'prodEventMult',
    'prodGlobalMult', 'prodClickPower', 'prodEfficiency',
  ];
  ids.forEach(id => { DOM[id] = $(id); });
}

// ===== HELPERS =====
function formatNumber(n) {
  if (n === Infinity) return '∞';
  if (n !== n) return '0'; // NaN guard
  if (n < 0) return '-' + formatNumber(-n);
  if (n < 1000) return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
  const suffixes = [
    { v: 1e63, s: 'Vg' }, { v: 1e60, s: 'Nd' }, { v: 1e57, s: 'Od' },
    { v: 1e54, s: 'Sd' }, { v: 1e51, s: 'Sxd' }, { v: 1e48, s: 'Qid' },
    { v: 1e45, s: 'Qad' }, { v: 1e42, s: 'Td' }, { v: 1e39, s: 'Dd' },
    { v: 1e36, s: 'Ud' }, { v: 1e33, s: 'Dc' }, { v: 1e30, s: 'No' },
    { v: 1e27, s: 'Oc' }, { v: 1e24, s: 'Sp' }, { v: 1e21, s: 'Sx' },
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

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ===== REALM HELPERS =====
function getCurrentRealm() {
  return REALMS.find(r => r.id === game.realm) || REALMS[0];
}

function getRealmCostMult() {
  const realm = getCurrentRealm();
  let mult = realm.costMult;

  // Apply realm-specific prestige discounts
  const realmDiscountKey = `realm_discount_${realm.id}`;
  for (const pu of PRESTIGE_UPGRADES) {
    if (game.prestigeUpgrades[pu.id] && pu.effect === realmDiscountKey) {
      mult *= pu.value;
    }
  }
  return mult;
}

function getRealmDpsMult() {
  return getCurrentRealm().dpsMult;
}

function getRealmClickMult() {
  return getCurrentRealm().clickMult;
}

function getRealmSoulMult() {
  return getCurrentRealm().soulMult;
}

function isRealmUnlocked(realm) {
  return game.prestigeLevel >= realm.unlock;
}

// ===== PRESTIGE HELPERS =====
function getPrestigeEffect(effectType) {
  let value = effectType === 'building_discount' ? 1 :
              effectType === 'soul_bonus' ? 1 :
              effectType === 'golden_freq' ? 1 :
              effectType === 'golden_mult' ? 1 :
              effectType === 'golden_duration' ? 1 :
              effectType === 'offline_mult' ? 0 :
              effectType === 'combo_mult' ? 1 :
              effectType === 'crit_chance' ? 0 :
              effectType === 'start_click_mult' ? 1 :
              effectType === 'start_buildings' ? 0 :
              0;

  for (const pu of PRESTIGE_UPGRADES) {
    if (game.prestigeUpgrades[pu.id] && pu.effect === effectType) {
      if (effectType === 'building_discount') value *= pu.value;
      else if (effectType === 'soul_bonus') value *= pu.value;
      else if (effectType === 'crit_chance') value = Math.max(value, pu.value);
      else if (effectType === 'offline_mult') value = Math.max(value, pu.value);
      else if (effectType === 'start_click_mult') value *= pu.value;
      else if (effectType === 'start_buildings') value = Math.max(value, pu.value);
      else value *= pu.value;
    }
  }
  return value;
}

function getSoulsForCurrentRun() {
  // REBALANCED: Much harder to earn souls. Base requirement: 1T earned this run for 1 soul.
  // Uses 0.45 exponent (slower than sqrt) for diminishing returns at high numbers.
  const base = Math.floor(Math.pow(game.totalEarnedThisRun / 1e12, 0.45));
  const soulBonus = getPrestigeEffect('soul_bonus');
  const realmMult = getRealmSoulMult();
  return Math.floor(base * soulBonus * realmMult);
}

function getSoulBoostMultiplier() {
  // REBALANCED: Diminishing returns on soul boost
  // First 50 souls: +2% each = up to 2.0x
  // Next 100 souls: +1% each = up to 3.0x
  // Beyond 150: +0.5% each (slow scaling)
  const s = game.souls;
  let bonus = 0;
  if (s <= 50) {
    bonus = s * 0.02;
  } else if (s <= 150) {
    bonus = 50 * 0.02 + (s - 50) * 0.01;
  } else {
    bonus = 50 * 0.02 + 100 * 0.01 + (s - 150) * 0.005;
  }
  return 1 + bonus;
}

// ===== COST CALCULATIONS =====
function getBuildingCost(buildingData, amount = 1) {
  const count = game.buildings[buildingData.id]?.count || 0;
  const discount = getPrestigeEffect('building_discount');
  const realmCost = getRealmCostMult();
  const eventCost = game._eventCostMult || 1;
  let total = 0;
  for (let i = 0; i < amount; i++) {
    total += Math.floor(buildingData.baseCost * Math.pow(COST_MULTIPLIER, count + i) * discount * realmCost * eventCost);
  }
  return total;
}

function getMaxAffordable(buildingData) {
  const count = game.buildings[buildingData.id]?.count || 0;
  const discount = getPrestigeEffect('building_discount');
  const realmCost = getRealmCostMult();
  const eventCost = game._eventCostMult || 1;
  let total = 0;
  let n = 0;
  while (true) {
    const next = Math.floor(buildingData.baseCost * Math.pow(COST_MULTIPLIER, count + n) * discount * realmCost * eventCost);
    if (total + next > game.doggeds) break;
    total += next;
    n++;
    if (n > 1000) break;
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

  // Realm click modifier
  base *= getRealmClickMult();

  // Combo bonus: +1% per combo, capped at 500
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

  // Active event click multiplier
  base *= (game._eventClickMult || 1);

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

  // Realm DPS multiplier
  globalMult *= getRealmDpsMult();

  // Active event multiplier
  globalMult *= (game._eventDpsMult || 1);

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
  if (!AC.canClick()) return;

  const { value, isCrit } = getClickValue();
  game.doggeds += value;
  game.totalEarned += value;
  game.totalEarnedThisRun += value;
  game.totalClicks++;

  // Combo
  game.combo++;
  if (game.combo > game.maxCombo) game.maxCombo = game.combo;
  if (!game._eventComboFreeze) {
    clearTimeout(game.comboTimer);
    game.comboTimer = setTimeout(() => { game.combo = 0; }, 1500);
  }

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

  // Keep anti-cheat soul ref in sync (souls decreased legitimately)
  game._verifiedSouls = game.souls;

  recalculateDps();
  renderShop();
  updateDisplay();

  showToast(`💀 ${pu.name} unlocked!`);
}

// ===== PRESTIGE (ASCENSION) =====
function showPrestigeModal() {
  const souls = getSoulsForCurrentRun();
  if (souls < 1) {
    const realm = getCurrentRealm();
    const needed = realm.id === 'prime' ? '1T' : formatNumber(1e12 / realm.soulMult);
    showToast(`Need at least ~1T total earned this run to ascend!`);
    return;
  }
  DOM.modalSouls.textContent = formatNumber(souls);

  // Show realm info in modal
  const selectedRealm = REALMS.find(r => r.id === game.selectedRealm) || REALMS[0];
  if (DOM.modalRealmInfo) {
    DOM.modalRealmInfo.innerHTML = `
      <p class="modal-realm">🌍 Next realm: <strong style="color:${selectedRealm.color}">${selectedRealm.icon} ${selectedRealm.name}</strong></p>
      <p class="modal-realm-desc" style="font-size:0.75rem;color:#888">${selectedRealm.desc}</p>
    `;
  }

  DOM.prestigeModal.classList.remove('hidden');
}

function doPrestige() {
  const souls = getSoulsForCurrentRun();
  if (souls < 1) return;

  // Track realm completion (only if earned souls > 0)
  const currentRealm = getCurrentRealm();
  if (currentRealm.id !== 'prime') {
    if (!game.realmCompletions[currentRealm.id]) game.realmCompletions[currentRealm.id] = 0;
    game.realmCompletions[currentRealm.id]++;
  }

  // Track run time
  const runTime = (Date.now() - game.runStartTime) / 1000;
  const realmId = currentRealm.id;
  if (!game.fastestRun[realmId] || runTime < game.fastestRun[realmId]) {
    game.fastestRun[realmId] = Math.floor(runTime);
  }

  game.souls += souls;
  game.totalSoulsEarned += souls;
  game.prestigeLevel++;

  // Keep anti-cheat soul refs in sync
  game._verifiedSouls = game.souls;
  game._verifiedTotalSouls = game.totalSoulsEarned;

  // Switch to selected realm
  game.realm = game.selectedRealm || 'prime';

  // Reset run-specific state
  game.doggeds = 0;
  game.totalEarnedThisRun = 0;
  game.buildings = {};
  game.upgrades = {};
  game.upgradeProgress = {};
  game.clickPower = 1;
  game.clickMultiplier = getPrestigeEffect('start_click_mult');
  game.combo = 0;
  game.runStartTime = Date.now();

  // Clear any active event
  if (game.activeEventTimer) {
    clearTimeout(game.activeEventTimer);
    game.activeEventTimer = null;
  }
  if (game.activeEvent) {
    const evt = RANDOM_EVENTS.find(e => e.id === game.activeEvent);
    if (evt) evt.remove();
    game.activeEvent = null;
    hideEventBanner();
  }
  game._eventClickMult = 1;
  game._eventDpsMult = 1;
  game._eventComboFreeze = false;
  game._eventCostMult = 1;

  // Apply start buildings prestige effect
  const startBuildings = getPrestigeEffect('start_buildings');
  if (startBuildings > 0) {
    game.buildings['echo'] = { count: startBuildings, multiplier: 1 };
    // p_start_dps2 gives 25 and also adds parrots
    if (startBuildings >= 25) {
      game.buildings['parrot'] = { count: startBuildings, multiplier: 1 };
    }
  }

  recalculateDps();

  DOM.prestigeModal.classList.add('hidden');

  saveGame(true); // save silently — ascension toast is shown separately
  renderShop();
  renderAchievements();
  updateDisplay();

  showToast(`⭐ Ascended! +${souls} 💀 (Level ${game.prestigeLevel}) → ${getCurrentRealm().icon} ${getCurrentRealm().name}`);
}

// ===== GOLDEN DOGGED =====
let goldenTimeout = null;
let goldenHideTimeout = null;
let goldenClickHandler = null;

function scheduleGolden() {
  // Always keep only one pending spawn timer
  if (goldenTimeout) {
    clearTimeout(goldenTimeout);
    goldenTimeout = null;
  }

  // Don't schedule if realm disables golden doggeds
  if (!getCurrentRealm().goldenEnabled) return;

  const freqMult = getPrestigeEffect('golden_freq');
  const minDelay = 120000 / freqMult;
  const maxDelay = 300000 / freqMult;
  const delay = minDelay + Math.random() * (maxDelay - minDelay);

  goldenTimeout = setTimeout(() => {
    goldenTimeout = null;
    spawnGoldenDogged();
  }, delay);
}

function spawnGoldenDogged() {
  if (!getCurrentRealm().goldenEnabled) return;

  const el = DOM.goldenDogged;

  // Remove stale listeners/timeouts from previous spawns
  if (goldenClickHandler) {
    el.removeEventListener('click', goldenClickHandler);
    goldenClickHandler = null;
  }
  if (goldenHideTimeout) {
    clearTimeout(goldenHideTimeout);
    goldenHideTimeout = null;
  }

  el.classList.remove('hidden');

  const x = 100 + Math.random() * (window.innerWidth - 200);
  const y = 100 + Math.random() * (window.innerHeight - 200);
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  const durMult = getPrestigeEffect('golden_duration');
  const duration = 10000 * durMult;

  goldenHideTimeout = setTimeout(() => {
    el.classList.add('hidden');
    if (goldenClickHandler) {
      el.removeEventListener('click', goldenClickHandler);
      goldenClickHandler = null;
    }
    goldenHideTimeout = null;
    scheduleGolden();
  }, duration);

  goldenClickHandler = () => {
    el.classList.add('hidden');
    if (goldenHideTimeout) {
      clearTimeout(goldenHideTimeout);
      goldenHideTimeout = null;
    }
    if (goldenClickHandler) {
      el.removeEventListener('click', goldenClickHandler);
      goldenClickHandler = null;
    }
    collectGolden();
    scheduleGolden();
  };

  el.addEventListener('click', goldenClickHandler);
}

function collectGolden() {
  game.goldensCaught++;
  const rewardMult = getPrestigeEffect('golden_mult');

  const roll = Math.random();
  let reward;

  if (roll < 0.5) {
    // Dogged rain: NERFED — 13-77 seconds of production (was 30-300)
    const seconds = 13 + Math.random() * 64;
    const amount = game.dps * seconds * rewardMult;
    game.doggeds += amount;
    game.totalEarned += amount;
    game.totalEarnedThisRun += amount;
    reward = `🌧️ Dogged Rain! +${formatNumber(amount)} doggeds`;
  } else if (roll < 0.8) {
    // Click frenzy: NERFED from 777x to 200x
    const amount = getClickValue().value * 200 * rewardMult;
    game.doggeds += amount;
    game.totalEarned += amount;
    game.totalEarnedThisRun += amount;
    reward = `👆 Click Frenzy! +${formatNumber(amount)} doggeds`;
  } else {
    // Lucky: NERFED from 5% to 2% of run earnings
    const amount = game.totalEarnedThisRun * 0.02 * rewardMult;
    game.doggeds += amount;
    game.totalEarned += amount;
    game.totalEarnedThisRun += amount;
    reward = `🍀 Lucky! +${formatNumber(amount)} doggeds`;
  }

  showToast(`✨ Golden Dogged: ${reward}`);
  updateDisplay();
  checkAchievements();
}

// ===== RANDOM EVENTS =====
const RANDOM_EVENTS = [
  {
    id: 'dogged_storm',
    name: '🌩️ Dogged Storm!',
    desc: 'All clicks give 5× for 15 seconds!',
    duration: 15000,
    apply: () => { game._eventClickMult = 5; },
    remove: () => { game._eventClickMult = 1; },
  },
  {
    id: 'sigve_blessing',
    name: '🙏 Sigve\'s Blessing!',
    desc: 'DPS doubled for 30 seconds!',
    duration: 30000,
    apply: () => { game._eventDpsMult = 2; },
    remove: () => { game._eventDpsMult = 1; },
  },
  {
    id: 'dogged_fever',
    name: '🤒 Dogged Fever!',
    desc: 'Combo never drops for 20 seconds!',
    duration: 20000,
    apply: () => { game._eventComboFreeze = true; },
    remove: () => { game._eventComboFreeze = false; },
  },
  {
    id: 'dog_parade',
    name: '🐕 Dog Parade!',
    desc: 'Earn 60 seconds of production instantly!',
    duration: 0,
    apply: () => {
      const amount = game.dps * 60;
      game.doggeds += amount;
      game.totalEarned += amount;
      game.totalEarnedThisRun += amount;
    },
    remove: () => {},
  },
  {
    id: 'city_festival',
    name: '🎉 Dog City Festival!',
    desc: 'All production ×3 for 20 seconds!',
    duration: 20000,
    apply: () => { game._eventDpsMult = 3; },
    remove: () => { game._eventDpsMult = 1; },
  },
  {
    id: 'nation_decree',
    name: '📜 Dog Nation Decree!',
    desc: 'Building costs halved for 25 seconds!',
    duration: 25000,
    apply: () => { game._eventCostMult = 0.5; },
    remove: () => { game._eventCostMult = 1; },
  },
];

// Initialize event modifiers on game object
game._eventClickMult = 1;
game._eventDpsMult = 1;
game._eventComboFreeze = false;
game._eventCostMult = 1;

let eventTimeout = null;

function scheduleRandomEvent() {
  if (eventTimeout) clearTimeout(eventTimeout);
  // Events every 3-8 minutes
  const delay = (180 + Math.random() * 300) * 1000;
  eventTimeout = setTimeout(() => {
    eventTimeout = null;
    triggerRandomEvent();
  }, delay);
}

function triggerRandomEvent() {
  // Don't trigger if one is already active
  if (game.activeEvent) {
    scheduleRandomEvent();
    return;
  }

  const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  game.eventsTriggered = (game.eventsTriggered || 0) + 1;

  if (event.duration > 0) {
    game.activeEvent = event.id;
    event.apply();
    showEventBanner(event);

    game.activeEventTimer = setTimeout(() => {
      event.remove();
      game.activeEvent = null;
      game.activeEventTimer = null;
      hideEventBanner();
      recalculateDps();
      updateDisplay();
      scheduleRandomEvent();
    }, event.duration);
  } else {
    // Instant event
    event.apply();
    showToast(`⚡ ${event.name} ${event.desc}`);
    updateDisplay();
    checkAchievements();
    scheduleRandomEvent();
  }

  recalculateDps();
  updateDisplay();
  checkAchievements();
}

function showEventBanner(event) {
  let banner = document.querySelector('.event-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'event-banner';
    document.body.appendChild(banner);
  }
  banner.innerHTML = `<strong>${event.name}</strong> <span>${event.desc}</span>`;
  banner.classList.add('show');
}

function hideEventBanner() {
  const banner = document.querySelector('.event-banner');
  if (banner) banner.classList.remove('show');
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

  // --- Realm Selector ---
  if (game.prestigeLevel >= 1) {
    const realmSection = document.createElement('div');
    realmSection.className = 'realm-section';
    realmSection.innerHTML = `<h4 class="realm-section-title">🌍 Realms <span style="font-size:0.7rem;color:#888">(next ascension)</span></h4>`;

    for (const realm of REALMS) {
      const unlocked = isRealmUnlocked(realm);
      const isSelected = game.selectedRealm === realm.id;
      const isCurrent = game.realm === realm.id;
      const completions = game.realmCompletions[realm.id] || 0;

      const el = document.createElement('div');
      el.className = `shop-item realm-item ${isSelected ? 'realm-selected' : ''} ${!unlocked ? 'realm-locked' : ''}`;
      el.style.borderColor = unlocked ? realm.color : '';
      el.innerHTML = `
        <div class="shop-item-icon">${unlocked ? realm.icon : '🔒'}</div>
        <div class="shop-item-info">
          <div class="shop-item-name" style="color:${unlocked ? realm.color : '#555'}">${realm.name}${isCurrent ? ' 📍' : ''}${isSelected && !isCurrent ? ' ✓' : ''}</div>
          <div class="shop-item-desc">${unlocked ? realm.desc : `Unlocks at Prestige ${realm.unlock}`}</div>
          ${unlocked && realm.id !== 'prime' ? `<div class="shop-item-cost" style="color:${realm.color}">Completed: ${completions}×${game.fastestRun[realm.id] ? ` · Best: ${formatTime(game.fastestRun[realm.id])}` : ''}</div>` : ''}
        </div>
        ${unlocked && !isSelected ? '<div class="realm-select-tag">SELECT</div>' : ''}
        ${isSelected ? '<div class="realm-select-tag selected">SELECTED</div>' : ''}
      `;
      if (unlocked && !isSelected) {
        el.addEventListener('click', () => {
          game.selectedRealm = realm.id;
          renderPrestigeShop();
          showToast(`${realm.icon} ${realm.name} selected for next ascension`);
        });
      }
      realmSection.appendChild(el);
    }

    c.appendChild(realmSection);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'prestige-shop-divider';
    divider.innerHTML = '<h4 class="realm-section-title">💀 Permanent Upgrades</h4>';
    c.appendChild(divider);
  }

  // --- Prestige Upgrades ---
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

// ===== RENDER PRODUCTION BREAKDOWN =====
function renderProductionBreakdown() {
  const c = DOM.productionBreakdown;
  if (!c) return;
  c.innerHTML = '';

  let globalMult = 1;
  for (const u of UPGRADES) {
    if (u.type === 'global_mult' && game.upgrades[u.id]) globalMult *= u.value;
  }
  const soulBoost = getSoulBoostMultiplier();
  const realmMult = getRealmDpsMult();
  const eventMult = game._eventDpsMult || 1;
  const totalGlobal = globalMult * soulBoost * realmMult * eventMult;

  let totalRawDps = 0;
  for (const b of BUILDINGS) {
    const state = game.buildings[b.id];
    if (!state || state.count === 0) continue;
    const rawDps = b.baseDps * state.count * state.multiplier;
    totalRawDps += rawDps;
    const finalDps = rawDps * totalGlobal;
    const pct = game.dps > 0 ? (finalDps / game.dps * 100).toFixed(1) : '0';

    const el = document.createElement('div');
    el.className = 'production-row';
    el.innerHTML = `
      <span class="prod-icon">${b.icon}</span>
      <span class="prod-name">${b.name} <span class="prod-count">×${state.count}</span></span>
      <span class="prod-dps">${formatNumber(finalDps)}/s</span>
      <span class="prod-pct">${pct}%</span>
      <div class="prod-bar"><div class="prod-bar-fill" style="width:${pct}%"></div></div>
    `;
    c.appendChild(el);
  }

  // Update summary
  if (DOM.prodTotalDps) DOM.prodTotalDps.textContent = formatNumber(game.dps) + '/s';
  if (DOM.prodSoulBoost) DOM.prodSoulBoost.textContent = '×' + soulBoost.toFixed(2);
  if (DOM.prodRealmMult) DOM.prodRealmMult.textContent = '×' + realmMult.toFixed(1);
  if (DOM.prodEventMult) {
    DOM.prodEventMult.textContent = '×' + eventMult.toFixed(1);
    DOM.prodEventMult.style.color = eventMult > 1 ? '#4caf50' : '';
  }
  if (DOM.prodGlobalMult) DOM.prodGlobalMult.textContent = '×' + globalMult.toFixed(2);
  if (DOM.prodClickPower) DOM.prodClickPower.textContent = formatNumber(getClickValue().value);
  if (DOM.prodEfficiency) {
    const totalBuildingCost = BUILDINGS.reduce((sum, b) => {
      const state = game.buildings[b.id];
      if (!state || state.count === 0) return sum;
      let cost = 0;
      for (let i = 0; i < state.count; i++) {
        cost += b.baseCost * Math.pow(COST_MULTIPLIER, i);
      }
      return sum + cost;
    }, 0);
    if (totalBuildingCost > 0 && game.dps > 0) {
      DOM.prodEfficiency.textContent = formatNumber(game.dps / totalBuildingCost * 1000) + ' dps/1K spent';
    } else {
      DOM.prodEfficiency.textContent = '-';
    }
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

  // Realm badge
  const realm = getCurrentRealm();
  if (DOM.realmBadge) {
    DOM.realmBadge.textContent = `${realm.icon} ${realm.name}`;
    DOM.realmBadge.style.color = realm.color;
    DOM.realmBadge.style.borderColor = realm.color + '55';
    DOM.realmBadge.style.background = realm.color + '15';
  }

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
  if (DOM.statEvents) DOM.statEvents.textContent = game.eventsTriggered || 0;

  if (DOM.statRealm) {
    DOM.statRealm.textContent = `${realm.icon} ${realm.name}`;
    DOM.statRealm.style.color = realm.color;
  }

  const seconds = Math.floor((Date.now() - game.startTime) / 1000);
  DOM.statTimePlayed.textContent = formatTime(seconds);

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

  const safeDelta = Math.min(delta, 60);

  // ── Integrity guard: doggeds ──────────────────────────────────────────
  // Between ticks, only DPS + legitimate click/golden additions are allowed.
  // We snapshot expected values at tick-start (set at end of previous tick).
  // If current value exceeds last snapshot + generous leeway → tampered.
  if (game._tickDoggeds > 0) {
    const maxPossibleGain = game.dps * safeDelta * 150 + 1e6; // 150× covers largest goldens
    const actualGain = game.doggeds - game._tickDoggeds;
    if (actualGain > maxPossibleGain && maxPossibleGain < game.doggeds * 0.9) {
      // Anomalous jump — revert to snapshot + legit DPS
      const legitimateGain = game.dps * safeDelta;
      const excess = actualGain - legitimateGain - maxPossibleGain;
      game.doggeds -= excess;
      game.totalEarned -= excess;
      game.totalEarnedThisRun = Math.max(0, game.totalEarnedThisRun - excess);
      AC.integrityWarnings++;
    }
  }

  // ── Integrity guard: souls ────────────────────────────────────────────
  // Souls must never exceed _verifiedSouls (set by doPrestige / buyPrestigeUpgrade)
  if (game._verifiedSouls >= 0 && game.souls > game._verifiedSouls) {
    game.souls = game._verifiedSouls;
    AC.integrityWarnings++;
  }
  if (game._verifiedTotalSouls >= 0 && game.totalSoulsEarned > game._verifiedTotalSouls) {
    game.totalSoulsEarned = game._verifiedTotalSouls;
    AC.integrityWarnings++;
  }

  if (game.dps > 0) {
    const earned = game.dps * safeDelta;
    game.doggeds += earned;
    game.totalEarned += earned;
    game.totalEarnedThisRun += earned;
  }

  // Update snapshots for next tick
  game._tickDoggeds = game.doggeds;
  game._tickTotalEarned = game.totalEarned;

  if (!AC.sanityCheck(game)) {
    console.warn('Anti-cheat: sanity check failed');
  }

  updateDisplay();

  shopRenderCounter++;
  if (shopRenderCounter >= 30) {
    shopRenderCounter = 0;
    renderShop();
    renderProductionBreakdown();
    checkAchievements();
  }
}

// ===== SAVE / LOAD =====
const SAVE_KEY = 'dogged_clicker_v3';
let lastAutoSaveTime = 0;

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
    eventsTriggered: game.eventsTriggered,
    maxCombo: game.maxCombo,
    startTime: game.startTime,
    lastSave: Date.now(),
    // v3 fields
    realm: game.realm,
    selectedRealm: game.selectedRealm,
    realmCompletions: game.realmCompletions,
    runStartTime: game.runStartTime,
    fastestRun: game.fastestRun,
    version: 3.2,
  };
  data._checksum = AC.checksum(data);
  return data;
}

function saveGame(silent = false) {
  const data = getSaveData();
  // XOR-encode the JSON — raw localStorage value is no longer valid JSON,
  // making manual save editing via the console non-trivial.
  localStorage.setItem(SAVE_KEY, AC.encodeSave(JSON.stringify(data)));
  lastAutoSaveTime = Date.now();
  if (!silent) showToast('💾 Saved!');
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    // Try XOR-decoded format first; fall back to plain JSON for legacy saves
    let jsonStr = AC.decodeSave(raw);
    if (!jsonStr) jsonStr = raw; // legacy plain-JSON save

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      data = JSON.parse(raw); // last-resort plain parse
    }

    const { ok, tampered } = AC.validate(data);
    if (tampered) {
      // Checksum mismatch on a decoded save → save was tampered.
      // Keep structural progress (prestige level, realm) but wipe currencies.
      console.warn('Save integrity check failed — resetting currencies');
      data.doggeds = 0;
      data.souls = 0;
      // totalSoulsEarned and totalEarned kept so achievements/prestige-level stay readable
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
    game.eventsTriggered = data.eventsTriggered || 0;
    game.maxCombo = data.maxCombo || 0;
    game.startTime = data.startTime || Date.now();

    // v3 migration
    game.realm = data.realm || 'prime';
    game.selectedRealm = data.selectedRealm || game.realm;
    game.realmCompletions = data.realmCompletions || {};
    game.runStartTime = data.runStartTime || Date.now();
    game.fastestRun = data.fastestRun || {};

    // Initialise anti-cheat runtime refs to loaded values
    game._verifiedSouls = game.souls;
    game._verifiedTotalSouls = game.totalSoulsEarned;

    // Offline earnings
    if (data.lastSave) {
      recalculateDps();
      const offlineSeconds = (Date.now() - data.lastSave) / 1000;
      const offlineMult = getPrestigeEffect('offline_mult');
      if (game.dps > 0 && offlineSeconds > 10 && offlineMult > 0) {
        const maxOffline = 8 * 3600;
        const effectiveSeconds = Math.min(offlineSeconds, maxOffline);
        const offlineEarned = game.dps * effectiveSeconds * offlineMult;
        game.doggeds += offlineEarned;
        game.totalEarned += offlineEarned;
        game.totalEarnedThisRun += offlineEarned;

        // Store for dismissible banner (shown after DOM is ready)
        game._offlineBanner = {
          earned: offlineEarned,
          time: offlineSeconds,
        };
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

    // Validate checksum on imported saves \u2014 wipe currencies if tampered
    const { tampered } = AC.validate(data);
    if (tampered) {
      data.doggeds = 0;
      data.souls = 0;
      showToast('\u26a0\ufe0f Imported save checksum mismatch \u2014 currencies reset');
    }

    // Re-encode before writing so localStorage stays obfuscated
    localStorage.setItem(SAVE_KEY, AC.encodeSave(JSON.stringify(data)));
    DOM.importModal.classList.add('hidden');
    location.reload();
  } catch (e) {
    showToast('\u274c Invalid save code');
  }
}

function resetGame() {
  if (!confirm('Reset ALL progress? This cannot be undone!')) return;
  if (!confirm('Are you REALLY sure? All doggeds, souls, everything — gone forever.')) return;
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SCORE_NAME_KEY);
  localStorage.removeItem(PLAYER_ID_KEY);
  location.reload();
}

// ===== LEADERBOARD =====
let leaderboardAutoRefresh = null;
let lastLeaderboardFetch = 0;
let scoreAutoSubmitInterval = null;
const SCORE_NAME_KEY = 'dogged_player_name';
const PLAYER_ID_KEY  = 'dogged_player_id';

// Returns a persistent UUID for this browser/device, creating one if needed
function getOrCreatePlayerId() {
  let pid = localStorage.getItem(PLAYER_ID_KEY);
  if (!pid) {
    pid = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));
    localStorage.setItem(PLAYER_ID_KEY, pid);
  }
  return pid;
}

async function fetchLeaderboard(silent = false) {
  const isSilent = silent === true;
  const list = DOM.leaderboardList;

  // If not silent and list is empty, show loading
  if (!isSilent || list.innerHTML.trim() === '' || list.querySelector('.leaderboard-loading')) {
    list.innerHTML = '<div class="leaderboard-loading">Loading...</div>';
  }

  try {
    const res = await fetch('/api/leaderboard?t=' + Date.now()); // cache-bust
    const data = await res.json();

    lastLeaderboardFetch = Date.now();
    updateLeaderboardTimestamp();

    if (!data.ok || !data.leaderboard || data.leaderboard.length === 0) {
      list.innerHTML = `<div class="leaderboard-loading">${data.message || 'No entries yet. Be the first!'}</div>`;
      return;
    }

    list.innerHTML = '';
    data.leaderboard.forEach((entry, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const realmIcon = REALMS.find(r => r.id === entry.realm)?.icon || '\uD83C\uDF0D';
      const el = document.createElement('div');
      el.className = 'lb-entry';
      el.innerHTML = `
        <span class="lb-rank ${rankClass}">#${i + 1}</span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <span class="lb-score">${formatNumber(entry.score)}</span>
        <span class="lb-prestige">\u2B50${entry.prestige || 0}</span>
        <span class="lb-realm">${realmIcon}</span>
      `;
      list.appendChild(el);
    });
  } catch (e) {
    if (!isSilent) {
      list.innerHTML = '<div class="leaderboard-loading">Could not load leaderboard</div>';
    }
    console.error('Leaderboard fetch error:', e);
  }
}

function updateLeaderboardTimestamp() {
  const el = $('lbLastUpdated');
  if (!el || !lastLeaderboardFetch) return;
  const secs = Math.floor((Date.now() - lastLeaderboardFetch) / 1000);
  if (secs < 60) el.textContent = `Updated just now`;
  else el.textContent = `Updated ${Math.floor(secs / 60)}m ago`;
}

function startLeaderboardAutoRefresh() {
  if (leaderboardAutoRefresh) clearInterval(leaderboardAutoRefresh);
  // Refresh every 10 minutes silently
  leaderboardAutoRefresh = setInterval(() => {
    fetchLeaderboard(true);
  }, 10 * 60 * 1000);
  // Also update the "x min ago" timestamp every 30 seconds
  setInterval(updateLeaderboardTimestamp, 30000);
}

async function submitScore(silent = false) {
  const isSilent = silent === true;

  const name = isSilent
    ? localStorage.getItem(SCORE_NAME_KEY)
    : DOM.playerName.value.trim();

  if (!name || name.length < 1 || name.length > 20) {
    if (!isSilent) showToast('Enter a name (1-20 chars)');
    return;
  }

  const pid = getOrCreatePlayerId();

  // Save name for future auto-submits and lock the input
  if (!isSilent) {
    localStorage.setItem(SCORE_NAME_KEY, name);
    DOM.playerName.value = name;
    DOM.playerName.readOnly = true;
    DOM.playerName.title = 'Name locked — clears on full reset';
    updateTrackingStatus(name);
    startScoreAutoSubmit();
  }

  const ts = Date.now();
  const payload = {
    name,
    score: Math.floor(game.totalEarned),
    prestige: game.prestigeLevel,
    ts,
    pid,
    stats: {
      clicks: game.totalClicks,
      dps: Math.floor(game.dps),
      souls: game.totalSoulsEarned,
      realm: game.realm,
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
      if (!isSilent) showToast(`🌍 Submitted! Rank #${data.rank}`);
      fetchLeaderboard(true);
    } else if (!isSilent) {
      showToast(`❌ ${data.error || 'Submit failed'}`);
    }
  } catch (e) {
    if (!isSilent) showToast('❌ Could not submit score');
  }
}

function updateTrackingStatus(name) {
  const el = DOM.trackingStatus;
  if (!el) return;
  if (name) {
    el.innerHTML = `📡 Tracking as <strong>${escapeHtml(name)}</strong> — score updates every 1 min`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function startScoreAutoSubmit() {
  if (scoreAutoSubmitInterval) clearInterval(scoreAutoSubmitInterval);
  // Submit score silently every 1 minute
  scoreAutoSubmitInterval = setInterval(() => {
    submitScore(true);
  }, 1 * 60 * 1000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== TABS =====
function setupTabs() {
  document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab)?.classList.add('active');
    });
  });

  document.querySelectorAll('.right-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.right-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.right-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $('rtab-' + tab.dataset.rtab)?.classList.add('active');
      if (tab.dataset.rtab === 'leaderboard') fetchLeaderboard(false);
      if (tab.dataset.rtab === 'production') renderProductionBreakdown();
    });
  });

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
  const realm = getCurrentRealm();
  const particleColor = realm.id === 'prime' ? 'rgba(255,107,53,0.03)' :
                        realm.id === 'frost' ? 'rgba(100,181,246,0.04)' :
                        realm.id === 'inferno' ? 'rgba(239,83,80,0.04)' :
                        realm.id === 'void' ? 'rgba(156,39,176,0.04)' :
                        realm.id === 'beyond' ? 'rgba(255,215,0,0.04)' :
                        'rgba(255,107,53,0.03)';
  const particleText = realm.id === 'frost' ? (Math.random() > 0.5 ? '❄️' : 'dogged') :
                       realm.id === 'inferno' ? (Math.random() > 0.5 ? '🔥' : 'dogged') :
                       realm.id === 'void' ? (Math.random() > 0.5 ? '🕳️' : 'dogged') :
                       realm.id === 'beyond' ? (Math.random() > 0.5 ? '✨' : 'dogged') :
                       (Math.random() > 0.5 ? 'dogged' : '🐶');

  p.style.cssText = `
    position:absolute;font-family:'Bangers',cursive;
    color:${particleColor};font-size:${1+Math.random()*1.2}rem;
    left:${Math.random()*100}%;top:-30px;pointer-events:none;
    animation:particleFall ${10+Math.random()*15}s linear forwards;white-space:nowrap;
  `;
  p.textContent = particleText;
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

// ===== AUTO-SAVE (XOR-encoded, every 10s) =====
setInterval(() => {
  saveGame(true);
}, 10000);

// Save on page unload so no progress is lost on refresh/close
window.addEventListener('beforeunload', () => {
  saveGame(true);
});

// ===== ANTI-DEVTOOLS (light) =====
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
  renderProductionBreakdown();
  updateDisplay();

  // Show offline earnings banner if applicable
  if (game._offlineBanner) {
    const b = game._offlineBanner;
    const banner = document.createElement('div');
    banner.className = 'offline-banner';
    banner.innerHTML = `
      <div class=\"offline-banner-content\">
        <strong>\ud83d\udc4b Welcome back!</strong>
        <span>You earned <strong>${formatNumber(b.earned)}</strong> doggeds while away (${formatTime(b.time)})</span>
      </div>
      <button class=\"offline-banner-close\">\u2715</button>
    `;
    banner.querySelector('.offline-banner-close').addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);
    // Auto-dismiss after 10 seconds
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 10000);
    delete game._offlineBanner;
  }

  // Events
  DOM.bigClicker.addEventListener('click', handleClick);
  DOM.saveBtn.addEventListener('click', () => saveGame(false));
  DOM.exportBtn.addEventListener('click', exportSave);
  DOM.importBtn.addEventListener('click', importSave);
  DOM.resetBtn.addEventListener('click', resetGame);
  DOM.prestigeBtn.addEventListener('click', showPrestigeModal);
  DOM.confirmPrestige.addEventListener('click', doPrestige);
  DOM.cancelPrestige.addEventListener('click', () => DOM.prestigeModal.classList.add('hidden'));
  DOM.confirmImport.addEventListener('click', doImport);
  DOM.cancelImport.addEventListener('click', () => DOM.importModal.classList.add('hidden'));
  DOM.submitScoreBtn.addEventListener('click', () => submitScore(false));
  DOM.refreshLeaderboard.addEventListener('click', () => fetchLeaderboard(false));

  setupTabs();
  setupMobileNav();

  // Game loop
  game.lastTick = Date.now();
  setInterval(gameTick, 1000 / 30);

  // Particles
  setInterval(spawnParticle, 2500);

  // Golden doggeds
  scheduleGolden();

  // Random events
  scheduleRandomEvent();

  // Leaderboard fetch + auto-refresh
  setTimeout(fetchLeaderboard, 2000);
  startLeaderboardAutoRefresh();

  // Restore saved player name and start auto-submit if already registered
  const savedName = localStorage.getItem(SCORE_NAME_KEY);
  if (savedName) {
    DOM.playerName.value = savedName;
    DOM.playerName.readOnly = true;
    DOM.playerName.title = 'Name locked — clears on full reset';
    updateTrackingStatus(savedName);
    startScoreAutoSubmit();
    // Submit current score on load so it's always fresh
    setTimeout(() => submitScore(true), 5000);
  }

  // Apply realm theme on load
  applyRealmTheme();

  // Version migration: clear old save keys so everyone is on the same version
  const oldKeys = ['dogged_clicker_save', 'dogged_clicker_v1', 'dogged_clicker_v2'];
  oldKeys.forEach(k => localStorage.removeItem(k));

  // Version indicator
  const versionEl = document.createElement('div');
  versionEl.className = 'version-indicator';
  versionEl.textContent = `v${GAME_VERSION}`;
  document.body.appendChild(versionEl);

  // Auto-save status indicator
  const saveIndicator = document.createElement('div');
  saveIndicator.className = 'save-indicator';
  saveIndicator.id = 'saveIndicator';
  saveIndicator.textContent = '💾 Saved';
  document.body.appendChild(saveIndicator);
  setInterval(() => {
    if (!lastAutoSaveTime) return;
    const ago = Math.floor((Date.now() - lastAutoSaveTime) / 1000);
    saveIndicator.textContent = ago < 3 ? '💾 Saved' : `💾 ${ago}s ago`;
    saveIndicator.classList.toggle('fresh', ago < 3);
  }, 1000);
});

// ===== REALM THEME =====
function applyRealmTheme() {
  const realm = getCurrentRealm();
  document.documentElement.style.setProperty('--realm-color', realm.color);

  // Update body background hint based on realm
  if (realm.id === 'frost') {
    document.body.style.background = 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 100%)';
  } else if (realm.id === 'inferno') {
    document.body.style.background = 'linear-gradient(135deg, #1a0a0a 0%, #2a0d0d 100%)';
  } else if (realm.id === 'void') {
    document.body.style.background = 'linear-gradient(135deg, #0a0a1a 0%, #1a0d2a 100%)';
  } else if (realm.id === 'beyond') {
    document.body.style.background = 'linear-gradient(135deg, #1a1a0a 0%, #2a2a0d 100%)';
  } else {
    document.body.style.background = '';
  }
}

})(); // End IIFE
