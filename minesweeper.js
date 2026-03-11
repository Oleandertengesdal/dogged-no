// ============================================================
// DOGGED MINESWEEPER — Full Game Engine
// ============================================================
(() => {
'use strict';

// ============= DIFFICULTY =============
const DIFFICULTIES = {
  easy:   { cols: 9,  rows: 9,  mines: 10 },
  medium: { cols: 16, rows: 16, mines: 40 },
  hard:   { cols: 30, rows: 16, mines: 99 },
};

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
    const str = `MS|${data.name}|${data.time}|${data.difficulty}|${data.ts}|${data.pid}|${this.SECRET}`;
    return this.hash(str);
  },
};

// ============= PLAYER ID =============
function getPlayerId() {
  let pid = localStorage.getItem('dogged-ms-pid');
  if (!pid) {
    pid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    localStorage.setItem('dogged-ms-pid', pid);
  }
  return pid;
}
const PID = getPlayerId();

// ============= STATE =============
const G = {
  difficulty: 'easy',
  cols: 9, rows: 9, totalMines: 10,
  board: [],       // 2D array of cell objects
  state: 'idle',   // idle, playing, won, lost
  flagCount: 0,
  revealedCount: 0,
  timer: 0,
  timerInterval: null,
  startTime: 0,
  // Stats
  gamesPlayed: 0, gamesWon: 0,
  bestTimes: { easy: null, medium: null, hard: null },
  lbDifficulty: 'easy',
};

// ============= BOARD MANAGEMENT =============
function createBoard() {
  G.board = [];
  for (let r = 0; r < G.rows; r++) {
    G.board[r] = [];
    for (let c = 0; c < G.cols; c++) {
      G.board[r][c] = {
        mine: false, revealed: false, flagged: false,
        adjacent: 0, row: r, col: c,
      };
    }
  }
}

function placeMines(safeRow, safeCol) {
  const safe = new Set();
  // 3x3 safe zone around first click
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      safe.add(`${safeRow + dr},${safeCol + dc}`);
    }
  }

  let placed = 0;
  while (placed < G.totalMines) {
    const r = Math.floor(Math.random() * G.rows);
    const c = Math.floor(Math.random() * G.cols);
    if (G.board[r][c].mine || safe.has(`${r},${c}`)) continue;
    G.board[r][c].mine = true;
    placed++;
  }

  // Calculate adjacent counts
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (G.board[r][c].mine) continue;
      let count = 0;
      forNeighbors(r, c, (nr, nc) => {
        if (G.board[nr][nc].mine) count++;
      });
      G.board[r][c].adjacent = count;
    }
  }
}

function forNeighbors(r, c, fn) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) {
        fn(nr, nc);
      }
    }
  }
}

// ============= GAME ACTIONS =============
function revealCell(r, c) {
  const cell = G.board[r][c];
  if (cell.revealed || cell.flagged) return;

  // First click — place mines, start timer
  if (G.state === 'idle') {
    placeMines(r, c);
    startTimer();
    G.state = 'playing';
    updateStatus('playing');
  }

  if (G.state !== 'playing') return;

  cell.revealed = true;
  G.revealedCount++;

  if (cell.mine) {
    gameOver(r, c);
    return;
  }

  // Flood fill for 0-adjacent cells
  if (cell.adjacent === 0) {
    forNeighbors(r, c, (nr, nc) => {
      if (!G.board[nr][nc].revealed && !G.board[nr][nc].flagged) {
        revealCell(nr, nc);
      }
    });
  }

  checkWin();
}

function chordReveal(r, c) {
  const cell = G.board[r][c];
  if (!cell.revealed || cell.adjacent === 0) return;

  // Count flags around
  let flags = 0;
  forNeighbors(r, c, (nr, nc) => {
    if (G.board[nr][nc].flagged) flags++;
  });

  if (flags === cell.adjacent) {
    forNeighbors(r, c, (nr, nc) => {
      if (!G.board[nr][nc].revealed && !G.board[nr][nc].flagged) {
        revealCell(nr, nc);
      }
    });
  }
}

function toggleFlag(r, c) {
  if (G.state !== 'idle' && G.state !== 'playing') return;
  const cell = G.board[r][c];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  G.flagCount += cell.flagged ? 1 : -1;
  updateUI();
}

