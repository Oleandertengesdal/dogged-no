// ===== DOGGED RAIN BACKGROUND =====
function createDoggedRain() {
  const container = document.getElementById('doggedRain');
  const words = ['dogged', 'DOGGED', 'Dogged', 'D O G G E D', '🐶 dogged', 'dogged™'];
  
  setInterval(() => {
    const word = document.createElement('span');
    word.className = 'dogged-word';
    word.textContent = words[Math.floor(Math.random() * words.length)];
    word.style.left = Math.random() * 100 + '%';
    word.style.fontSize = (1 + Math.random() * 2) + 'rem';
    word.style.animationDuration = (5 + Math.random() * 10) + 's';
    container.appendChild(word);
    
    setTimeout(() => word.remove(), 15000);
  }, 800);
}

// ===== SPEECH BUBBLE CYCLING =====
function cycleSpeechBubbles() {
  const bubble = document.getElementById('speechBubble');
  const phrases = [
    'dogged!',
    'that\'s dogged',
    'so dogged',
    'dogged bro',
    'absolutely dogged',
    'mega dogged',
    'dogged af',
    'pure dogged',
    'too dogged',
    'dogged moment',
    '100% dogged',
    'DOGGED!!!',
    'kinda dogged',
    'dogged energy',
    'lowkey dogged',
    'highkey dogged',
    'ultra dogged',
    'dogged vibes',
    'that hits dogged',
    'dogged certified',
  ];
  
  let i = 0;
  setInterval(() => {
    bubble.style.transform = 'scale(0)';
    setTimeout(() => {
      bubble.textContent = phrases[i % phrases.length];
      bubble.style.transform = 'scale(1)';
      i++;
    }, 200);
  }, 2000);
}

// ===== LIVE COUNTER =====
function startCounter() {
  const counter = document.getElementById('counter');
  let count = 0;
  
  // Start from a "realistic" morning count based on current hour
  const hour = new Date().getHours();
  count = Math.floor(hour * 47 + Math.random() * 100);
  counter.textContent = count;
  
  // Increment randomly
  setInterval(() => {
    count += Math.floor(Math.random() * 3) + 1;
    counter.textContent = count.toLocaleString();
  }, Math.random() * 2000 + 500);
}

// ===== STAT NUMBER ANIMATION =====
function animateStats() {
  const statNumbers = document.querySelectorAll('.stat-number');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.target);
        animateNumber(entry.target, 0, target, 2000);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  statNumbers.forEach(num => observer.observe(num));
}

function animateNumber(element, start, end, duration) {
  const range = end - start;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + range * eased);
    
    element.textContent = current.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// ===== QUOTE GENERATOR =====
const quotes = [
  "\"That sunset is absolutely dogged.\"",
  "\"I just had the most dogged sandwich of my life.\"",
  "\"I can't come out tonight, I'm feeling too dogged.\"",
  "\"My new shoes? Dogged.\"",
  "\"This weather is dogged bro, completely dogged.\"",
  "\"I dogged-ly refuse to stop saying dogged.\"",
  "\"If you think about it, everything is just... dogged.\"",
  "\"She said she doesn't understand 'dogged.' Can you believe that? Dogged.\"",
  "\"I'm not addicted to saying dogged. That's a dogged accusation.\"",
  "\"My therapist asked me to use other words. I said that's dogged.\"",
  "\"Just finished a 10k. Dogged performance if I say so myself.\"",
  "\"Happy birthday! Hope it's absolutely dogged!\"",
  "\"The meaning of life? Easy. Dogged.\"",
  "\"I told my mom I love her. In a dogged way.\"",
  "\"Lost my keys. Dogged situation.\"",
  "\"Got a promotion at work! So dogged!\"",
  "\"The WiFi is down. This is the least dogged thing ever.\"",
  "\"I could explain quantum physics but I'll just say: dogged.\"",
  "\"My New Year's resolution is to say dogged more.\"",
  "\"Just named my pet goldfish Dogged.\"",
];

