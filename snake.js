(function(){
'use strict';

/* ── Constants ── */
const GRID = 20;
const CELL = 30; // canvas 600 / 20 = 30px cells
const BASE_SPEED = 150; // ms per tick
const SPEED_INC = 5;    // speed up every N food
const SPEED_MIN = 60;   // fastest tick
const API = '/api/snake-leaderboard';

/* ── Anti-cheat ── */
const SECRET = ['D0G','G3D','-S1','GV3','-20','26'].join('');
function simpleHash(s){
  let h=0;
  for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0}
  return(h>>>0).toString(36);
}

/* ── Player ID ── */
function getPid(){
  let pid=localStorage.getItem('dogged-snake-pid');
  if(!pid){pid=crypto.randomUUID();localStorage.setItem('dogged-snake-pid',pid)}
  return pid;
}
const PID=getPid();

/* ── DOM ── */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl    = document.getElementById('scoreDisplay');
const highEl     = document.getElementById('highDisplay');
const speedEl    = document.getElementById('speedDisplay');
const finalEl    = document.getElementById('finalScore');
const nameInput  = document.getElementById('playerName');
const submitBtn  = document.getElementById('submitBtn');
const submitStatus = document.getElementById('submitStatus');
const retryBtn   = document.getElementById('retryBtn');
const startBtn   = document.getElementById('startBtn');
const refreshLb  = document.getElementById('refreshLb');
const lbList     = document.getElementById('leaderboardList');

const startOverlay    = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const pauseOverlay    = document.getElementById('pauseOverlay');

const statGames = document.getElementById('statGames');
const statHigh  = document.getElementById('statHigh');
const statEaten = document.getElementById('statEaten');

/* ── State ── */
let snake, dir, nextDir, food, score, highScore, speed, speedLevel;
let gameLoop, running, paused;
let sessionGames=0, sessionEaten=0;

// Dogged food emojis
const FOODS = ['🐕','🦴','🏈','💪','🔥','⭐','👑','🎯'];

highScore = parseInt(localStorage.getItem('dogged-snake-high')||'0',10);
highEl.textContent = highScore;

/* saved player name */
const savedName = localStorage.getItem('dogged-snake-name')||'';
nameInput.value = savedName;

/* ── Init ── */
function initGame(){
  const mid = Math.floor(GRID/2);
  snake = [{x:mid,y:mid},{x:mid-1,y:mid},{x:mid-2,y:mid}];
  dir = {x:1,y:0};
  nextDir = {x:1,y:0};
  score = 0;
  speedLevel = 1;
  speed = BASE_SPEED;
  running = true;
  paused = false;
  scoreEl.textContent = '0';
  speedEl.textContent = '1';
  spawnFood();
}

function spawnFood(){
  let pos;
  do {
    pos = {x:Math.floor(Math.random()*GRID), y:Math.floor(Math.random()*GRID)};
  } while(snake.some(s=>s.x===pos.x && s.y===pos.y));
  food = pos;
  food.emoji = FOODS[Math.floor(Math.random()*FOODS.length)];
}

/* ── Game loop ── */
function tick(){
  if(!running||paused) return;

  dir = {...nextDir};
  const head = {x:snake[0].x+dir.x, y:snake[0].y+dir.y};

  // Wall collision
  if(head.x<0||head.x>=GRID||head.y<0||head.y>=GRID){
    return gameOver();
  }
  // Self collision
  if(snake.some(s=>s.x===head.x&&s.y===head.y)){
    return gameOver();
  }

  snake.unshift(head);

  // Eat food
  if(head.x===food.x && head.y===food.y){
    score++;
    sessionEaten++;
    scoreEl.textContent = score;
    statEaten.textContent = sessionEaten;

    if(score > highScore){
      highScore = score;
      highEl.textContent = highScore;
      statHigh.textContent = highScore;
      localStorage.setItem('dogged-snake-high', highScore);
    }

    // Speed up
    if(score % SPEED_INC === 0 && speed > SPEED_MIN){
      speed = Math.max(SPEED_MIN, speed - 12);
      speedLevel++;
      speedEl.textContent = speedLevel;
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
    }

    spawnFood();
  } else {
    snake.pop();
  }

  draw();
}

/* ── Drawing ── */
function draw(){
  ctx.fillStyle = '#0a0a16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(76,175,80,0.06)';
  ctx.lineWidth = 1;
  for(let i=0;i<=GRID;i++){
    ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,canvas.height);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i*CELL);ctx.lineTo(canvas.width,i*CELL);ctx.stroke();
  }

  // Snake
  snake.forEach((seg,i)=>{
    const x=seg.x*CELL, y=seg.y*CELL;
    if(i===0){
      // Head
      ctx.fillStyle='#4caf50';
      ctx.shadowColor='rgba(76,175,80,0.6)';
      ctx.shadowBlur=12;
      roundRect(ctx, x+1, y+1, CELL-2, CELL-2, 6);
      ctx.fill();
      ctx.shadowBlur=0;

      // Eyes
      const eyeSize = 4;
      ctx.fillStyle='#fff';
      if(dir.x===1){
        ctx.beginPath();ctx.arc(x+CELL-8,y+8,eyeSize,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+CELL-8,y+CELL-8,eyeSize,0,Math.PI*2);ctx.fill();
      } else if(dir.x===-1){
        ctx.beginPath();ctx.arc(x+8,y+8,eyeSize,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+8,y+CELL-8,eyeSize,0,Math.PI*2);ctx.fill();
      } else if(dir.y===-1){
        ctx.beginPath();ctx.arc(x+8,y+8,eyeSize,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+CELL-8,y+8,eyeSize,0,Math.PI*2);ctx.fill();
      } else {
        ctx.beginPath();ctx.arc(x+8,y+CELL-8,eyeSize,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+CELL-8,y+CELL-8,eyeSize,0,Math.PI*2);ctx.fill();
      }
      // Pupils
      ctx.fillStyle='#0a0a16';
      if(dir.x===1){
        ctx.beginPath();ctx.arc(x+CELL-6,y+8,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+CELL-6,y+CELL-8,2,0,Math.PI*2);ctx.fill();
      } else if(dir.x===-1){
        ctx.beginPath();ctx.arc(x+6,y+8,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+6,y+CELL-8,2,0,Math.PI*2);ctx.fill();
      } else if(dir.y===-1){
        ctx.beginPath();ctx.arc(x+8,y+6,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+CELL-8,y+6,2,0,Math.PI*2);ctx.fill();
      } else {
        ctx.beginPath();ctx.arc(x+8,y+CELL-6,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x+CELL-8,y+CELL-6,2,0,Math.PI*2);ctx.fill();
      }
    } else {
      // Body
      const alpha = 1 - (i / snake.length) * 0.5;
      ctx.fillStyle = `rgba(76,175,80,${alpha})`;
      roundRect(ctx, x+1, y+1, CELL-2, CELL-2, 4);
      ctx.fill();
    }
  });

  // Food emoji
  ctx.font = `${CELL - 6}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(food.emoji, food.x*CELL + CELL/2, food.y*CELL + CELL/2 + 2);
}

function roundRect(c, x, y, w, h, r){
  c.beginPath();
  c.moveTo(x+r,y);
  c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
}

/* ── Game Over ── */
function gameOver(){
  running = false;
  clearInterval(gameLoop);
  sessionGames++;
  statGames.textContent = sessionGames;

  finalEl.textContent = score;
  submitBtn.disabled = false;
  submitStatus.textContent = '';
  gameOverOverlay.classList.remove('hidden');

  // Flash the canvas border red
  const wrap = document.querySelector('.canvas-wrap');
  wrap.style.borderColor = 'var(--red)';
  wrap.style.boxShadow = '0 0 30px rgba(231,76,60,.4)';
  setTimeout(()=>{
    wrap.style.borderColor = 'var(--green)';
    wrap.style.boxShadow = '0 0 30px var(--green-glow)';
  }, 800);
}

/* ── Start / Restart ── */
function startGame(){
  startOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  initGame();
  draw();
  gameLoop = setInterval(tick, speed);
}

startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

/* ── Pause ── */
function togglePause(){
  if(!running) return;
  paused = !paused;
  if(paused){
    pauseOverlay.classList.remove('hidden');
  } else {
    pauseOverlay.classList.add('hidden');
  }
}

/* ── Input ── */
document.addEventListener('keydown', e=>{
  if(e.key==='r'||e.key==='R'){
    if(!running){startGame();return}
  }
  if(e.key===' '){
    e.preventDefault();
    if(!running && startOverlay.classList.contains('hidden')){startGame();return}
    togglePause();return;
  }
  if(!running||paused) return;

  switch(e.key){
    case 'ArrowUp':case 'w':case 'W':
      if(dir.y!==1) nextDir={x:0,y:-1}; break;
    case 'ArrowDown':case 's':case 'S':
      if(dir.y!==-1) nextDir={x:0,y:1}; break;
    case 'ArrowLeft':case 'a':case 'A':
      if(dir.x!==1) nextDir={x:-1,y:0}; break;
    case 'ArrowRight':case 'd':case 'D':
      if(dir.x!==-1) nextDir={x:1,y:0}; break;
  }
});

/* ── Touch / Swipe ── */
let touchStart = null;
canvas.addEventListener('touchstart', e=>{
  const t = e.touches[0];
  touchStart = {x:t.clientX, y:t.clientY};
}, {passive:true});
canvas.addEventListener('touchend', e=>{
  if(!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  if(Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if(Math.abs(dx)>Math.abs(dy)){
    if(dx>0 && dir.x!==-1) nextDir={x:1,y:0};
    else if(dx<0 && dir.x!==1) nextDir={x:-1,y:0};
  } else {
    if(dy>0 && dir.y!==-1) nextDir={x:0,y:1};
    else if(dy<0 && dir.y!==1) nextDir={x:0,y:-1};
  }
  touchStart=null;
}, {passive:true});

/* ── Touch buttons ── */
document.querySelectorAll('.touch-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(!running||paused) return;
    const d = btn.dataset.dir;
    if(d==='up'    && dir.y!==1)  nextDir={x:0,y:-1};
    if(d==='down'  && dir.y!==-1) nextDir={x:0,y:1};
    if(d==='left'  && dir.x!==1)  nextDir={x:-1,y:0};
    if(d==='right' && dir.x!==-1) nextDir={x:1,y:0};
  });
});

/* ── Submit Score ── */
submitBtn.addEventListener('click', async ()=>{
  const name = nameInput.value.trim();
  if(!name){submitStatus.textContent='Enter a name!';return}
  if(name.length>20){submitStatus.textContent='Max 20 chars';return}
  if(/<|>|&/.test(name)){submitStatus.textContent='No special chars';return}
  if(score<1){submitStatus.textContent='Score too low';return}

  submitBtn.disabled=true;
  submitStatus.textContent='Submitting…';

  localStorage.setItem('dogged-snake-name',name);

  const ts=Date.now();
  const sigStr=`SNAKE|${name}|${score}|${ts}|${PID}|${SECRET}`;
  const sig=simpleHash(sigStr);

  try{
    const res=await fetch(API,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,score,ts,sig,pid:PID})
    });
    const data=await res.json();
    if(data.ok){
      submitStatus.textContent=`🏆 Rank #${data.rank} of ${data.total}!`;
      submitStatus.style.color='var(--green)';
      loadLeaderboard();
    } else {
      submitStatus.textContent=data.error||'Submit failed';
      submitStatus.style.color='var(--red)';
      submitBtn.disabled=false;
    }
  }catch(err){
    submitStatus.textContent='Network error';
    submitStatus.style.color='var(--red)';
    submitBtn.disabled=false;
  }
});