function checkWin() {
  const totalCells = G.rows * G.cols;
  const nonMines = totalCells - G.totalMines;
  if (G.revealedCount === nonMines) {
    G.state = 'won';
    stopTimer();
    G.gamesPlayed++;
    G.gamesWon++;

    // Track best time
    if (G.bestTimes[G.difficulty] === null || G.timer < G.bestTimes[G.difficulty]) {
      G.bestTimes[G.difficulty] = G.timer;
    }

    // Flag all remaining mines
    for (let r = 0; r < G.rows; r++) {
      for (let c = 0; c < G.cols; c++) {
        if (G.board[r][c].mine && !G.board[r][c].flagged) {
          G.board[r][c].flagged = true;
          G.flagCount++;
        }
      }
    }

    updateStatus('won');
    renderBoard();
    updateUI();
    showWinOverlay();
  }
}

function gameOver(hitR, hitC) {
  G.state = 'lost';
  stopTimer();
  G.gamesPlayed++;

  // Reveal all mines
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (G.board[r][c].mine) {
        G.board[r][c].revealed = true;
      }
    }
  }

  updateStatus('lost');
  renderBoard(hitR, hitC);
  updateUI();

  // Show lose overlay after short delay
  setTimeout(() => {
    document.getElementById('loseOverlay').classList.remove('hidden');
  }, 500);
}

function newGame() {
  stopTimer();
  const diff = DIFFICULTIES[G.difficulty];
  G.cols = diff.cols;
  G.rows = diff.rows;
  G.totalMines = diff.mines;
  G.state = 'idle';
  G.flagCount = 0;
  G.revealedCount = 0;
  G.timer = 0;

  createBoard();
  updateStatus('idle');
  renderBoard();
  updateUI();
  hideOverlays();
}

// ============= TIMER =============
function startTimer() {
  G.startTime = Date.now();
  G.timer = 0;
  G.timerInterval = setInterval(() => {
    G.timer = Math.floor((Date.now() - G.startTime) / 1000);
    document.getElementById('timerDisplay').textContent = `⏱️ ${formatTime(G.timer)}`;
  }, 100);
}

function stopTimer() {
  if (G.timerInterval) {
    clearInterval(G.timerInterval);
    G.timerInterval = null;
  }
  // Final precise time
  if (G.startTime > 0) {
    G.timer = Math.floor((Date.now() - G.startTime) / 1000);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============= RENDERING =============
function renderBoard(hitR, hitC) {
  const board = document.getElementById('board');
  board.style.gridTemplateColumns = `repeat(${G.cols}, 1fr)`;
  board.innerHTML = '';

  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const cell = G.board[r][c];
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.row = r;
      el.dataset.col = c;

      if (cell.revealed) {
        el.classList.add('revealed');
        if (cell.mine) {
          el.classList.add(r === hitR && c === hitC ? 'mine-hit' : 'mine-show');
          el.textContent = '💣';
        } else if (cell.adjacent > 0) {
          el.classList.add(`n${cell.adjacent}`);
          el.textContent = cell.adjacent;
        }
      } else if (cell.flagged) {
        el.classList.add('flagged');
        el.textContent = '🚩';
      } else {
        el.classList.add('unrevealed');
      }

      // Event listeners
      el.addEventListener('click', () => {
        if (G.state === 'won' || G.state === 'lost') return;
        if (cell.revealed) {
          chordReveal(r, c);
          renderBoard();
          updateUI();
        } else {
          revealCell(r, c);
          renderBoard();
          updateUI();
        }
      });

      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (G.state === 'won' || G.state === 'lost') return;
        toggleFlag(r, c);
        renderBoard();
      });

      // Double click for chord
      el.addEventListener('dblclick', e => {
        e.preventDefault();
        if (G.state === 'won' || G.state === 'lost') return;
        if (cell.revealed) {
          chordReveal(r, c);
          renderBoard();
          updateUI();
        }
      });

      board.appendChild(el);
    }
  }
}

function updateUI() {
  document.getElementById('minesDisplay').textContent = `💣 ${G.totalMines - G.flagCount}`;
  document.getElementById('timerDisplay').textContent = `⏱️ ${formatTime(G.timer)}`;
  document.getElementById('diffLabel').textContent =
    G.difficulty.charAt(0).toUpperCase() + G.difficulty.slice(1);

  // Stats
  document.getElementById('statGames').textContent = G.gamesPlayed;
  document.getElementById('statWins').textContent = G.gamesWon;
  document.getElementById('statRate').textContent =
    G.gamesPlayed > 0 ? Math.round(G.gamesWon / G.gamesPlayed * 100) + '%' : '0%';
  document.getElementById('statBest').textContent =
    G.bestTimes[G.difficulty] !== null ? formatTime(G.bestTimes[G.difficulty]) : '—';
}

