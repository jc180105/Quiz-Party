// === HOST JavaScript ===
const socket = io(API_URL || undefined);

// DOM Elements
const screens = {
    waiting: document.getElementById('screen-waiting'),
    question: document.getElementById('screen-question'),
    results: document.getElementById('screen-results'),
    podium: document.getElementById('screen-podium')
};

function showScreen(name) {
    const current = document.querySelector('.screen.active');
    if (current) {
        current.classList.add('fade-out');
        setTimeout(() => {
            current.classList.remove('active', 'fade-out');
            screens[name].classList.add('active', 'fade-in');
            setTimeout(() => screens[name].classList.remove('fade-in'), 400);
        }, 200);
    } else {
        screens[name].classList.add('active');
    }
}

// --- Sound Effects (Web Audio API) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.3) {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) { /* audio not supported */ }
}

function playTickSound() { playTone(880, 0.15, 'sine', 0.2); }
function playCorrectSound() {
    playTone(523, 0.15, 'sine', 0.3);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 150);
    setTimeout(() => playTone(784, 0.3, 'sine', 0.3), 300);
}
function playWrongSound() { playTone(200, 0.4, 'sawtooth', 0.2); }
function playTransitionSound() { playTone(440, 0.1, 'sine', 0.15); }

// Waiting screen elements
const pinDisplay = document.getElementById('pin-display');
const qrCode = document.getElementById('qr-code');
const joinUrl = document.getElementById('join-url');
const playerCount = document.getElementById('player-count');
const playersGrid = document.getElementById('players-grid');
const btnStart = document.getElementById('btn-start');

// Question screen elements
const timerText = document.getElementById('timer-text');
const timerProgress = document.getElementById('timer-progress');
const questionCounter = document.getElementById('question-counter');
const questionText = document.getElementById('question-text');
const questionMedia = document.getElementById('question-media');
const answerCount = document.getElementById('answer-count');

// Results screen elements
const resultsTitle = document.getElementById('results-title');
const correctAnswer = document.getElementById('correct-answer');
const correctShape = document.getElementById('correct-shape');
const correctText = document.getElementById('correct-text');
const top5List = document.getElementById('top5-list');
const btnNext = document.getElementById('btn-next');
const btnNextText = document.getElementById('btn-next-text');

// Podium screen elements
const btnReset = document.getElementById('btn-reset');

let currentMaxTime = 20;

// --- Helper ---
function loadQRCode() {
    fetch(API_URL + '/api/qrcode')
        .then(r => r.json())
        .then(data => {
            qrCode.src = data.qr;
            pinDisplay.textContent = data.pin;
            const displayUrl = data.url.replace(/^https?:\/\//, '');
            joinUrl.textContent = displayUrl;
        });
}

// --- Init ---
socket.emit('host-join');

// --- Socket Events ---
socket.on('game-pin', (data) => {
    pinDisplay.textContent = data.pin;
    // Load QR after PIN is set (avoids race condition)
    loadQRCode();
});

socket.on('game-settings', (settings) => {
    document.body.className = ''; // Reset
    if (settings && settings.theme) {
        document.body.classList.add('theme-' + settings.theme);
    }
});

socket.on('player-list', (players) => {
    playerCount.textContent = players.length;
    playersGrid.innerHTML = '';

    players.forEach(p => {
        const tag = document.createElement('div');
        tag.className = 'player-tag';

        if (p.avatar) {
            const img = document.createElement('img');
            img.src = p.avatar;
            img.className = 'player-avatar';
            tag.appendChild(img);
        } else {
            // Default avatar or initial
            const initial = document.createElement('span');
            initial.className = 'player-initial';
            initial.textContent = p.name.charAt(0).toUpperCase();
            tag.appendChild(initial);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = p.name;
        tag.appendChild(nameSpan);

        playersGrid.appendChild(tag);
    });

    btnStart.disabled = players.length < 1;
});

socket.on('show-question', (data) => {
    showScreen('question');
    currentMaxTime = data.time;

    questionCounter.textContent = `${data.index + 1} / ${data.total}`;
    questionText.textContent = data.question;

    // Handle Media (Image or Emoji)
    questionMedia.innerHTML = '';
    if (data.image && (data.image.includes('/') || data.image.includes('.'))) {
        const img = document.createElement('img');
        img.src = data.image;
        img.className = 'host-image'; // Add class for CSS control
        questionMedia.appendChild(img);
    } else {
        questionMedia.textContent = data.image;
    }

    answerCount.textContent = '0';
    timerText.textContent = data.time;

    // Reset timer circle
    timerProgress.style.strokeDashoffset = '0';
    timerProgress.classList.remove('warning');

    // Set options
    // Set options
    const shapes = ['▲', '◆', '●', '■'];
    data.options.forEach((opt, i) => {
        const optEl = document.getElementById(`opt-${i}`);
        const optText = document.getElementById(`opt-text-${i}`);

        if (opt.text && opt.text.trim() !== '') {
            optText.textContent = opt.text;
            optEl.style.display = 'flex'; // Show
            optEl.classList.remove('correct', 'dimmed');
        } else {
            optEl.style.display = 'none'; // Hide
        }
    });
});

socket.on('timer-tick', (data) => {
    timerText.textContent = data.timeLeft;
    const circumference = 283;
    const progress = (1 - data.timeLeft / currentMaxTime) * circumference;
    timerProgress.style.strokeDashoffset = progress;

    if (data.timeLeft <= 5) {
        timerProgress.classList.add('warning');
        playTickSound();
    }
});

socket.on('answer-count', (data) => {
    answerCount.textContent = data.count;
});

socket.on('show-results', (data) => {
    showScreen('results');
    playCorrectSound();

    // Highlight correct answer on question screen options
    const colors = ['red', 'blue', 'yellow', 'green'];
    const shapes = ['▲', '◆', '●', '■'];

    correctAnswer.className = `correct-answer color-${colors[data.correct]}`;
    correctShape.textContent = shapes[data.correct];
    correctText.textContent = data.correctText;

    // Chart
    const maxCount = Math.max(...data.answerCounts, 1);
    data.answerCounts.forEach((count, i) => {
        const bar = document.getElementById(`bar-${i}`);
        const height = (count / maxCount) * 120;
        bar.style.height = `${Math.max(height, 4)}px`;
        bar.parentElement.querySelector('.bar-label').textContent = count;
    });

    // Top 5
    top5List.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉', '4°', '5°'];
    data.ranking.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'top5-item';
        item.innerHTML = `
      <span class="rank">${medals[i]}</span>
      <span class="name">${p.name}</span>
      <span class="score">${p.score.toLocaleString()} pts</span>
    `;
        top5List.appendChild(item);
    });

    // Button text
    btnNextText.textContent = data.isLast ? '🏆 Ver Pódio Final' : 'Próxima Pergunta →';
});