function setupQuotes() {
  const quoteText = document.getElementById('quoteText');
  const newQuoteBtn = document.getElementById('newQuoteBtn');
  
  function showRandomQuote() {
    quoteText.style.opacity = 0;
    setTimeout(() => {
      quoteText.textContent = quotes[Math.floor(Math.random() * quotes.length)];
      quoteText.style.opacity = 1;
    }, 300);
  }
  
  showRandomQuote();
  newQuoteBtn.addEventListener('click', showRandomQuote);
  quoteText.style.transition = 'opacity 0.3s';
}

// ===== TIMELINE SCROLL ANIMATION =====
function setupTimeline() {
  const items = document.querySelectorAll('.timeline-item');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.3 });
  
  items.forEach(item => observer.observe(item));
}

// ===== DOGGED BUTTON =====
function setupDoggedButton() {
  const btn = document.getElementById('doggedBtn');
  const countEl = document.getElementById('clickCount');
  const messageEl = document.getElementById('clickMessage');
  let clickCount = 0;
  
  const messages = [
    { threshold: 0, text: "You're not even close to his level" },
    { threshold: 5, text: "Rookie numbers" },
    { threshold: 15, text: "Starting to feel it, huh?" },
    { threshold: 30, text: "You might have a problem" },
    { threshold: 50, text: "Okay you DEFINITELY have a problem" },
    { threshold: 75, text: "You're becoming him..." },
    { threshold: 100, text: "YOU ARE HIM 🐶" },
    { threshold: 150, text: "Even he would say that's too dogged" },
    { threshold: 200, text: "Seek professional help (doggedly)" },
    { threshold: 300, text: "There is no going back. You are dogged." },
    { threshold: 500, text: "DOGGED ASCENSION COMPLETE 🚀" },
  ];
  
  btn.addEventListener('click', (e) => {
    clickCount++;
    countEl.textContent = clickCount;
    
    // Update message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (clickCount >= messages[i].threshold) {
        messageEl.textContent = messages[i].text;
        break;
      }
    }
    
    // Spawn floating "dogged" at click position
    spawnDoggedPop(e.clientX, e.clientY);
    
    // Play sound effect (vibrate if mobile)
    if (navigator.vibrate) navigator.vibrate(50);
  });
}

// ===== FLOATING DOGGED POP =====
function spawnDoggedPop(x, y) {
  const pop = document.createElement('div');
  pop.className = 'dogged-pop';
  pop.textContent = 'dogged!';
  pop.style.left = (x + (Math.random() - 0.5) * 60) + 'px';
  pop.style.top = y + 'px';
  pop.style.transform = `rotate(${(Math.random() - 0.5) * 40}deg)`;
  document.body.appendChild(pop);
  
  setTimeout(() => pop.remove(), 1000);
}

// ===== CURSOR TRAIL =====
function setupCursorTrail() {
  let lastTime = 0;
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastTime < 150) return;
    lastTime = now;
    
    if (Math.random() > 0.3) return; // Don't spawn every time
    
    const trail = document.createElement('div');
    trail.className = 'dogged-pop';
    trail.textContent = '🐶';
    trail.style.left = e.clientX + 'px';
    trail.style.top = e.clientY + 'px';
    trail.style.fontSize = '1rem';
    document.body.appendChild(trail);
    
    setTimeout(() => trail.remove(), 1000);
  });
}

// ===== KONAMI CODE EASTER EGG =====
function setupKonami() {
  const konamiCode = ['d', 'o', 'g', 'g', 'e', 'd'];
  let konamiIndex = 0;
  
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === konamiCode[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiCode.length) {
        konamiIndex = 0;
        activateDoggedMode();
      }
    } else {
      konamiIndex = 0;
    }
  });
}

