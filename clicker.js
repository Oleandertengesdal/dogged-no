// ============================================================
// DOGGED CLICKER — An idle clicker game for Sigve
// ============================================================

// ===== GAME STATE =====
const game = {
  doggeds: 0,
  totalEarned: 0,
  totalClicks: 0,
  clickPower: 1,
  clickMultiplier: 1,
  dps: 0, // doggeds per second
  buildings: {},
  upgrades: {},
  achievements: {},
  startTime: Date.now(),
  lastSave: Date.now(),
  lastTick: Date.now(),
};

// ===== BUILDINGS DATA =====
const BUILDINGS = [
  {
    id: 'echo',
    name: "Sigve's Echo",
    icon: '🗣️',
    desc: 'A faint echo of Sigve whispering "dogged" into the void',
    baseCost: 15,
    baseDps: 0.1,
    costMultiplier: 1.15,
  },
  {
    id: 'parrot',
    name: 'Dogged Parrot',
    icon: '🦜',
    desc: 'A trained parrot that only knows one word. Guess which.',
    baseCost: 100,
    baseDps: 1,
    costMultiplier: 1.15,
  },
  {
    id: 'groupchat',
    name: 'Group Chat Bot',
    icon: '💬',
    desc: 'Auto-spams "dogged" in every group chat Sigve is in',
    baseCost: 1100,
    baseDps: 8,
    costMultiplier: 1.15,
  },
  {
    id: 'printer',
    name: 'Dogged Printer',
    icon: '🖨️',
    desc: 'Prints "dogged" on every piece of paper in the office',
    baseCost: 12000,
    baseDps: 47,
    costMultiplier: 1.15,
  },
  {
    id: 'factory',
    name: 'Dogged Factory',
    icon: '🏭',
    desc: 'Mass-produces dogged merchandise nobody asked for',
    baseCost: 130000,
    baseDps: 260,
    costMultiplier: 1.15,
  },
  {
    id: 'university',
    name: 'Dogged University',
    icon: '🎓',
    desc: 'Offers a PhD in Dogged Studies. Sigve is the dean.',
    baseCost: 1400000,
    baseDps: 1400,
    costMultiplier: 1.15,
  },
  {
    id: 'satellite',
    name: 'Dogged Satellite',
    icon: '🛰️',
    desc: 'Broadcasts "dogged" to every corner of the planet',
    baseCost: 20000000,
    baseDps: 7800,
    costMultiplier: 1.15,
  },
  {
    id: 'clonelab',
    name: 'Sigve Clone Lab',
    icon: '🧬',
    desc: 'Clones of Sigve, each saying "dogged" independently',
    baseCost: 330000000,
    baseDps: 44000,
    costMultiplier: 1.15,
  },
  {
    id: 'dimension',
    name: 'Dogged Dimension',
    icon: '🌌',
    desc: 'An entire parallel universe where everything is dogged',
    baseCost: 5100000000,
    baseDps: 260000,
    costMultiplier: 1.15,
  },
  {
    id: 'singularity',
    name: 'Dogged Singularity',
    icon: '🕳️',
    desc: 'All of reality collapses into a single, infinite "dogged"',
    baseCost: 75000000000,
    baseDps: 1600000,
    costMultiplier: 1.15,
  },
];