socket.on('show-podium', (data) => {
    showScreen('podium');
    const ranking = data.ranking;

    // Fill podium places
    if (ranking[0]) {
        document.getElementById('podium-name-1').textContent = ranking[0].name;
        document.getElementById('podium-score-1').textContent = `${ranking[0].score.toLocaleString()} pts`;
        fillPodiumAvatar('podium-avatar-1', ranking[0]);
    }
    if (ranking[1]) {
        document.getElementById('podium-name-2').textContent = ranking[1].name;
        document.getElementById('podium-score-2').textContent = `${ranking[1].score.toLocaleString()} pts`;
        fillPodiumAvatar('podium-avatar-2', ranking[1]);
    }
    if (ranking[2]) {
        document.getElementById('podium-name-3').textContent = ranking[2].name;
        document.getElementById('podium-score-3').textContent = `${ranking[2].score.toLocaleString()} pts`;
        fillPodiumAvatar('podium-avatar-3', ranking[2]);
    }

    // Full ranking (4th place onwards)
    const fullRanking = document.getElementById('full-ranking');
    fullRanking.innerHTML = '';
    ranking.slice(3).forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'rank-item';
        item.innerHTML = `
      <span class="rank-pos">${i + 4}°</span>
      <span class="rank-name">${p.name}</span>
      <span class="rank-score">${p.score.toLocaleString()} pts</span>
    `;
        fullRanking.appendChild(item);
    });

    // Confetti effect
    launchConfetti();
});

socket.on('game-reset', () => {
    showScreen('waiting');
    loadQRCode();
});

// --- Button Handlers ---
btnStart.addEventListener('click', () => {
    socket.emit('start-game');
    btnStart.disabled = true;
});

btnNext.addEventListener('click', () => {
    socket.emit('next-question');
});

btnReset.addEventListener('click', () => {
    socket.emit('reset-game');
});

// --- Fill Podium Avatar ---
function fillPodiumAvatar(elementId, player) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    if (player.avatar) {
        const img = document.createElement('img');
        img.src = player.avatar;
        img.alt = player.name;
        container.appendChild(img);
    } else {
        const initial = document.createElement('span');
        initial.className = 'podium-initial';
        initial.textContent = player.name.charAt(0).toUpperCase();
        container.appendChild(initial);
    }
}

// --- Confetti Effect ---
function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettiPieces = [];
    const colors = ['#ffd700', '#e21b3c', '#1368ce', '#26890c', '#d89e00', '#c56cf0', '#ff6b6b'];

    for (let i = 0; i < 150; i++) {
        confettiPieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 12 + 6,
            h: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 2,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.2
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confettiPieces.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
            p.y += p.speed;
            p.angle += p.spin;
            p.x += Math.sin(p.angle) * 0.5;
        });

        frame++;
        if (frame < 300) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    animate();
}
