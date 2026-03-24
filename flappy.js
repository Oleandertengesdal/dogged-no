(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreDisplay = document.getElementById('scoreDisplay');
  const bestDisplay = document.getElementById('bestDisplay');
  const pipesDisplay = document.getElementById('pipesDisplay');
  const survivalStat = document.getElementById('survivalStat');
  const speedStat = document.getElementById('speedStat');
  const gapStat = document.getElementById('gapStat');

  const startOverlay = document.getElementById('startOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  const finalScore = document.getElementById('finalScore');
  const newBestTag = document.getElementById('newBestTag');
  const nameInput = document.getElementById('nameInput');
  const submitBtn = document.getElementById('submitBtn');
  const submitStatus = document.getElementById('submitStatus');

  const refreshLb = document.getElementById('refreshLb');
  const leaderboardList = document.getElementById('leaderboardList');

  const mobileNav = document.getElementById('mobileNav');
  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  const gameCenter = document.getElementById('gameCenter');

  const W = canvas.width;
  const H = canvas.height;
  const GROUND = H - 58;

  const DEVICE_PID_KEY = 'dogged-flappy-pid';
  const BEST_KEY = 'dogged-flappy-best';

  function makePid() {
    let pid = localStorage.getItem(DEVICE_PID_KEY);
    if (!pid) {
      pid = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
      localStorage.setItem(DEVICE_PID_KEY, pid);
    }
    return pid;
  }

  const devicePid = makePid();

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h = ((h << 5) - h) + c;
      h |= 0;
    }
    return (h >>> 0).toString(36);
  }

  function clientSecret() {
    return ['D0G', 'G3D', '-S1', 'GV3', '-20', '26'].join('');
  }

  function makeSig(name, score, ts, pid) {
    return simpleHash(`FLAPPY|${name}|${score}|${ts}|${pid}|${clientSecret()}`);
  }

  const game = {
    running: false,
    paused: false,
    over: false,
    score: 0,
    pipesPassed: 0,
    survival: 0,
    best: Number(localStorage.getItem(BEST_KEY) || 0),

    speed: 250,
    speedMax: 420,
    gapSize: 192,
    gapMin: 128,
    spawnEvery: 1.45,
    spawnMin: 0.92,

    spawnTimer: 0,
    lastTime: 0,
    submitted: false,

    bird: {
      x: 240,
      y: H * 0.45,
      vy: 0,
      r: 14,
      gravity: 1820,
      flapVel: -570,
      maxFall: 720,
      tilt: 0,
    },

    pipes: [],
    clouds: [],
  };

  function resetRound() {
    game.running = false;
    game.paused = false;
    game.over = false;
    game.score = 0;
    game.pipesPassed = 0;
    game.survival = 0;
    game.speed = 250;
    game.gapSize = 192;
    game.spawnEvery = 1.45;
    game.spawnTimer = 0;
    game.pipes = [];
    game.submitted = false;

    game.bird.y = H * 0.45;
    game.bird.vy = 0;
    game.bird.tilt = 0;

    scoreDisplay.textContent = '0';
    pipesDisplay.textContent = '0';
    bestDisplay.textContent = String(game.best);
    survivalStat.textContent = '0.0s';
    speedStat.textContent = String(Math.round(game.speed));
    gapStat.textContent = String(Math.round(game.gapSize));

    submitStatus.textContent = '';
    newBestTag.classList.add('hidden');

    createClouds();
    draw();
  }

  function createClouds() {
    game.clouds = Array.from({ length: 10 }, (_, i) => ({
      x: (i / 10) * (W + 200) - 80,
      y: 60 + Math.random() * 170,
      w: 70 + Math.random() * 90,
      h: 24 + Math.random() * 20,
      speed: 12 + Math.random() * 18,
    }));
  }

  function spawnPipe() {
    const width = 94;
    const marginTop = 65;
    const marginBottom = 84;
    const range = GROUND - marginBottom - marginTop - game.gapSize;
    const gapY = marginTop + Math.random() * Math.max(30, range);

    game.pipes.push({
      x: W + width,
      w: width,
      gapY,
      gapH: game.gapSize,
      passed: false,
    });
  }

  function flap() {
    if (!game.running || game.paused || game.over) return;
    game.bird.vy = game.bird.flapVel;
  }

  function startGame() {
    if (game.running) return;
    if (game.over) {
      resetRound();
    }
    game.running = true;
    game.paused = false;
    startOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    if (!game.pipes.length) {
      spawnPipe();
      game.spawnTimer = 0;
    }
  }

  function pauseToggle() {
    if (!game.running || game.over) return;
    game.paused = !game.paused;
    pauseOverlay.classList.toggle('hidden', !game.paused);
  }

  function endGame() {
    if (game.over) return;
    game.running = false;
    game.over = true;

    finalScore.textContent = String(game.score);

    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem(BEST_KEY, String(game.best));
      bestDisplay.textContent = String(game.best);
      newBestTag.classList.remove('hidden');
    }

    submitBtn.disabled = false;
    submitStatus.textContent = '';
    gameOverOverlay.classList.remove('hidden');
  }

  function update(dt) {
    if (!game.running || game.paused || game.over) return;

    game.survival += dt;
    game.speed = Math.min(game.speedMax, game.speed + 12 * dt);
    game.gapSize = Math.max(game.gapMin, game.gapSize - 4 * dt);
    game.spawnEvery = Math.max(game.spawnMin, game.spawnEvery - 0.05 * dt);

    speedStat.textContent = String(Math.round(game.speed));
    gapStat.textContent = String(Math.round(game.gapSize));
    survivalStat.textContent = `${game.survival.toFixed(1)}s`;

    game.bird.vy += game.bird.gravity * dt;
    game.bird.vy = Math.min(game.bird.vy, game.bird.maxFall);
    game.bird.y += game.bird.vy * dt;

    game.bird.tilt = Math.max(-0.7, Math.min(1.15, game.bird.vy / 530));

    game.spawnTimer += dt;
    if (game.spawnTimer >= game.spawnEvery) {
      game.spawnTimer = 0;
      spawnPipe();
    }

    for (let i = game.pipes.length - 1; i >= 0; i--) {
      const p = game.pipes[i];
      p.x -= game.speed * dt;

      if (!p.passed && p.x + p.w < game.bird.x - game.bird.r) {
        p.passed = true;
        game.pipesPassed += 1;
        game.score += 1;
        scoreDisplay.textContent = String(game.score);
        pipesDisplay.textContent = String(game.pipesPassed);
      }

      if (p.x + p.w < -40) {
        game.pipes.splice(i, 1);
      }
    }

    for (const cloud of game.clouds) {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + cloud.w < -60) {
        cloud.x = W + Math.random() * 140;
        cloud.y = 60 + Math.random() * 170;
      }
    }

    const b = game.bird;
    if (b.y + b.r >= GROUND || b.y - b.r <= 0) {
      endGame();
      return;
    }

    for (const p of game.pipes) {
      const withinX = b.x + b.r > p.x && b.x - b.r < p.x + p.w;
      if (!withinX) continue;

      const topCollision = b.y - b.r < p.gapY;
      const bottomCollision = b.y + b.r > p.gapY + p.gapH;
      if (topCollision || bottomCollision) {
        endGame();
        return;
      }
    }
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0e2d57');
    g.addColorStop(0.55, '#123d67');
    g.addColorStop(1, '#0a1a31');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const cloud of game.clouds) {
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = '#dce8ff';
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.w * 0.55, cloud.h, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + cloud.w * 0.25, cloud.y - 7, cloud.w * 0.38, cloud.h * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawGround() {
    ctx.fillStyle = '#1a3320';
    ctx.fillRect(0, GROUND, W, H - GROUND);

    ctx.fillStyle = '#254b2e';
    for (let x = 0; x < W + 40; x += 32) {
      const off = (performance.now() * 0.22) % 32;
      ctx.fillRect((x - off) | 0, GROUND + 10, 20, 5);
    }
  }

  function drawPipe(p) {
    const topH = p.gapY;
    const botY = p.gapY + p.gapH;
    const botH = GROUND - botY;

    const bodyGrad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
    bodyGrad.addColorStop(0, '#1b8b45');
    bodyGrad.addColorStop(0.5, '#2cb45f');
    bodyGrad.addColorStop(1, '#15763a');

    ctx.fillStyle = bodyGrad;
    ctx.fillRect(p.x, 0, p.w, topH);
    ctx.fillRect(p.x, botY, p.w, botH);

    ctx.fillStyle = '#0e5229';
    ctx.fillRect(p.x - 5, topH - 18, p.w + 10, 18);
    ctx.fillRect(p.x - 5, botY, p.w + 10, 18);

    ctx.strokeStyle = '#0b3f21';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, 0, p.w, topH);
    ctx.strokeRect(p.x, botY, p.w, botH);
  }

  function drawBird() {
    const b = game.bird;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.tilt);

    const body = ctx.createLinearGradient(-18, -14, 18, 14);
    body.addColorStop(0, '#ffd257');
    body.addColorStop(1, '#ff8f1f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(6, -4, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(8, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7744';
    ctx.beginPath();
    ctx.moveTo(14, 2);
    ctx.lineTo(24, 0);
    ctx.lineTo(14, -2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f4b130';
    ctx.beginPath();
    ctx.ellipse(-4, 4, 8, 5, 0.25 + Math.sin(performance.now() / 110) * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHudHints() {
    if (!game.running && !game.over) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '700 20px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE or tap to flap', W / 2, H * 0.22);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    drawSky();
    for (const p of game.pipes) drawPipe(p);
    drawGround();
    drawBird();
    drawHudHints();
  }

  function tick(ts) {
    if (!game.lastTime) game.lastTime = ts;
    const dt = Math.min(0.033, (ts - game.lastTime) / 1000);
    game.lastTime = ts;

    update(dt);
    draw();
    requestAnimationFrame(tick);
  }

  async function loadLeaderboard() {
    leaderboardList.innerHTML = '<li class="lb-empty">Loading leaderboard...</li>';
    try {
      const res = await fetch('/api/flappy-leaderboard');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      const rows = Array.isArray(data?.leaderboard) ? data.leaderboard : [];

      if (!rows.length) {
        leaderboardList.innerHTML = '<li class="lb-empty">No scores yet. Be first.</li>';
        return;
      }

      leaderboardList.innerHTML = rows
        .slice(0, 5)
        .map((entry) => {
          const name = String(entry.name || 'PLAYER').toUpperCase().slice(0, 12);
          const score = Number(entry.score || 0);
          return `<li><span class="lb-name">${escapeHtml(name)}</span><span class="lb-score">${score}</span></li>`;
        })
        .join('');
    } catch (err) {
      leaderboardList.innerHTML = '<li class="lb-empty">Leaderboard offline</li>';
    }
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function submitScore() {
    if (game.submitted) {
      submitStatus.textContent = 'Score already submitted this run.';
      return;
    }

    const rawName = (nameInput.value || '').trim().toUpperCase();
    const name = rawName.replace(/[^A-Z0-9 _-]/g, '').slice(0, 12);

    if (!name) {
      submitStatus.textContent = 'Enter a valid name first.';
      return;
    }
    if (game.score <= 0) {
      submitStatus.textContent = 'Score must be above 0.';
      return;
    }

    submitBtn.disabled = true;
    submitStatus.textContent = 'Submitting...';

    const ts = Date.now();
    const payload = {
      name,
      score: game.score,
      ts,
      pid: devicePid,
      sig: makeSig(name, game.score, ts, devicePid),
    };

    try {
      const res = await fetch('/api/flappy-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Submit failed');
      }

      submitStatus.textContent = 'Score saved!';
      game.submitted = true;
      loadLeaderboard();
    } catch (err) {
      submitStatus.textContent = err.message || 'Failed to submit score.';
      submitBtn.disabled = false;
    }
  }

  function setMobilePanel(panel) {
    if (window.innerWidth > 900) {
      leftPanel.classList.add('show');
      rightPanel.classList.add('show');
      return;
    }

    leftPanel.classList.remove('show');
    rightPanel.classList.remove('show');

    if (panel === 'left') {
      leftPanel.classList.add('show');
    } else if (panel === 'right') {
      rightPanel.classList.add('show');
    }

    mobileNav.querySelectorAll('.mob-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.panel === panel);
    });
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    startGame();
  });
  submitBtn.addEventListener('click', submitScore);
  refreshLb.addEventListener('click', loadLeaderboard);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!game.running && !game.over) {
        startGame();
      } else if (!game.running && game.over) {
        gameOverOverlay.classList.add('hidden');
        startGame();
      } else {
        flap();
      }
    }

    if (e.code === 'KeyP') {
      e.preventDefault();
      pauseToggle();
    }
  });

  canvas.addEventListener('pointerdown', () => {
    if (!game.running && !game.over) {
      startGame();
      return;
    }
    if (!game.running && game.over) {
      gameOverOverlay.classList.add('hidden');
      startGame();
      return;
    }
    flap();
  });

  mobileNav.querySelectorAll('.mob-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMobilePanel(btn.dataset.panel));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      mobileNav.querySelector('.mob-btn[data-panel="game"]')?.classList.add('active');
      setMobilePanel('game');
    }
  });

  bestDisplay.textContent = String(game.best);
  resetRound();
  setMobilePanel('game');
  loadLeaderboard();
  requestAnimationFrame(tick);
})();