// ===== UPGRADES DATA =====
const UPGRADES = [
  // Click power upgrades
  { id: 'stronger_finger', name: 'Stronger Finger', icon: '👆', desc: 'Sigve does finger exercises. Clicks give 2x.', cost: 100, type: 'click_mult', value: 2 },
  { id: 'double_tap', name: 'Double Tap', icon: '👆👆', desc: 'Two fingers, twice the dogged. Clicks give 2x.', cost: 5000, type: 'click_mult', value: 2 },
  { id: 'power_slap', name: 'Power Slap', icon: '🫲', desc: 'Full palm dogged energy. Clicks give 3x.', cost: 50000, type: 'click_mult', value: 3 },
  { id: 'fist_bump', name: 'Fist of Dogged', icon: '👊', desc: 'Channel pure dogged through your fist. Clicks give 5x.', cost: 5000000, type: 'click_mult', value: 5 },
  { id: 'mind_click', name: 'Mind Click', icon: '🧠', desc: 'Think "dogged" and it counts. Clicks give 10x.', cost: 500000000, type: 'click_mult', value: 10 },

  // Building multiplier upgrades  
  { id: 'echo_boost', name: 'Louder Echo', icon: '📢', desc: "Sigve's Echoes are 2x louder", cost: 1000, type: 'building_mult', building: 'echo', value: 2, req: { building: 'echo', count: 10 } },
  { id: 'parrot_seeds', name: 'Premium Seeds', icon: '🌻', desc: 'Better fed parrots say dogged 2x faster', cost: 5000, type: 'building_mult', building: 'parrot', value: 2, req: { building: 'parrot', count: 10 } },
  { id: 'chat_spam', name: 'Auto-Reply All', icon: '📱', desc: 'Bots now reply to themselves. 2x output.', cost: 55000, type: 'building_mult', building: 'groupchat', value: 2, req: { building: 'groupchat', count: 10 } },
  { id: 'color_ink', name: 'Color Ink', icon: '🎨', desc: 'Printers now print dogged in COLOR. 2x.', cost: 600000, type: 'building_mult', building: 'printer', value: 2, req: { building: 'printer', count: 10 } },
  { id: 'overtime', name: 'Overtime Shift', icon: '⏰', desc: 'Factory runs 24/7. 2x production.', cost: 6500000, type: 'building_mult', building: 'factory', value: 2, req: { building: 'factory', count: 10 } },
  { id: 'tenure', name: 'Tenure', icon: '📜', desc: 'Professors can say dogged with impunity. 2x.', cost: 70000000, type: 'building_mult', building: 'university', value: 2, req: { building: 'university', count: 10 } },
  { id: 'boost_signal', name: 'Signal Boost', icon: '📡', desc: 'Satellites reach Mars. 2x coverage.', cost: 1000000000, type: 'building_mult', building: 'satellite', value: 2, req: { building: 'satellite', count: 10 } },
  { id: 'gene_edit', name: 'CRISPR Dogged', icon: '🧪', desc: "Clones are genetically optimized for dogged. 2x.", cost: 16000000000, type: 'building_mult', building: 'clonelab', value: 2, req: { building: 'clonelab', count: 10 } },

  // DPS % boost
  { id: 'coffee', name: "Sigve's Coffee", icon: '☕', desc: 'All buildings produce 10% more doggeds', cost: 50000, type: 'global_mult', value: 1.1 },
  { id: 'energy_drink', name: 'Monster Dogged', icon: '🥤', desc: 'All buildings produce 15% more doggeds', cost: 5000000, type: 'global_mult', value: 1.15 },
  { id: 'dogged_spirit', name: 'Dogged Spirit', icon: '✨', desc: 'The spirit of dogged flows. All +25%.', cost: 500000000, type: 'global_mult', value: 1.25 },
];

// ===== ACHIEVEMENTS DATA =====
const ACHIEVEMENTS = [
  { id: 'first_click', name: 'Baby Steps', icon: '👶', desc: 'Click the button for the first time', check: () => game.totalClicks >= 1 },
  { id: 'clicks_100', name: 'Clicker', icon: '👆', desc: 'Click 100 times', check: () => game.totalClicks >= 100 },
  { id: 'clicks_1000', name: 'Carpal Tunnel', icon: '🤕', desc: 'Click 1,000 times', check: () => game.totalClicks >= 1000 },
  { id: 'clicks_10000', name: 'Finger Destroyer', icon: '💀', desc: 'Click 10,000 times', check: () => game.totalClicks >= 10000 },
  { id: 'dogged_100', name: 'First Hundred', icon: '💯', desc: 'Earn 100 doggeds', check: () => game.totalEarned >= 100 },
  { id: 'dogged_1k', name: 'Kilo Dogged', icon: '🏋️', desc: 'Earn 1,000 doggeds', check: () => game.totalEarned >= 1000 },
  { id: 'dogged_1m', name: 'Mega Dogged', icon: '🚀', desc: 'Earn 1,000,000 doggeds', check: () => game.totalEarned >= 1000000 },
  { id: 'dogged_1b', name: 'Giga Dogged', icon: '🌍', desc: 'Earn 1,000,000,000 doggeds', check: () => game.totalEarned >= 1000000000 },
  { id: 'dogged_1t', name: 'Tera Dogged', icon: '🌌', desc: 'Earn 1,000,000,000,000 doggeds', check: () => game.totalEarned >= 1000000000000 },
  { id: 'building_1', name: 'Investor', icon: '📈', desc: 'Buy your first building', check: () => getTotalBuildings() >= 1 },
  { id: 'building_50', name: 'Tycoon', icon: '🏢', desc: 'Own 50 buildings', check: () => getTotalBuildings() >= 50 },
  { id: 'building_100', name: 'Dogged Empire', icon: '👑', desc: 'Own 100 buildings', check: () => getTotalBuildings() >= 100 },
  { id: 'dps_100', name: 'Passive Income', icon: '💤', desc: 'Reach 100 doggeds per second', check: () => game.dps >= 100 },
  { id: 'dps_10000', name: 'Dogged Machine', icon: '⚙️', desc: 'Reach 10,000 doggeds per second', check: () => game.dps >= 10000 },
  { id: 'dps_1m', name: 'Unstoppable', icon: '🔥', desc: 'Reach 1M doggeds per second', check: () => game.dps >= 1000000 },
  { id: 'all_buildings', name: 'Gotta Catch Em All', icon: '🏆', desc: 'Own at least 1 of every building', check: () => BUILDINGS.every(b => (game.buildings[b.id]?.count || 0) >= 1) },
];

