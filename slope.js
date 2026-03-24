(function () {
'use strict';

const API = '/api/slope-leaderboard';

// Client-side anti-tamper signature (same pattern as other games).
const SECRET = ['D0G', 'G3D', '-S1', 'GV3', '-20', '26'].join('');
function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

function getPid() {
  let pid = localStorage.getItem('dogged-slope-pid');
  if (!pid) {
    pid = crypto.randomUUID();
    localStorage.setItem('dogged-slope-pid', pid);
  }
  return pid;
}
const PID = getPid();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('scoreDisplay');
const highEl = document.getElementById('highDisplay');
const speedEl = document.getElementById('speedDisplay');
const finalEl = document.getElementById('finalScore');
const nameInput = document.getElementById('playerName');
const submitBtn = document.getElementById('submitBtn');
const submitStatus = document.getElementById('submitStatus');
const retryBtn = document.getElementById('retryBtn');
const startBtn = document.getElementById('startBtn');
const refreshLb = document.getElementById('refreshLb');
const lbList = document.getElementById('leaderboardList');

const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');

const statRuns = document.getElementById('statRuns');
const statBest = document.getElementById('statBest');
const statNear = document.getElementById('statNear');

const canvasWrap = document.getElementById('canvasWrap');

const keys = { left: false, right: false };
const SEGMENT_CACHE = new Map();
const NEAR_MISS_KEYS = new Set();

const DRAW_DISTANCE = 130;
const COLLISION_SCAN_START = 5;
const COLLISION_SCAN_END = 16;

let running = false;
let paused = false;
let sessionRuns = 0;
let nearMisses = 0;

let distance = 0;
let speed = 13;
let score = 0;
let playerX = 0;
let playerVX = 0;
let offRoadTimer = 0;
let highScore = parseInt(localStorage.getItem('dogged-slope-high') || '0', 10);
let bestRun = highScore;
let lastFrame = 0;
let rafId = 0;

highEl.textContent = String(highScore);
statBest.textContent = String(bestRun);
nameInput.value = localStorage.getItem('dogged-slope-name') || '';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function seededRand(n) {
  const x = Math.sin(n * 91.331 + 17.17) * 43758.5453;
  return x - Math.floor(x);
}

function getSegment(absIndex) {
  const key = absIndex;
  if (SEGMENT_CACHE.has(key)) return SEGMENT_CACHE.get(key);

  const center = Math.sin(absIndex * 0.016) * 0.45 + Math.sin(absIndex * 0.057) * 0.2;
  const width = clamp(1.28 - absIndex * 0.00023 + Math.sin(absIndex * 0.031) * 0.06, 0.68, 1.28);

  const density = clamp(0.13 + absIndex * 0.00004, 0.13, 0.42);
  const maybeObstacle = (absIndex > 25) && (absIndex % 3 === 0) && seededRand(absIndex + 5) < density;

  let obstacle = null;
  if (maybeObstacle) {
    const px = (seededRand(absIndex + 13) * 2 - 1) * (width * 0.62);
    const r = 0.09 + seededRand(absIndex + 29) * 0.09;
    obstacle = { x: px, r };
  }

  const seg = {
    center,
    width,
    stripe: absIndex % 2 === 0,
    obstacle,
  };

  if (SEGMENT_CACHE.size > 3200) {
    // Trim stale cache entries to keep memory bounded.
    const threshold = Math.floor(distance) - 250;
    for (const k of SEGMENT_CACHE.keys()) {
      if (k < threshold) SEGMENT_CACHE.delete(k);
    }
  }

  SEGMENT_CACHE.set(key, seg);
  return seg;
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resetRun() {
  running = true;
  paused = false;
  distance = 0;
  speed = 13;
  score = 0;
  playerX = 0;
  playerVX = 0;
  offRoadTimer = 0;

  NEAR_MISS_KEYS.clear();

  scoreEl.textContent = '0';
  speedEl.textContent = '1.0x';
  submitBtn.disabled = false;
  submitStatus.textContent = '';
  submitStatus.style.color = '';

  startOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');

  canvasWrap.style.borderColor = 'rgba(79,184,255,.65)';
  canvasWrap.style.boxShadow = '0 0 36px rgba(79,184,255,.2)';
}

function startGame() {
  resetRun();
}

function endGame(message) {
  if (!running) return;

  running = false;
  paused = false;

  sessionRuns++;
  statRuns.textContent = String(sessionRuns);

  if (score > bestRun) {
    bestRun = score;
    statBest.textContent = String(bestRun);
  }

  finalEl.textContent = String(score);
  submitBtn.disabled = false;
  submitStatus.textContent = message || '';
  submitStatus.style.color = '#ff9fae';
  gameOverOverlay.classList.remove('hidden');

  canvasWrap.style.borderColor = 'rgba(255,93,115,.95)';
  canvasWrap.style.boxShadow = '0 0 36px rgba(255,93,115,.35)';
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) pauseOverlay.classList.remove('hidden');
  else pauseOverlay.classList.add('hidden');
}

function update(dt) {
  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  const steerAccel = 8.4;
  const steerFriction = 0.86;
  playerVX += steer * steerAccel * dt;
  playerVX *= Math.pow(steerFriction, dt * 60);
  playerVX = clamp(playerVX, -2.6, 2.6);
  playerX += playerVX * dt;

  // Progressively faster run.
  speed = clamp(speed + 1.7 * dt, 13, 31);
  distance += speed * dt;

  score = Math.floor(distance * (4.5 + speed * 0.16));
  scoreEl.textContent = String(score);
  speedEl.textContent = `${(speed / 13).toFixed(1)}x`;

  if (score > highScore) {
    highScore = score;
    highEl.textContent = String(highScore);
    localStorage.setItem('dogged-slope-high', String(highScore));
  }

  const playerSeg = getSegment(Math.floor(distance + 6));
  const safeHalf = playerSeg.width - 0.12;
  const roadOffset = Math.abs(playerX - playerSeg.center);
  if (roadOffset > safeHalf) {
    offRoadTimer += dt;
    if (offRoadTimer > 0.17) {
      endGame('You fell off the slope!');
      return;
    }
  } else {
    offRoadTimer = 0;
  }

  const base = Math.floor(distance);
  for (let i = COLLISION_SCAN_START; i <= COLLISION_SCAN_END; i++) {
    const zIndex = base + i;
    const seg = getSegment(zIndex);
    if (!seg.obstacle) continue;

    const worldObstacleX = seg.center + seg.obstacle.x;
    const diff = Math.abs(playerX - worldObstacleX);
    const hitRadius = seg.obstacle.r + 0.085;

    if (i <= 8 && diff < hitRadius) {
      endGame('You hit a blocker!');
      return;
    }

    // Near miss stat for player feedback.
    if (i === 9 && diff < hitRadius + 0.08) {
      const key = `${zIndex}`;
      if (!NEAR_MISS_KEYS.has(key)) {
        NEAR_MISS_KEYS.add(key);
        nearMisses++;
        statNear.textContent = String(nearMisses);
      }
    }
  }
}

function project(relZ, worldX, cameraX, width, height, horizonY, tilt) {
  if (relZ <= 0.2) return null;
  const t = clamp(relZ / DRAW_DISTANCE, 0, 1);
  const depth = 1 / (0.2 + t * 1.6);

  const x = width * 0.5 + (worldX - cameraX) * depth * width * 0.28 + tilt * (1 - t) * 85;
  const y = horizonY + Math.pow(1 - t, 2.08) * (height - horizonY - 18);
  return { x, y, depth, t };
}

function drawSky(width, height) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0f2f5e');
  grad.addColorStop(0.44, '#0b2142');
  grad.addColorStop(1, '#060f21');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,.15)';
  for (let i = 0; i < 42; i++) {
    const x = (i * 97) % width;
    const y = (i * 41) % Math.floor(height * 0.58);
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawRoad(width, height) {
  const horizonY = height * 0.17;
  const camX = playerX * 0.44;
  const tilt = clamp(playerVX * 0.08, -0.2, 0.2);

  drawSky(width, height);

  const base = Math.floor(distance);

  for (let i = DRAW_DISTANCE; i >= 2; i--) {
    const zFar = base + i;
    const zNear = base + i - 1;
    const relFar = zFar - distance;
    const relNear = zNear - distance;

    const segFar = getSegment(zFar);
    const segNear = getSegment(zNear);

    const pFar = project(relFar, segFar.center, camX, width, height, horizonY, tilt);
    const pNear = project(relNear, segNear.center, camX, width, height, horizonY, tilt);
    if (!pFar || !pNear) continue;

    const halfFar = segFar.width * pFar.depth * width * 0.28;
    const halfNear = segNear.width * pNear.depth * width * 0.28;

    ctx.fillStyle = segNear.stripe ? 'rgba(22,37,58,0.98)' : 'rgba(17,29,46,0.98)';
    ctx.beginPath();
    ctx.moveTo(pFar.x - halfFar, pFar.y);
    ctx.lineTo(pFar.x + halfFar, pFar.y);
    ctx.lineTo(pNear.x + halfNear, pNear.y);
    ctx.lineTo(pNear.x - halfNear, pNear.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(79,184,255,.35)';
    ctx.lineWidth = Math.max(1, (1 - pFar.t) * 2.5);
    ctx.beginPath();
    ctx.moveTo(pFar.x - halfFar, pFar.y);
    ctx.lineTo(pNear.x - halfNear, pNear.y);
    ctx.moveTo(pFar.x + halfFar, pFar.y);
    ctx.lineTo(pNear.x + halfNear, pNear.y);
    ctx.stroke();

    if (i % 4 === 0) {
      const dashW = Math.max(2, halfNear * 0.07);
      const dashH = Math.max(2, pNear.y - pFar.y);
      ctx.fillStyle = 'rgba(255,255,255,.23)';
      ctx.fillRect(pNear.x - dashW * 0.5, pNear.y - dashH, dashW, dashH);
    }

    if (segNear.obstacle && i > 4) {
      const oxWorld = segNear.center + segNear.obstacle.x;
      const obs = project(relNear, oxWorld, camX, width, height, horizonY, tilt);
      if (!obs) continue;

      const s = Math.max(7, segNear.obstacle.r * obs.depth * width * 0.5);
      ctx.shadowColor = 'rgba(255,93,115,.55)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(255,93,115,.95)';
      ctx.fillRect(obs.x - s * 0.9, obs.y - s * 1.16, s * 1.8, s * 1.16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,212,221,.92)';
      ctx.fillRect(obs.x - s * 0.62, obs.y - s * 1.0, s * 1.24, Math.max(2, s * 0.15));
    }
  }

  const nearSeg = getSegment(base + 5);
  const nearRel = (base + 5) - distance;
  const nearProj = project(nearRel, nearSeg.center, camX, width, height, horizonY, tilt);

  let playerScreenX = width * 0.5;
  const playerY = height * 0.86;
  if (nearProj) {
    const roadHalf = nearSeg.width * nearProj.depth * width * 0.28;
    playerScreenX = nearProj.x + (playerX - nearSeg.center) * (roadHalf / Math.max(nearSeg.width, 0.1));
  }

  ctx.fillStyle = 'rgba(79,184,255,.97)';
  ctx.shadowColor = 'rgba(79,184,255,.7)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(playerScreenX, playerY - 17);
  ctx.lineTo(playerScreenX + 13, playerY + 13);
  ctx.lineTo(playerScreenX - 13, playerY + 13);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  if (offRoadTimer > 0) {
    const alpha = clamp(offRoadTimer * 2.1, 0, 0.28);
    ctx.fillStyle = `rgba(255,93,115,${alpha})`;
    ctx.fillRect(0, height * 0.74, width, height * 0.26);
  }

  ctx.fillStyle = 'rgba(161,182,221,.88)';
  ctx.font = '700 13px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Stay centered. Red blockers are lethal.', 16, 22);
}

function draw() {
  drawRoad(canvas.clientWidth, canvas.clientHeight);
}

function loop(ts) {
  if (!lastFrame) lastFrame = ts;
  const dt = Math.min(0.033, (ts - lastFrame) / 1000);
  lastFrame = ts;

  if (running && !paused) update(dt);
  draw();

  rafId = requestAnimationFrame(loop);
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadLeaderboard() {
  lbList.innerHTML = '<li class="lb-empty">Loading...</li>';
  try {
    const res = await fetch(API);
    const data = await res.json();
    if (!data.ok || !data.leaderboard || !data.leaderboard.length) {
      lbList.innerHTML = '<li class="lb-empty">No scores yet. Be the first!</li>';
      return;
    }

    lbList.innerHTML = '';
    data.leaderboard.forEach((entry) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="lb-name">${escHtml(entry.name)}</span><span class="lb-score">${entry.score}</span>`;
      lbList.appendChild(li);
    });
  } catch {
    lbList.innerHTML = '<li class="lb-empty">Failed to load</li>';
  }
}

submitBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  if (!name) { submitStatus.textContent = 'Enter a name!'; return; }
  if (name.length > 20) { submitStatus.textContent = 'Max 20 chars'; return; }
  if (/<|>|&/.test(name)) { submitStatus.textContent = 'No special chars'; return; }
  if (score < 1) { submitStatus.textContent = 'Score too low'; return; }

  submitBtn.disabled = true;
  submitStatus.textContent = 'Submitting...';
  submitStatus.style.color = '';
  localStorage.setItem('dogged-slope-name', name);

  const ts = Date.now();
  const sig = simpleHash(`SLOPE|${name}|${score}|${ts}|${PID}|${SECRET}`);

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, ts, sig, pid: PID }),
    });
    const data = await res.json();

    if (data.ok) {
      submitStatus.textContent = `🏆 Rank #${data.rank} of ${data.total}`;
      submitStatus.style.color = '#7dffb3';
      loadLeaderboard();
    } else {
      submitStatus.textContent = data.error || 'Submit failed';
      submitStatus.style.color = '#ff6f86';
      submitBtn.disabled = false;
    }
  } catch {
    submitStatus.textContent = 'Network error';
    submitStatus.style.color = '#ff6f86';
    submitBtn.disabled = false;
  }
});

refreshLb.addEventListener('click', loadLeaderboard);

document.querySelectorAll('.mob-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mob-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const p = btn.dataset.panel;
    document.getElementById('settingsPanel').classList.toggle('show', p === 'settings');
    document.getElementById('leaderboardPanel').classList.toggle('show', p === 'leaderboard');

    if (p !== 'settings') document.getElementById('settingsPanel').classList.remove('show');
    if (p !== 'leaderboard') document.getElementById('leaderboardPanel').classList.remove('show');
  });
});