function updateStatus(state) {
  const emoji = document.getElementById('statusEmoji');
  const text = document.getElementById('statusText');
  switch (state) {
    case 'idle':
      emoji.textContent = '🐶'; text.textContent = 'Click to start'; break;
    case 'playing':
      emoji.textContent = '🤔'; text.textContent = 'Sweeping...'; break;
    case 'won':
      emoji.textContent = '🎉'; text.textContent = 'DOGGED! You won!'; break;
    case 'lost':
      emoji.textContent = '💀'; text.textContent = 'You hit a mine!'; break;
  }
}

function showWinOverlay() {
  document.getElementById('winTime').textContent = formatTime(G.timer);
  document.getElementById('winDiff').textContent =
    G.difficulty.charAt(0).toUpperCase() + G.difficulty.slice(1);
  const savedName = localStorage.getItem('dogged-ms-name') || '';
  document.getElementById('winName').value = savedName;
  document.getElementById('winOverlay').classList.remove('hidden');
}

function hideOverlays() {
  document.getElementById('winOverlay').classList.add('hidden');
  document.getElementById('loseOverlay').classList.add('hidden');
  document.getElementById('winSubmitStatus').classList.add('hidden');
}

// ============= LEADERBOARD =============
async function loadLeaderboard(diff) {
  diff = diff || G.lbDifficulty;
  G.lbDifficulty = diff;
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '<div class="lb-loading">Loading...</div>';
  try {
    const res = await fetch(`/api/minesweeper-leaderboard?difficulty=${diff}`);
    const data = await res.json();
    if (!data.ok) throw new Error('Bad response');
    renderLeaderboard(data.leaderboard || []);
  } catch (e) {
    list.innerHTML = '<div class="lb-loading">Could not load leaderboard</div>';
  }
}

function renderLeaderboard(entries) {
  const list = document.getElementById('leaderboardList');
  if (entries.length === 0) {
    list.innerHTML = '<div class="lb-loading">No times yet — be the first!</div>';
    return;
  }
  list.innerHTML = entries.slice(0, 50).map((entry, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    return `<div class="lb-entry">
      <span class="lb-rank ${rankClass}">${medal}</span>
      <span class="lb-name">${escHtml(entry.name)}</span>
      <span class="lb-time">${formatTime(entry.time)}</span>
    </div>`;
  }).join('');
}

function escHtml(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}

async function submitTime(name) {
  if (!name || name.length < 1 || name.length > 20) return;
  localStorage.setItem('dogged-ms-name', name);

  const ts = Date.now();
  const payload = {
    name,
    time: G.timer,
    difficulty: G.difficulty,
    ts,
    pid: PID,
  };
  payload.sig = AC.sign(payload);

  const status = document.getElementById('winSubmitStatus');
  status.classList.remove('hidden', 'success', 'error');

  try {
    const res = await fetch('/api/minesweeper-leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      status.classList.add('success');
      status.textContent = `✅ Ranked #${data.rank} of ${data.total}!`;
      loadLeaderboard(G.difficulty);
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
      document.querySelector('.left-panel').classList.toggle('mobile-show', panel === 'settings');
      document.querySelector('.right-panel').classList.toggle('mobile-show', panel === 'leaderboard');
    });
  });
}

// ============= INIT =============
function init() {
  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      G.difficulty = btn.dataset.diff;
      newGame();
    });
  });

  // New game button
  document.getElementById('newGameBtn').addEventListener('click', newGame);

  // Win overlay
  document.getElementById('winSubmitBtn').addEventListener('click', () => {
    const name = document.getElementById('winName').value.trim();
    submitTime(name);
  });
  document.getElementById('winRetryBtn').addEventListener('click', newGame);

  // Lose overlay
  document.getElementById('loseRetryBtn').addEventListener('click', newGame);

  // Leaderboard tabs
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadLeaderboard(tab.dataset.lbdiff);
    });
  });

  // Refresh
  document.getElementById('refreshLb').addEventListener('click', () => loadLeaderboard());

  setupMobileNav();
  newGame();
  loadLeaderboard('easy');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