/* ── Leaderboard ── */
async function loadLeaderboard(){
  lbList.innerHTML='<li class="lb-empty">Loading…</li>';
  try{
    const res = await fetch(API);
    const data = await res.json();
    if(!data.ok||!data.leaderboard||!data.leaderboard.length){
      lbList.innerHTML='<li class="lb-empty">No scores yet. Be the first! 🐍</li>';
      return;
    }
    lbList.innerHTML='';
    data.leaderboard.forEach(e=>{
      const li=document.createElement('li');
      li.innerHTML=`<span class="lb-name">${escHtml(e.name)}</span><span class="lb-score">${e.score}</span>`;
      lbList.appendChild(li);
    });
  }catch{
    lbList.innerHTML='<li class="lb-empty">Failed to load</li>';
  }
}

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

refreshLb.addEventListener('click',loadLeaderboard);

/* ── Mobile nav ── */
document.querySelectorAll('.mob-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.mob-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const p=btn.dataset.panel;
    document.getElementById('settingsPanel').classList.toggle('show',p==='settings');
    document.getElementById('leaderboardPanel').classList.toggle('show',p==='leaderboard');
    if(p!=='settings') document.getElementById('settingsPanel').classList.remove('show');
    if(p!=='leaderboard') document.getElementById('leaderboardPanel').classList.remove('show');
  });
});

/* ── Init ── */
initGame();
draw();
loadLeaderboard();

})();
