(function(){
'use strict';

const API = '/api/slope-leaderboard';

const SECRET = ['D0G','G3D','-S1','GV3','-20','26'].join('');
function simpleHash(s){
  let h = 0;
  for(let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return (h >>> 0).toString(36);
}

function getPid(){
  let pid = localStorage.getItem('dogged-slope-pid');
  if(!pid){ pid = crypto.randomUUID(); localStorage.setItem('dogged-slope-pid', pid); }
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

const SEGMENT_COUNT = 460;
const DRAW_SEGMENTS = 120;
const BASE_SPEED = 0.65;
const MAX_SPEED = 2.2;
const ACCEL = 0.16;
const TURN_SPEED = 1.55;
const ROAD_LIMIT = 1.15;

let road = [];
let running = false;
let paused = false;
let score = 0;
let highScore = parseInt(localStorage.getItem('dogged-slope-high') || '0', 10);
let bestRun = highScore;
let speed = BASE_SPEED;
let worldZ = 0;
let playerX = 0;
let offRoadTime = 0;
let lastTime = 0;
let rafId = 0;
let sessionRuns = 0;
let nearMisses = 0;

const keys = { left: false, right: false };
const nearMissLog = new Set();

highEl.textContent = highScore;
statBest.textContent = String(bestRun);
nameInput.value = localStorage.getItem('dogged-slope-name') || '';

function buildRoad() {
  road = [];
  let curve = 0;
  let targetCurve = 0;

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    if (i % 24 === 0) {
      targetCurve = (Math.random() * 2 - 1) * 0.9;
    }
    curve += (targetCurve - curve) * 0.12;

    let obstacleX = null;
    let obstacleW = 0;

    const obstacleRoll = (i > 20 && i % 5 === 0 && Math.random() < 0.28);
    if (obstacleRoll) {
      obstacleX = (Math.random() * 2 - 1) * 0.9;
      obstacleW = 0.18 + Math.random() * 0.2;
    }

    road.push({
      id: i,
      curve,
      obstacleX,
      obstacleW,
      stripe: i % 2 === 0,
    });
  }
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startGame() {
  buildRoad();
  running = true;
  paused = false;
  score = 0;
  speed = BASE_SPEED;
  worldZ = 0;
  playerX = 0;
  offRoadTime = 0;
  nearMissLog.clear();

  scoreEl.textContent = '0';
  speedEl.textContent = '1.0x';
  submitStatus.textContent = '';
  submitBtn.disabled = false;

  startOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');

  canvasWrap.style.borderColor = 'rgba(79,184,255,.65)';
  canvasWrap.style.boxShadow = '0 0 36px rgba(79,184,255,.2)';
}

function endGame(reason) {
  running = false;
  sessionRuns++;
  statRuns.textContent = String(sessionRuns);

  if (score > bestRun) {
    bestRun = score;
    statBest.textContent = String(bestRun);
  }

  finalEl.textContent = String(score);
  submitBtn.disabled = false;
  submitStatus.textContent = reason || '';
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
  if (keys.left) playerX -= TURN_SPEED * dt * (1 + speed * 0.18);
  if (keys.right) playerX += TURN_SPEED * dt * (1 + speed * 0.18);

  if (!keys.left && !keys.right) {
    playerX *= Math.max(0, 1 - dt * 3.2);
  }

  playerX = clamp(playerX, -1.45, 1.45);

  speed = clamp(speed + ACCEL * dt, BASE_SPEED, MAX_SPEED);
  worldZ += speed * dt * 24;
  score = Math.floor(worldZ * (7 + speed * 1.8));

  if (score > highScore) {
    highScore = score;
    highEl.textContent = String(highScore);
    localStorage.setItem('dogged-slope-high', String(highScore));
  }

  scoreEl.textContent = String(score);
  speedEl.textContent = `${(speed / BASE_SPEED).toFixed(1)}x`;

  if (Math.abs(playerX) > ROAD_LIMIT) {
    offRoadTime += dt;
    if (offRoadTime > 0.35) {
      endGame('You fell off the slope!');
      return;
    }
  } else {
    offRoadTime = 0;
  }

  const base = Math.floor(worldZ);
  for (let i = 2; i <= 5; i++) {
    const segment = road[(base + i) % SEGMENT_COUNT];
    if (!segment || segment.obstacleX === null) continue;

    const threshold = (segment.obstacleW * 0.5) + 0.13;
    const diff = Math.abs(playerX - segment.obstacleX);

    if (i <= 3 && diff < threshold) {
      endGame('You hit a blocker!');
      return;
    }

    if (i === 3 && diff < threshold + 0.08) {
      const key = `${base + i}:${segment.id}`;
      if (!nearMissLog.has(key)) {
        nearMissLog.add(key);
        nearMisses++;
        statNear.textContent = String(nearMisses);
      }
    }
  }
}

function drawSky(w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0f2d58');
  grad.addColorStop(0.45, '#091b38');
  grad.addColorStop(1, '#050914');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97) % w);
    const y = ((i * 37) % (h * 0.6));
    const r = i % 3 === 0 ? 1.5 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function projectY(t, h) {
  return h * 0.14 + Math.pow(t, 1.9) * h * 0.8;
}

function drawRoad(w, h) {
  const base = Math.floor(worldZ);
  const centerOffsets = new Array(DRAW_SEGMENTS + 1);
  let offset = 0;

  for (let i = 0; i <= DRAW_SEGMENTS; i++) {
    const seg = road[(base + i) % SEGMENT_COUNT];
    offset += seg.curve * 0.0019;
    centerOffsets[i] = offset;
  }

  for (let i = DRAW_SEGMENTS; i >= 1; i--) {
    const tFar = (i - 1) / DRAW_SEGMENTS;
    const tNear = i / DRAW_SEGMENTS;

    const yFar = projectY(tFar, h);
    const yNear = projectY(tNear, h);

    const roadFar = (0.04 + Math.pow(tFar, 2.15) * 0.56) * w;
    const roadNear = (0.04 + Math.pow(tNear, 2.15) * 0.56) * w;

    const cxFar = w * (0.5 + centerOffsets[i - 1]);
    const cxNear = w * (0.5 + centerOffsets[i]);

    ctx.fillStyle = i % 2 === 0 ? 'rgba(24,35,58,0.98)' : 'rgba(19,28,47,0.98)';
    ctx.beginPath();
    ctx.moveTo(cxFar - roadFar, yFar);
    ctx.lineTo(cxFar + roadFar, yFar);
    ctx.lineTo(cxNear + roadNear, yNear);
    ctx.lineTo(cxNear - roadNear, yNear);
    ctx.closePath();
    ctx.fill();

    const seg = road[(base + i) % SEGMENT_COUNT];
    if (seg.stripe && i % 3 === 0) {
      const stripeW = roadNear * 0.05;
      const stripeH = Math.max(2, yNear - yFar);
      ctx.fillStyle = 'rgba(94,130,186,.4)';
      ctx.fillRect(cxNear - stripeW * 0.5, yNear - stripeH, stripeW, stripeH);
    }

    if (seg.obstacleX !== null && i > 2) {
      const obsX = cxNear + seg.obstacleX * roadNear * 0.78;
      const size = Math.max(6, roadNear * (0.035 + tNear * 0.14));
      const obsY = yNear - size * 0.86;

      ctx.fillStyle = 'rgba(255,93,115,.95)';
      ctx.shadowColor = 'rgba(255,93,115,.5)';
      ctx.shadowBlur = 10;
      ctx.fillRect(obsX - size * 0.9, obsY - size * 0.25, size * 1.8, size * 0.9);
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(255,206,212,.95)';
      ctx.fillRect(obsX - size * 0.65, obsY - size * 0.12, size * 1.3, size * 0.18);
    }
  }

  const nearRoad = (0.04 + Math.pow(1, 2.15) * 0.56) * w;
  const nearCenter = w * (0.5 + centerOffsets[DRAW_SEGMENTS]);
  const playerScreenX = nearCenter + playerX * nearRoad * 0.72;
  const playerY = h * 0.86;

  ctx.fillStyle = 'rgba(79,184,255,.95)';
  ctx.shadowColor = 'rgba(79,184,255,.65)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(playerScreenX, playerY - 16);
  ctx.lineTo(playerScreenX + 12, playerY + 12);
  ctx.lineTo(playerScreenX - 12, playerY + 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  if (Math.abs(playerX) > ROAD_LIMIT - 0.07) {
    ctx.fillStyle = 'rgba(255,93,115,.18)';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
  }
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  drawSky(w, h);
  drawRoad(w, h);

  ctx.fillStyle = 'rgba(141,160,198,.85)';
  ctx.font = '700 13px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Stay centered. Red blocks kill the run.', 16, 22);
}

function loop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min(0.04, (ts - lastTime) / 1000);
  lastTime = ts;

  if (running && !paused) {
    update(dt);
  }

  draw();
  rafId = requestAnimationFrame(loop);
}

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
    if (!running) return;
    togglePause();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setDir('left', false);
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setDir('right', false);
});

