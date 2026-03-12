(function(){
'use strict';

/* ══════════════════════════════════════
   DOGGED WORDLE — The daily word game
   ══════════════════════════════════════ */

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const WORD_LIST_URL = 'wordle/wordle_possibles.txt';

/* ── Dogged quotes & messages ── */
const QUOTES_IDLE = [
  'Sigve would get this in one guess. Be like Sigve.',
  'Every letter you type is a step closer to dogged greatness.',
  'Think dogged. Think five letters. Think harder.',
  '"Dogged" has 6 letters. The answer has 5. Life is unfair.',
  'Sigve solved this before breakfast. With his eyes closed.',
  'Fun fact: Sigve\'s first word was "dogged." His second was also "dogged."',
  'In Dog City (Vadsø), this game is a school requirement.',
  'Your IQ goes up 5 points for every Dogged Wordle you solve. (Not verified.)',
  'Sigve says: "The answer is always dogged." He\'s wrong. But also right.',
  'Be dogged. Be persistent. Be annoyingly correct.',
];

const QUOTES_GUESS = [
  // After guess 1
  ['5 tries left. Sigve is watching.', 'Bold first move. Very dogged.', 'Interesting strategy. If you can call it that.'],
  // After guess 2
  ['4 left. The pressure is dogged.', 'Hmm. Sigve would have had it by now.', 'Two guesses in. The dogged tension rises.'],
  // After guess 3
  ['Halfway there! Unless you\'re not.', 'Sigve is shaking his head. Doggedly.', '3 down, 3 to go. Classic dogged math.'],
  // After guess 4
  ['Getting worried? Sigve never worries.', 'Two more shots. Make them dogged.', 'The walls are closing in. Doggedly.'],
  // After guess 5
  ['Last chance after this! BE DOGGED!', 'Sigve is stress-eating dog treats for you.', 'One more wrong and it\'s over. No pressure.'],
];

const WIN_MESSAGES = [
  '🤯 IMPOSSIBLE! First try! Are you Sigve?!',
  '🔥 MAGNIFICENT! Sigve-level performance!',
  '💪 DOGGED! That was clean!',
  '👏 SOLID! Dogged perseverance pays off!',
  '😅 CLOSE ONE! But dogged enough!',
  '🫣 BY A WHISKER! Sigve was sweating for you!',
];

const LOSE_MESSAGES = [
  'Sigve is disappointed. Very dogged disappointment.',
  'Even Sigve couldn\'t save you. That\'s saying something.',
  'The word was right there. Doggedly hiding from you.',
  'Tomorrow\'s a new day. A new dogged day.',
];

const INVALID_WORD_TOASTS = [
  'That\'s not a word. Even in Dog City.',
  'Sigve doesn\'t know that word. Nobody does.',
  'Try a real word. Doggedly.',
  'Not in the dictionary. Sigve checked.',
  'That word doesn\'t exist. Like Sigve\'s modesty.',
];

const NOT_ENOUGH_LETTERS = [
  'Need 5 letters! Count with me. Doggedly.',
  '5 letters! Like "Sigve" but different!',
  'More letters please. Be thorough. Be dogged.',
];

/* ── State ── */
let wordList = [];
let validWords = new Set();
let todayWord = '';
let todayIndex = 0;
let currentRow = 0;
let currentCol = 0;
let currentGuess = '';
let guesses = [];
let gameOver = false;
let gameWon = false;
let boardEl, keyboardKeys = {};

/* ── Stats (localStorage) ── */
const STATS_KEY = 'dogged-wordle-stats';
const STATE_KEY = 'dogged-wordle-state';

function defaultStats(){
  return { played:0, won:0, streak:0, maxStreak:0, dist:[0,0,0,0,0,0] };
}
function loadStats(){
  try{ return JSON.parse(localStorage.getItem(STATS_KEY)) || defaultStats(); }
  catch{ return defaultStats(); }
}
function saveStats(s){ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }

function getTodayKey(){
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    if(s && s.date === getTodayKey()) return s;
    return null;
  }catch{ return null; }
}
function saveState(){
  localStorage.setItem(STATE_KEY, JSON.stringify({
    date: getTodayKey(),
    guesses: guesses,
    gameOver: gameOver,
    gameWon: gameWon,
    wordIndex: todayIndex,
  }));
}

/* ── Day-based word selection ── */
function getDayNumber(){
  // Days since a fixed epoch (March 1, 2026)
  const epoch = new Date(Date.UTC(2026, 2, 1)); // March 1, 2026
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((utcNow - epoch) / 86400000);
}

function seededRandom(seed){
  // Simple mulberry32
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffleWithSeed(arr, seed){
  const a = [...arr];
  for(let i = a.length - 1; i > 0; i--){
    seed++;
    const j = Math.floor(seededRandom(seed) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Load word list ── */
async function loadWordList(){
  try{
    const res = await fetch(WORD_LIST_URL);
    const text = await res.text();
    wordList = text.trim().split('\n').map(w=>w.trim().toLowerCase()).filter(w=>w.length===5);
    validWords = new Set(wordList);

    // Shuffle deterministically and pick today's word
    const shuffled = shuffleWithSeed(wordList, 20260301);
    todayIndex = getDayNumber() % shuffled.length;
    todayWord = shuffled[todayIndex < 0 ? shuffled.length + todayIndex : todayIndex];

    return true;
  }catch(err){
    console.error('Failed to load word list:', err);
    showToast('Failed to load words. Reload the page!');
    return false;
  }
}

/* ── Build board ── */
function buildBoard(){
  boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for(let r=0; r<MAX_GUESSES; r++){
    const row = document.createElement('div');
    row.className = 'board-row';
    row.id = `row-${r}`;
    for(let c=0; c<WORD_LENGTH; c++){
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `tile-${r}-${c}`;
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

/* ── Keyboard refs ── */
function buildKeyboardRefs(){
  document.querySelectorAll('.key[data-key]').forEach(btn=>{
    keyboardKeys[btn.dataset.key] = btn;
    btn.addEventListener('click', ()=> handleKey(btn.dataset.key));
  });
}

/* ── Input handling ── */
function handleKey(key){
  if(gameOver) return;

  if(key === 'BACKSPACE'){
    if(currentCol > 0){
      currentCol--;
      currentGuess = currentGuess.slice(0,-1);
      const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
      tile.textContent = '';
      tile.classList.remove('filled');
    }
    return;
  }

  if(key === 'ENTER'){
    submitGuess();
    return;
  }

  // Letter
  if(currentCol < WORD_LENGTH && /^[A-Z]$/.test(key)){
    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    tile.textContent = key;
    tile.classList.add('filled');
    currentGuess += key.toLowerCase();
    currentCol++;
  }
}

document.addEventListener('keydown', e=>{
  if(document.querySelector('.modal:not(.hidden)')) return;
  if(e.ctrlKey || e.metaKey || e.altKey) return;

  if(e.key === 'Backspace'){ handleKey('BACKSPACE'); return; }
  if(e.key === 'Enter'){ handleKey('ENTER'); return; }
  const k = e.key.toUpperCase();
  if(/^[A-Z]$/.test(k)) handleKey(k);
});

/* ── Submit guess ── */
function submitGuess(){
  if(currentCol < WORD_LENGTH){
    const msg = NOT_ENOUGH_LETTERS[Math.floor(Math.random()*NOT_ENOUGH_LETTERS.length)];
    showToast(msg);
    shakeRow(currentRow);
    return;
  }

  if(!validWords.has(currentGuess)){
    const msg = INVALID_WORD_TOASTS[Math.floor(Math.random()*INVALID_WORD_TOASTS.length)];
    showToast(msg);
    shakeRow(currentRow);
    return;
  }

  const guess = currentGuess;
  guesses.push(guess);

  // Evaluate
  const result = evaluateGuess(guess, todayWord);

  // Animate tiles
  revealRow(currentRow, guess, result, ()=>{
    // Update keyboard colors
    for(let i=0; i<WORD_LENGTH; i++){
      const letter = guess[i].toUpperCase();
      const btn = keyboardKeys[letter];
      if(!btn) continue;
      const status = result[i];
      // Only upgrade: absent → present → correct
      if(status === 'correct'){
        btn.className = 'key correct';
        if(btn.classList.contains('key-wide')) btn.classList.add('key-wide');
      } else if(status === 'present' && !btn.classList.contains('correct')){
        btn.className = 'key present';
        if(btn.classList.contains('key-wide')) btn.classList.add('key-wide');
      } else if(status === 'absent' && !btn.classList.contains('correct') && !btn.classList.contains('present')){
        btn.className = 'key absent';
        if(btn.classList.contains('key-wide')) btn.classList.add('key-wide');
      }
    }

    // Check win
    if(guess === todayWord){
      gameOver = true;
      gameWon = true;
      bounceRow(currentRow);
      updateQuote(WIN_MESSAGES[currentRow] || WIN_MESSAGES[5]);
      showToast(WIN_MESSAGES[currentRow] || '🎉 You got it!');
      setTimeout(()=> endGame(true), 1800);
    } else if(currentRow >= MAX_GUESSES - 1){
      gameOver = true;
      gameWon = false;
      const msg = LOSE_MESSAGES[Math.floor(Math.random()*LOSE_MESSAGES.length)];
      updateQuote(msg);
      showToast(`The word was ${todayWord.toUpperCase()}`);
      setTimeout(()=> endGame(false), 1800);
    } else {
      // Update quote
      const quoteSet = QUOTES_GUESS[currentRow] || QUOTES_GUESS[4];
      updateQuote(quoteSet[Math.floor(Math.random()*quoteSet.length)]);
      currentRow++;
    }

    currentCol = 0;
    currentGuess = '';
    saveState();
  });
}

function evaluateGuess(guess, answer){
  const result = new Array(WORD_LENGTH).fill('absent');
  const ansLetters = answer.split('');
  const guessLetters = guess.split('');

  // First pass: correct
  for(let i=0; i<WORD_LENGTH; i++){
    if(guessLetters[i] === ansLetters[i]){
      result[i] = 'correct';
      ansLetters[i] = null;
      guessLetters[i] = null;
    }
  }
  // Second pass: present
  for(let i=0; i<WORD_LENGTH; i++){
    if(guessLetters[i] === null) continue;
    const idx = ansLetters.indexOf(guessLetters[i]);
    if(idx !== -1){
      result[i] = 'present';
      ansLetters[idx] = null;
    }
  }
  return result;
}

/* ── Animations ── */
function revealRow(row, guess, result, callback){
  const tiles = [];
  for(let c=0; c<WORD_LENGTH; c++){
    tiles.push(document.getElementById(`tile-${row}-${c}`));
  }

  let revealed = 0;
  tiles.forEach((tile, i)=>{
    setTimeout(()=>{
      tile.classList.add('flip');
      setTimeout(()=>{
        tile.classList.add(result[i]);
        tile.textContent = guess[i].toUpperCase();
      }, 250);
      setTimeout(()=>{
        tile.classList.remove('flip');
        revealed++;
        if(revealed === WORD_LENGTH && callback) callback();
      }, 500);
    }, i * 300);
  });
}

function shakeRow(row){
  const el = document.getElementById(`row-${row}`);
  el.classList.add('shake');
  setTimeout(()=> el.classList.remove('shake'), 600);
}

function bounceRow(row){
  for(let c=0; c<WORD_LENGTH; c++){
    const tile = document.getElementById(`tile-${row}-${c}`);
    setTimeout(()=> tile.classList.add('bounce'), c * 100);
  }
}

/* ── Toast ── */
function showToast(msg, duration=2200){
  const container = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(()=> toast.remove(), duration);
}

/* ── Quote banner ── */
function updateQuote(text){
  const el = document.getElementById('quoteText');
  el.style.opacity = '0';
  setTimeout(()=>{
    el.textContent = text;
    el.style.opacity = '1';
  }, 300);
}

/* ── End game ── */
function endGame(won){
  // Update stats
  const stats = loadStats();
  stats.played++;
  if(won){
    stats.won++;
    stats.streak++;
    if(stats.streak > stats.maxStreak) stats.maxStreak = stats.streak;
    stats.dist[guesses.length - 1]++;
  } else {
    stats.streak = 0;
  }
  saveStats(stats);

  // Show result
  const overlay = document.getElementById('resultOverlay');
  document.getElementById('resultTitle').textContent = won ? WIN_MESSAGES[guesses.length-1]?.split(' ')[0] || '🎉' : '💀';
  document.getElementById('resultMsg').textContent = won
    ? `You got it in ${guesses.length}/${MAX_GUESSES}!`
    : 'Better luck tomorrow. Stay dogged.';
  document.getElementById('resultWord').textContent = todayWord;

  // Generate share text
  const shareGrid = generateShareGrid();
  document.getElementById('resultShare').textContent = shareGrid;

  overlay.classList.remove('hidden');
  startNextTimer();

  // Confetti on win!
  if(won) fireConfetti();
}

function generateShareGrid(){
  let grid = `🔤 Dogged Wordle #${todayIndex}\n`;
  grid += gameWon ? `${guesses.length}/${MAX_GUESSES}\n\n` : `X/${MAX_GUESSES}\n\n`;
  for(const guess of guesses){
    const result = evaluateGuess(guess, todayWord);
    const row = result.map(r=> r==='correct' ? '🟩' : r==='present' ? '🟨' : '⬛').join('');
    grid += row + '\n';
  }
  grid += '\ndogged.no/wordle';
  return grid;
}

/* ── Share ── */
document.getElementById('shareBtn').addEventListener('click', async ()=>{
  const text = `🔤 Dogged Wordle #${todayIndex}\n` + generateShareGrid();
  try{
    await navigator.clipboard.writeText(text);
    document.getElementById('shareStatus').textContent = 'Copied to clipboard! 📋';
  }catch{
    document.getElementById('shareStatus').textContent = 'Couldn\'t copy. Long-press to select.';
  }
});

/* ── Next timer ── */
function startNextTimer(){
  const timerEl = document.getElementById('nextTimer');
  function update(){
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const diff = tomorrow - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    timerEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  update();
  setInterval(update, 1000);
}

/* ── Confetti 🎉 ── */
function fireConfetti(){
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ff6b35','#4caf50','#b59f3b','#538d4e','#f7c948','#e74c3c','#00bcd4','#9b59b6'];
  const pieces = [];
  const DOGGED_WORDS = ['DOGGED','SIGVE','WOOF','DOG','🐕','🦴','🔥','💪','⭐'];

  for(let i=0; i<120; i++){
    const isText = Math.random() < 0.15;
    pieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 300,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random()*colors.length)],
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.2,
      isText,
      text: isText ? DOGGED_WORDS[Math.floor(Math.random()*DOGGED_WORDS.length)] : '',
    });
  }

  let frame = 0;
  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    for(const p of pieces){
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.rot += p.rotV;
      if(p.y < canvas.height + 50) alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if(p.isText){
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame/180);
        ctx.fillText(p.text, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame/180);
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      }
      ctx.restore();
    }
    frame++;
    if(alive && frame < 200) requestAnimationFrame(animate);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  animate();
}

/* ── Help & Stats modals ── */
document.getElementById('helpBtn').addEventListener('click', ()=>{
  document.getElementById('helpModal').classList.remove('hidden');
});
document.getElementById('helpClose').addEventListener('click', ()=>{
  document.getElementById('helpModal').classList.add('hidden');
});
document.getElementById('helpDone').addEventListener('click', ()=>{
  document.getElementById('helpModal').classList.add('hidden');
});

document.getElementById('statsBtn').addEventListener('click', ()=> showStatsModal());
document.getElementById('statsClose').addEventListener('click', ()=>{
  document.getElementById('statsModal').classList.add('hidden');
});
document.getElementById('statsDone').addEventListener('click', ()=>{
  document.getElementById('statsModal').classList.add('hidden');
});

function showStatsModal(){
  const stats = loadStats();
  document.getElementById('sPlayed').textContent = stats.played;
  document.getElementById('sWin').textContent = stats.played ? Math.round((stats.won/stats.played)*100) : 0;
  document.getElementById('sStreak').textContent = stats.streak;
  document.getElementById('sMaxStreak').textContent = stats.maxStreak;

  const chart = document.getElementById('distChart');
  chart.innerHTML = '';
  const maxVal = Math.max(...stats.dist, 1);
  for(let i=0; i<6; i++){
    const row = document.createElement('div');
    row.className = 'dist-row';
    const label = document.createElement('div');
    label.className = 'dist-label';
    label.textContent = i+1;
    const bar = document.createElement('div');
    bar.className = 'dist-bar';
    const pct = Math.max(8, (stats.dist[i] / maxVal) * 100);
    bar.style.width = pct + '%';
    bar.textContent = stats.dist[i];
    if(gameWon && guesses.length === i+1) bar.classList.add('highlight');
    row.appendChild(label);
    row.appendChild(bar);
    chart.appendChild(row);
  }

  document.getElementById('statsModal').classList.remove('hidden');
}

/* ── Restore saved state ── */
function restoreState(state){
  for(let r=0; r<state.guesses.length; r++){
    const guess = state.guesses[r];
    const result = evaluateGuess(guess, todayWord);
    for(let c=0; c<WORD_LENGTH; c++){
      const tile = document.getElementById(`tile-${r}-${c}`);
      tile.textContent = guess[c].toUpperCase();
      tile.classList.add('filled', result[c]);

      // Update keyboard
      const letter = guess[c].toUpperCase();
      const btn = keyboardKeys[letter];
      if(btn){
        const status = result[c];
        if(status === 'correct'){
          btn.className = 'key correct';
        } else if(status === 'present' && !btn.classList.contains('correct')){
          btn.className = 'key present';
        } else if(status === 'absent' && !btn.classList.contains('correct') && !btn.classList.contains('present')){
          btn.className = 'key absent';
        }
      }
    }
  }

  guesses = [...state.guesses];
  currentRow = guesses.length;
  gameOver = state.gameOver;
  gameWon = state.gameWon;

  if(gameOver){
    setTimeout(()=>{
      if(gameWon){
        updateQuote(WIN_MESSAGES[guesses.length-1] || '🎉 You already solved it today!');
      } else {
        updateQuote(`The word was ${todayWord.toUpperCase()}. Come back tomorrow!`);
      }
      endGame(gameWon);
    }, 500);
  } else {
    const quoteSet = currentRow > 0 ? (QUOTES_GUESS[currentRow-1] || QUOTES_GUESS[4]) : null;
    if(quoteSet) updateQuote(quoteSet[Math.floor(Math.random()*quoteSet.length)]);
  }
}

/* ── Init ── */
async function init(){
  buildBoard();
  buildKeyboardRefs();

  // Random idle quote
  updateQuote(QUOTES_IDLE[Math.floor(Math.random()*QUOTES_IDLE.length)]);

  const loaded = await loadWordList();
  if(!loaded) return;

  // Check saved state
  const saved = loadState();
  if(saved){
    restoreState(saved);
  }
}

init();

})();
