// === PLAYER JavaScript ===
const socket = io(API_URL || undefined, {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

// DOM Elements
const screens = {
    join: document.getElementById('screen-join'),
    lobby: document.getElementById('screen-lobby'),
    answer: document.getElementById('screen-answer'),
    feedback: document.getElementById('screen-feedback'),
    waitNext: document.getElementById('screen-wait-next'),
    final: document.getElementById('screen-final')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// Join elements
const inputPin = document.getElementById('input-pin');
const inputName = document.getElementById('input-name');
const btnJoin = document.getElementById('btn-join');
const joinError = document.getElementById('join-error');

// Lobby elements
const lobbyName = document.getElementById('lobby-name');

// --- AVATAR LOGIC ---
const avatarInput = document.getElementById('avatar-input');
const avatarPreview = document.getElementById('avatar-preview');
const avatarImg = document.getElementById('avatar-img');
const avatarPlaceholder = document.querySelector('.avatar-placeholder');
let avatarUrl = null;

if (avatarPreview && avatarInput) {
    // Click on preview triggers file input
    avatarPreview.addEventListener('click', () => avatarInput.click());

    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Optimistic Preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            avatarImg.src = ev.target.result;
            avatarImg.style.display = 'block';
            if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        // Upload to Server
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(API_URL + '/api/upload', { method: 'POST', body: formData });
            if (res.ok) {
                const data = await res.json();
                avatarUrl = data.url;
                console.log('Avatar upload success:', avatarUrl);
            } else {
                console.error('Upload failed:', await res.text());
                alert('Erro ao enviar foto. Tente uma imagem menor.');
            }
        } catch (err) {
            console.error('Upload error', err);
            alert('Erro de conexão ao enviar foto.');
        }
    });
}

// Answer elements
const answerTimer = document.getElementById('answer-timer');
const answerCounterText = document.getElementById('answer-counter-text');
const answerBtns = document.querySelectorAll('.answer-btn');

// Feedback elements
const feedbackContainer = document.querySelector('.feedback-container');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackPoints = document.getElementById('feedback-points');
const feedbackStreak = document.getElementById('feedback-streak');

// Final elements
const finalPosition = document.getElementById('final-position');
const finalName = document.getElementById('final-name');
const finalYourScore = document.getElementById('final-your-score');
const finalMessage = document.getElementById('final-message');

let playerName = '';
let hasAnswered = false;

// --- Auto-fill PIN from URL ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('pin')) {
    inputPin.value = urlParams.get('pin');
    inputName.focus();
}

// --- Join Game ---
btnJoin.addEventListener('click', joinGame);
inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinGame();
});
inputPin.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') inputName.focus();
});

function joinGame() {
    const pin = inputPin.value.trim();
    const name = inputName.value.trim();

    if (!pin || pin.length < 4) {
        joinError.textContent = 'Digite o PIN do jogo!';
        return;
    }
    if (!name) {
        joinError.textContent = 'Digite seu apelido!';
        return;
    }

    joinError.textContent = '';
    playerName = name;
    socket.emit('player-join', { pin, name, avatar: avatarUrl });
}

// --- Socket Events ---
socket.on('join-success', (data) => {
    lobbyName.textContent = data.name;
    showScreen('lobby');
});

socket.on('join-error', (data) => {
    joinError.textContent = data.message;
});

socket.on('show-options', (data) => {
    showScreen('answer');
    hasAnswered = false;

    answerCounterText.textContent = `Pergunta ${data.index + 1} / ${data.total}`;
    answerTimer.textContent = data.time;

    // Show question text on mobile
    const questionTextEl = document.getElementById('answer-question-text');
    if (questionTextEl && data.question) {
        questionTextEl.textContent = data.question;
        questionTextEl.style.display = 'block';
    }

    // Reset buttons
    answerBtns.forEach((btn, i) => {
        btn.classList.remove('selected', 'disabled');

        // Check availability
        const opt = data.options[i];
        if (opt && opt.text && opt.text.trim() !== '') {
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
        }
    });
});

socket.on('timer-tick', (data) => {
    answerTimer.textContent = data.timeLeft;
});

socket.on('answer-result', (data) => {
    showScreen('feedback');

    if (data.correct) {
        feedbackContainer.className = 'feedback-container correct';
        feedbackIcon.textContent = '✅';
        feedbackTitle.textContent = 'Correto!';
        feedbackPoints.textContent = `+${data.points.toLocaleString()} pts`;
        feedbackStreak.textContent = data.streak > 1 ? `🔥 Streak: ${data.streak}` : '';
        feedbackStreak.style.display = data.streak > 1 ? 'block' : 'none';
    } else {
        feedbackContainer.className = 'feedback-container incorrect';
        feedbackIcon.textContent = '❌';
        feedbackTitle.textContent = 'Errado!';
        feedbackPoints.textContent = '+0 pts';
        feedbackStreak.style.display = 'none';
    }

    // After 2s, show wait screen
    setTimeout(() => {
        showScreen('waitNext');
    }, 2500);
});

socket.on('question-ended', (data) => {
    // If player hasn't answered, show as wrong
    if (!hasAnswered) {
        showScreen('feedback');
        feedbackContainer.className = 'feedback-container incorrect';
        feedbackIcon.textContent = '⏰';
        feedbackTitle.textContent = 'Tempo esgotado!';
        feedbackPoints.textContent = '+0 pts';
        feedbackStreak.style.display = 'none';

        setTimeout(() => {
            showScreen('waitNext');
        }, 2000);
    }
});

socket.on('show-final-rank', (data) => {
    showScreen('final');
    const ranking = data.ranking;

    // Find this player's position
    const myIndex = ranking.findIndex(p => p.id === socket.id);
    const position = myIndex + 1;

    finalPosition.textContent = `${position}°`;
    finalName.textContent = playerName;
    finalYourScore.textContent = `${ranking[myIndex]?.score?.toLocaleString() || 0} pts`;

    if (position === 1) {
        finalMessage.textContent = '🏆 CAMPEÃO! Parabéns!!! 🎉';
    } else if (position === 2) {
        finalMessage.textContent = '🥈 Vice-campeão! Incrível!';
    } else if (position === 3) {
        finalMessage.textContent = '🥉 Terceiro lugar! Muito bom!';
    } else if (position <= 5) {
        finalMessage.textContent = '⭐ Top 5! Ótima performance!';
    } else if (position <= 10) {
        finalMessage.textContent = '👏 Top 10! Bom trabalho!';
    } else {
        finalMessage.textContent = '🎮 Obrigado por jogar!';
    }
});

socket.on('game-reset', () => {
    showScreen('lobby');
});

// --- Answer Button Handlers ---
answerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (hasAnswered) return;
        hasAnswered = true;

        const index = parseInt(btn.dataset.index);
        btn.classList.add('selected');

        // Disable all buttons
        answerBtns.forEach(b => {
            if (b !== btn) b.classList.add('disabled');
        });

        socket.emit('submit-answer', { answer: index });
    });
});