function activateDoggedMode() {
  document.body.style.animation = 'none';
  
  // Spawn tons of images
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const img = document.createElement('img');
      img.src = 'dogged-guy.jpg';
      img.style.cssText = `
        position: fixed;
        width: ${50 + Math.random() * 100}px;
        height: ${50 + Math.random() * 100}px;
        object-fit: cover;
        border-radius: 50%;
        left: ${Math.random() * 100}vw;
        top: ${Math.random() * 100}vh;
        z-index: 10000;
        pointer-events: none;
        animation: popUp 2s ease-out forwards;
        border: 3px solid #ff6b35;
      `;
      document.body.appendChild(img);
      setTimeout(() => img.remove(), 2000);
    }, i * 100);
  }
  
  // Flash the page
  document.body.style.transition = 'background 0.1s';
  let flashes = 0;
  const flashInterval = setInterval(() => {
    document.body.style.background = flashes % 2 === 0 ? '#ff6b35' : '#0f0f1a';
    flashes++;
    if (flashes > 6) {
      clearInterval(flashInterval);
      document.body.style.background = '#0f0f1a';
    }
  }, 100);
}

// ===== PAGE TITLE ANIMATION =====
function animateTitle() {
  const titles = [
    'dogged.no',
    'DOGGED.NO',
    'd o g g e d . n o',
    '🐶 dogged.no 🐶',
    'dogged.no — he said it again',
    'dogged.no — stop him',
    'dogged.no — please',
  ];
  
  let i = 0;
  setInterval(() => {
    document.title = titles[i % titles.length];
    i++;
  }, 3000);
}

// ===== DOG CITY MAP =====
function setupDogCityMap() {
  const mapEl = document.getElementById('dogCityMap');
  if (!mapEl || typeof L === 'undefined') return;

  // Vadsø coordinates
  const vadsoLat = 70.0734;
  const vadsoLng = 29.7497;

  const map = L.map('dogCityMap', {
    center: [vadsoLat, vadsoLng],
    zoom: 5,
    zoomControl: true,
    scrollWheelZoom: true,
  });

  // Dark-themed tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Custom dog city icon
  const dogIcon = L.divIcon({
    html: `<div style="
      width: 60px; height: 60px; border-radius: 50%;
      border: 4px solid #ff6b35;
      box-shadow: 0 0 20px rgba(255,107,53,0.6), 0 0 40px rgba(255,107,53,0.3);
      overflow: hidden; animation: pulse 2s ease-in-out infinite;
    "><img src="dogged-guy.jpg" style="width:100%;height:100%;object-fit:cover;" /></div>`,
    className: 'dog-city-marker',
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -35],
  });

  // Marker
  const marker = L.marker([vadsoLat, vadsoLng], { icon: dogIcon }).addTo(map);

  // Popup
  marker.bindPopup(`
    <div class="dog-city-content">
      <img src="dogged-guy.jpg" alt="Sigve" />
      <h3>🐶 DOG CITY 🐶</h3>
      <p>The official capital of everything dogged. Population: Sigve + an entire city that didn't ask for this.</p>
      <p class="real-name">Real name: Vadsø — but Sigve doesn't acknowledge that</p>
    </div>
  `, {
    className: 'dog-city-popup',
    maxWidth: 250,
  }).openPopup();

  // Add a glowing circle around Dog City
  L.circle([vadsoLat, vadsoLng], {
    radius: 15000,
    color: '#ff6b35',
    fillColor: '#ff6b35',
    fillOpacity: 0.08,
    weight: 2,
    opacity: 0.5,
  }).addTo(map);

  // Add a label overlay
  L.circle([vadsoLat, vadsoLng], {
    radius: 50000,
    color: '#ff6b35',
    fillColor: '#ff6b35',
    fillOpacity: 0.03,
    weight: 1,
    opacity: 0.2,
    dashArray: '5,10',
  }).addTo(map).bindTooltip('🐶 DOGGED TERRITORY 🐶', {
    permanent: true,
    direction: 'bottom',
    className: 'dogged-territory-label',
    offset: [0, 50],
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  createDoggedRain();
  cycleSpeechBubbles();
  startCounter();
  animateStats();
  setupQuotes();
  setupTimeline();
  setupDoggedButton();
  setupCursorTrail();
  setupKonami();
  animateTitle();
  setupDogCityMap();
});