document.querySelectorAll('.touch-btn').forEach(btn => {
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

submitBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  if (!name) { submitStatus.textContent = 'Enter a name!'; return; }
  if (name.length > 20) { submitStatus.textContent = 'Max 20 chars'; return; }
  if (/<|>|&/.test(name)) { submitStatus.textContent = 'No special chars'; return; }
  if (score < 1) { submitStatus.textContent = 'Score too low'; return; }

  submitBtn.disabled = true;
  submitStatus.textContent = 'Submitting...';
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
      submitStatus.textContent = `Rank #${data.rank} of ${data.total}`;
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

function escHtml(s){
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
    data.leaderboard.forEach(entry => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="lb-name">${escHtml(entry.name)}</span><span class="lb-score">${entry.score}</span>`;
      lbList.appendChild(li);
    });
  } catch {
    lbList.innerHTML = '<li class="lb-empty">Failed to load</li>';
  }
}

refreshLb.addEventListener('click', loadLeaderboard);

document.querySelectorAll('.mob-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mob-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const p = btn.dataset.panel;
    document.getElementById('settingsPanel').classList.toggle('show', p === 'settings');
    document.getElementById('leaderboardPanel').classList.toggle('show', p === 'leaderboard');

    if (p !== 'settings') document.getElementById('settingsPanel').classList.remove('show');
    if (p !== 'leaderboard') document.getElementById('leaderboardPanel').classList.remove('show');
  });
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
buildRoad();
draw();
loadLeaderboard();
rafId = requestAnimationFrame(loop);

window.addEventListener('beforeunload', () => {
  if (rafId) cancelAnimationFrame(rafId);
});

})();