// ===== SIGVE QUOTES (on click) =====
const CLICK_QUOTES = [
  '"dogged"',
  '"that\'s dogged"',
  '"so dogged bro"',
  '"absolutely dogged"',
  '"mega dogged"',
  '"pure dogged energy"',
  '"dogged moment"',
  '"that hits different. dogged different."',
  '"dogged af"',
  '"lowkey dogged"',
  '"highkey dogged"',
  '"certified dogged"',
  '"more dogged = more better"',
  '"if it ain\'t dogged, I don\'t want it"',
  '"dogged is a lifestyle"',
  '"I\'m not addicted to dogged. dogged is addicted to ME"',
  '"dogged? dogged."',
  '"everything is dogged if you believe"',
  '*clears throat* "dogged"',
  '"why say many word when dogged do trick"',
];

// ===== DOM ELEMENTS =====
const DOM = {
  doggedCount: document.getElementById('doggedCount'),
  dpsDisplay: document.getElementById('dpsDisplay'),
  clickPowerDisplay: document.getElementById('clickPowerDisplay'),
  bigClicker: document.getElementById('bigClicker'),
  clickRing: document.getElementById('clickRing'),
  sigveQuote: document.getElementById('sigveQuote'),
  buildingsContainer: document.getElementById('buildingsContainer'),
  upgradesContainer: document.getElementById('upgradesContainer'),
  achievementsContainer: document.getElementById('achievementsContainer'),
  statTotalEarned: document.getElementById('statTotalEarned'),
  statTotalClicks: document.getElementById('statTotalClicks'),
  statPerClick: document.getElementById('statPerClick'),
  statPerSecond: document.getElementById('statPerSecond'),
  statBuildings: document.getElementById('statBuildings'),
  statTimePlayed: document.getElementById('statTimePlayed'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  particles: document.getElementById('particles'),
};

// ===== HELPERS =====
function formatNumber(n) {
  if (n < 1000) return Math.floor(n).toLocaleString();
  
  const suffixes = [
    { value: 1e15, suffix: 'Q' },
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ];
  
  for (const { value, suffix } of suffixes) {
    if (n >= value) {
      const formatted = (n / value).toFixed(n >= value * 10 ? 1 : 2);
      return formatted + suffix;
    }
  }
  return Math.floor(n).toLocaleString();
}

function getBuildingCost(building) {
  const data = BUILDINGS.find(b => b.id === building.id);
  const count = game.buildings[building.id]?.count || 0;
  return Math.floor(data.baseCost * Math.pow(data.costMultiplier, count));
}

function getBuildingDps(building) {
  const data = BUILDINGS.find(b => b.id === building.id);
  const state = game.buildings[building.id] || { count: 0, multiplier: 1 };
  return data.baseDps * state.count * state.multiplier;
}

function getTotalBuildings() {
  return Object.values(game.buildings).reduce((sum, b) => sum + (b.count || 0), 0);
}

function getClickValue() {
  return game.clickPower * game.clickMultiplier;
}

function recalculateDps() {
  let globalMult = 1;
  // Apply global multiplier upgrades
  for (const upgrade of UPGRADES) {
    if (upgrade.type === 'global_mult' && game.upgrades[upgrade.id]) {
      globalMult *= upgrade.value;
    }
  }

  let total = 0;
  for (const building of BUILDINGS) {
    total += getBuildingDps(building);
  }
  game.dps = total * globalMult;
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== CLICK HANDLER =====
function handleClick(e) {
  const value = getClickValue();
  game.doggeds += value;
  game.totalEarned += value;
  game.totalClicks++;

  // Visual feedback
  DOM.bigClicker.classList.remove('clicked');
  void DOM.bigClicker.offsetWidth; // reflow
  DOM.bigClicker.classList.add('clicked');
  
  // Ring effect
  const ring = DOM.clickRing;
  ring.classList.remove('active');
  void ring.offsetWidth;
  ring.classList.add('active');

  // Counter bump
  DOM.doggedCount.classList.add('bump');
  setTimeout(() => DOM.doggedCount.classList.remove('bump'), 100);

  // Floating number
  spawnClickFloat(e, value);

  // Random quote (10% chance)
  if (Math.random() < 0.1) {
    DOM.sigveQuote.textContent = CLICK_QUOTES[Math.floor(Math.random() * CLICK_QUOTES.length)];
    DOM.sigveQuote.style.opacity = 1;
    setTimeout(() => { DOM.sigveQuote.style.opacity = 0; }, 2000);
  }

  updateDisplay();
  checkAchievements();
}

function spawnClickFloat(e, value) {
  const float = document.createElement('div');
  float.className = 'click-float';
  float.textContent = '+' + formatNumber(value);
  
  const rect = DOM.bigClicker.getBoundingClientRect();
  const x = (e.clientX || rect.left + rect.width / 2) - rect.left + (Math.random() - 0.5) * 80;
  const y = (e.clientY || rect.top) - rect.top - 20;
  
  float.style.left = (rect.left + x) + 'px';
  float.style.top = (rect.top + y) + 'px';
  
  document.body.appendChild(float);
  setTimeout(() => float.remove(), 1000);
}

// ===== BUY BUILDING =====
function buyBuilding(buildingData) {
  const cost = getBuildingCost(buildingData);
  if (game.doggeds < cost) return;

  game.doggeds -= cost;

  if (!game.buildings[buildingData.id]) {
    game.buildings[buildingData.id] = { count: 0, multiplier: 1 };
  }
  game.buildings[buildingData.id].count++;

  recalculateDps();
  renderShop();
  updateDisplay();
  checkAchievements();

  showToast(`Bought ${buildingData.name}! (${game.buildings[buildingData.id].count})`);
}

// ===== BUY UPGRADE =====
function buyUpgrade(upgradeData) {
  if (game.upgrades[upgradeData.id]) return;
  if (game.doggeds < upgradeData.cost) return;

  // Check requirements
  if (upgradeData.req) {
    const count = game.buildings[upgradeData.req.building]?.count || 0;
    if (count < upgradeData.req.count) return;
  }

  game.doggeds -= upgradeData.cost;
  game.upgrades[upgradeData.id] = true;

  // Apply upgrade
  if (upgradeData.type === 'click_mult') {
    game.clickMultiplier *= upgradeData.value;
  } else if (upgradeData.type === 'building_mult') {
    if (!game.buildings[upgradeData.building]) {
      game.buildings[upgradeData.building] = { count: 0, multiplier: 1 };
    }
    game.buildings[upgradeData.building].multiplier *= upgradeData.value;
  }
  // global_mult is applied in recalculateDps

  recalculateDps();
  renderShop();
  updateDisplay();
  checkAchievements();

  showToast(`Upgrade unlocked: ${upgradeData.name}!`);
}

// ===== RENDER SHOP =====
function renderShop() {
  // Buildings
  DOM.buildingsContainer.innerHTML = '';
  for (const building of BUILDINGS) {
    const cost = getBuildingCost(building);
    const count = game.buildings[building.id]?.count || 0;
    const canAfford = game.doggeds >= cost;
    const dps = building.baseDps * (game.buildings[building.id]?.multiplier || 1);

    const el = document.createElement('div');
    el.className = `shop-item ${canAfford ? '' : 'cannot-afford'}`;
    el.innerHTML = `
      <div class="shop-item-icon">${building.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${building.name}</div>
        <div class="shop-item-desc">${building.desc}</div>
        <div class="shop-item-cost">🐶 ${formatNumber(cost)} · +${formatNumber(dps)}/s each</div>
      </div>
      <div class="shop-item-count">${count}</div>
    `;
    el.addEventListener('click', () => buyBuilding(building));
    DOM.buildingsContainer.appendChild(el);
  }

  // Upgrades
  DOM.upgradesContainer.innerHTML = '';
  for (const upgrade of UPGRADES) {
    if (game.upgrades[upgrade.id]) continue; // Already purchased
    
    // Check if requirements are met (for visibility)
    if (upgrade.req) {
      const count = game.buildings[upgrade.req.building]?.count || 0;
      if (count < upgrade.req.count) continue; // Hidden until requirement met
    }

    const canAfford = game.doggeds >= upgrade.cost;
    const el = document.createElement('div');
    el.className = `shop-item ${canAfford ? '' : 'cannot-afford'}`;
    el.innerHTML = `
      <div class="shop-item-icon">${upgrade.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${upgrade.name}</div>
        <div class="shop-item-desc">${upgrade.desc}</div>
        <div class="shop-item-cost">🐶 ${formatNumber(upgrade.cost)}</div>
      </div>
    `;
    el.addEventListener('click', () => buyUpgrade(upgrade));
    DOM.upgradesContainer.appendChild(el);
  }

  if (DOM.upgradesContainer.children.length === 0) {
    DOM.upgradesContainer.innerHTML = '<div style="color: #555; font-size: 0.85rem; padding: 0.5rem;">No upgrades available yet. Keep clicking!</div>';
  }
}

// ===== RENDER ACHIEVEMENTS =====
function renderAchievements() {
  DOM.achievementsContainer.innerHTML = '';
  for (const ach of ACHIEVEMENTS) {
    const unlocked = game.achievements[ach.id] || false;
    const el = document.createElement('div');
    el.className = `achievement ${unlocked ? 'unlocked' : ''}`;
    el.innerHTML = `
      <div class="achievement-icon">${unlocked ? ach.icon : '🔒'}</div>
      <div class="achievement-info">
        <div class="achievement-name">${unlocked ? ach.name : '???'}</div>
        <div class="achievement-desc">${unlocked ? ach.desc : 'Keep playing to unlock'}</div>
      </div>
    `;
    DOM.achievementsContainer.appendChild(el);
  }
}

function checkAchievements() {
  let newUnlock = false;
  for (const ach of ACHIEVEMENTS) {
    if (!game.achievements[ach.id] && ach.check()) {
      game.achievements[ach.id] = true;
      newUnlock = true;
      showToast(`🏆 Achievement: ${ach.name}!`);
    }
  }
  if (newUnlock) renderAchievements();
}

// ===== UPDATE DISPLAY =====
function updateDisplay() {
  DOM.doggedCount.textContent = formatNumber(game.doggeds);
  DOM.dpsDisplay.textContent = formatNumber(game.dps);
  DOM.clickPowerDisplay.textContent = formatNumber(getClickValue());

  // Stats
  DOM.statTotalEarned.textContent = formatNumber(game.totalEarned);
  DOM.statTotalClicks.textContent = formatNumber(game.totalClicks);
  DOM.statPerClick.textContent = formatNumber(getClickValue());
  DOM.statPerSecond.textContent = formatNumber(game.dps);
  DOM.statBuildings.textContent = getTotalBuildings();
  
  const seconds = Math.floor((Date.now() - game.startTime) / 1000);
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  DOM.statTimePlayed.textContent = hours > 0 ? `${hours}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// ===== GAME LOOP =====
function gameTick() {
  const now = Date.now();
  const delta = (now - game.lastTick) / 1000; // seconds since last tick
  game.lastTick = now;

  // Add passive doggeds
  if (game.dps > 0) {
    const earned = game.dps * delta;
    game.doggeds += earned;
    game.totalEarned += earned;
  }

  updateDisplay();

  // Re-render shop affordability every 500ms
  if (now % 500 < 50) {
    renderShop();
    checkAchievements();
  }
}

// ===== SAVE / LOAD =====
const SAVE_KEY = 'dogged_clicker_save';

function saveGame() {
  const saveData = {
    doggeds: game.doggeds,
    totalEarned: game.totalEarned,
    totalClicks: game.totalClicks,
    clickPower: game.clickPower,
    clickMultiplier: game.clickMultiplier,
    buildings: game.buildings,
    upgrades: game.upgrades,
    achievements: game.achievements,
    startTime: game.startTime,
    lastSave: Date.now(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  showToast('💾 Game saved!');
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    game.doggeds = data.doggeds || 0;
    game.totalEarned = data.totalEarned || 0;
    game.totalClicks = data.totalClicks || 0;
    game.clickPower = data.clickPower || 1;
    game.clickMultiplier = data.clickMultiplier || 1;
    game.buildings = data.buildings || {};
    game.upgrades = data.upgrades || {};
    game.achievements = data.achievements || {};
    game.startTime = data.startTime || Date.now();

    // Calculate offline earnings
    if (data.lastSave) {
      const offlineSeconds = (Date.now() - data.lastSave) / 1000;
      recalculateDps();
      if (game.dps > 0 && offlineSeconds > 5) {
        const offlineEarned = game.dps * offlineSeconds;
        game.doggeds += offlineEarned;
        game.totalEarned += offlineEarned;
        showToast(`💤 Welcome back! Earned ${formatNumber(offlineEarned)} doggeds while away`);
      }
    }

    return true;
  } catch (e) {
    console.error('Failed to load save:', e);
    return false;
  }
}

function resetGame() {
  if (!confirm('Are you sure you want to reset ALL progress? This cannot be undone! All your doggeds will be lost forever (that\'s dogged).')) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

// ===== MOBILE NAV =====
function setupMobileNav() {
  const btns = document.querySelectorAll('.mobile-nav-btn');
  const shopPanel = document.getElementById('shopPanel');
  const statsPanel = document.getElementById('statsPanel');
  const clickerArea = document.querySelector('.clicker-area');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const panel = btn.dataset.panel;

      shopPanel.classList.remove('mobile-visible');
      statsPanel.classList.remove('mobile-visible');
      clickerArea.classList.remove('mobile-hidden');

      if (panel === 'shop') {
        shopPanel.classList.add('mobile-visible');
        clickerArea.classList.add('mobile-hidden');
      } else if (panel === 'stats') {
        statsPanel.classList.add('mobile-visible');
        clickerArea.classList.add('mobile-hidden');
      }
    });
  });
}

// ===== BACKGROUND PARTICLES =====
function spawnParticle() {
  const p = document.createElement('div');
  p.style.cssText = `
    position: absolute;
    font-family: 'Bangers', cursive;
    color: rgba(255, 107, 53, 0.04);
    font-size: ${1 + Math.random() * 1.5}rem;
    left: ${Math.random() * 100}%;
    top: -30px;
    pointer-events: none;
    animation: particleFall ${8 + Math.random() * 12}s linear forwards;
    white-space: nowrap;
  `;
  p.textContent = Math.random() > 0.5 ? 'dogged' : '🐶';
  DOM.particles.appendChild(p);
  setTimeout(() => p.remove(), 20000);
}

// Add the particle animation
const particleStyle = document.createElement('style');
particleStyle.textContent = `
  @keyframes particleFall {
    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(110vh) rotate(${Math.random() > 0.5 ? '' : '-'}360deg); opacity: 0; }
  }
`;
document.head.appendChild(particleStyle);

// ===== KEYBOARD SHORTCUT =====
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    const fakeEvent = { clientX: 0, clientY: 0 };
    handleClick(fakeEvent);
  }
});

// ===== AUTO-SAVE =====
setInterval(() => {
  const data = {
    doggeds: game.doggeds,
    totalEarned: game.totalEarned,
    totalClicks: game.totalClicks,
    clickPower: game.clickPower,
    clickMultiplier: game.clickMultiplier,
    buildings: game.buildings,
    upgrades: game.upgrades,
    achievements: game.achievements,
    startTime: game.startTime,
    lastSave: Date.now(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}, 30000); // Auto-save every 30 seconds

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Load save
  loadGame();
  recalculateDps();

  // Render
  renderShop();
  renderAchievements();
  updateDisplay();

  // Click handler
  DOM.bigClicker.addEventListener('click', handleClick);

  // Save / Reset
  DOM.saveBtn.addEventListener('click', saveGame);
  DOM.resetBtn.addEventListener('click', resetGame);

  // Mobile
  setupMobileNav();

  // Game loop (60fps-ish)
  game.lastTick = Date.now();
  setInterval(gameTick, 1000 / 30);

  // Background particles
  setInterval(spawnParticle, 2000);

  // Periodic shop refresh for affordability
  setInterval(renderShop, 1000);
});