function setDir(dir, down) {
  if (dir === 'left') keys.left = down;
  if (dir === 'right') keys.right = down;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setDir('left', true);
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setDir('right', true);

  if (e.key === 'r' || e.key === 'R') {
    startGame();
    return;
  }

  if (e.key === ' ') {
    e.preventDefault();
    if (!running && gameOverOverlay.classList.contains('hidden')) {
      startGame();
      return;
    }
    if (!running && !startOverlay.classList.contains('hidden')) {
      startGame();
      return;
    }
    togglePause();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setDir('left', false);
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setDir('right', false);
});

document.querySelectorAll('.touch-btn').forEach((btn) => {
  const dir = btn.dataset.dir;
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); setDir(dir, true); }, { passive: false });
  btn.addEventListener('touchend', () => setDir(dir, false));
  btn.addEventListener('touchcancel', () => setDir(dir, false));
  btn.addEventListener('mousedown', () => setDir(dir, true));
  btn.addEventListener('mouseup', () => setDir(dir, false));
  btn.addEventListener('mouseleave', () => setDir(dir, false));
});

startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
draw();
loadLeaderboard();
rafId = requestAnimationFrame(loop);

window.addEventListener('beforeunload', () => {
  if (rafId) cancelAnimationFrame(rafId);
});

})();
