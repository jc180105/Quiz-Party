const { log, calculateScore } = require('./utils');
const { state, getPlayerList, getRanking, generatePin } = require('./gameState');

function setupSocket(io) {
    const gameState = state.game;

    // --- Game Logic Helpers ---
    function nextQuestion() {
        gameState.currentQuestion++;
        const questions = state.questions; // Always get latest

        if (gameState.currentQuestion >= questions.length) {
            // Game over — show podium
            gameState.phase = 'podium';
            const ranking = getRanking();
            io.to('host-room').emit('show-podium', { ranking });
            io.to('players-room').emit('show-final-rank', { ranking });
            return;
        }

        const q = questions[gameState.currentQuestion];
        gameState.phase = 'question';
        gameState.answers.clear();
        gameState.timeLeft = q.time || 20;

        // Send question to host
        io.to('host-room').emit('show-question', {
            index: gameState.currentQuestion,
            total: questions.length,
            question: q.question,
            image: q.image,
            options: q.options,
            time: q.time,
            correct: q.correct
        });

        // Send options to players
        io.to('players-room').emit('show-options', {
            index: gameState.currentQuestion,
            total: questions.length,
            question: q.question,
            options: q.options,
            time: q.time || 20
        });

        // Start timer
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = setInterval(() => {
            gameState.timeLeft--;
            io.to('host-room').emit('timer-tick', { timeLeft: gameState.timeLeft });
            io.to('players-room').emit('timer-tick', { timeLeft: gameState.timeLeft });

            if (gameState.timeLeft <= 0) {
                clearInterval(gameState.timerInterval);
                endQuestion();
            }
        }, 1000);
    }

    function endQuestion() {
        gameState.phase = 'results';
        const questions = state.questions;
        const q = questions[gameState.currentQuestion];

        // Count answers
        const answerCounts = [0, 0, 0, 0];
        gameState.answers.forEach((a) => {
            if (a.answer >= 0 && a.answer < 4) answerCounts[a.answer]++;
        });

        const ranking = getRanking();

        io.to('host-room').emit('show-results', {
            correct: q.correct,
            correctText: q.options[q.correct].text,
            answerCounts,
            ranking: ranking.slice(0, 5),
            isLast: gameState.currentQuestion >= questions.length - 1
        });

        io.to('players-room').emit('question-ended', {
            correct: q.correct
        });
    }

    // --- Socket Events ---
    io.on('connection', (socket) => {
        log.debug(`Conectado: ${socket.id}`);

        // Host connects
        // Host connects (New Session Logic)
        socket.on('host-join', () => {
            gameState.hostSocket = socket.id;

            // Reset Game & Generate New PIN
            gameState.pin = generatePin();
            gameState.phase = 'waiting';
            gameState.currentQuestion = -1;
            gameState.players.clear();
            gameState.answers.clear();
            if (gameState.timerInterval) clearInterval(gameState.timerInterval);

            socket.join('host-room');

            // Notify Host
            socket.emit('game-pin', { pin: gameState.pin });
            socket.emit('player-list', []);

            // Notify Players (Force Reset)
            io.to('players-room').emit('game-reset');

            log.info(`Host iniciou nova sessão. Novo PIN: ${gameState.pin}`);
        });

        // Player joins
        socket.on('player-join', (data) => {
            if (data.pin !== gameState.pin) {
                socket.emit('join-error', { message: 'PIN inválido!' });
                return;
            }
            if (gameState.phase !== 'waiting') {
                socket.emit('join-error', { message: 'O quiz já começou!' });
                return;
            }

            gameState.players.set(socket.id, {
                name: data.name,
                avatar: data.avatar || null,
                score: 0,
                streak: 0,
                answers: []
            });

            socket.join('players-room');
            socket.emit('join-success', { name: data.name, avatar: data.avatar });
            io.to('host-room').emit('player-list', getPlayerList());
            log.info(`Jogador "${data.name}" entrou. Avatar: ${!!data.avatar}`);
        });

        // Host starts game
        socket.on('start-game', () => {
            if (socket.id !== gameState.hostSocket) return;
            log.info('Quiz iniciado!');
            gameState.currentQuestion = -1;
            nextQuestion();
        });

        // Host next question
        socket.on('next-question', () => {
            if (socket.id !== gameState.hostSocket) return;
            nextQuestion();
        });

        // Submit answer
        socket.on('submit-answer', (data) => {
            const player = gameState.players.get(socket.id);
            if (!player || gameState.phase !== 'question') return;
            if (gameState.answers.has(socket.id)) return;

            const questions = state.questions;
            const question = questions[gameState.currentQuestion];
            const isCorrect = Number(data.answer) === Number(question.correct);

            log.debug(`[ANSWER] Player: ${player.name} | Ans: ${data.answer} | Correct: ${question.correct} | Result: ${isCorrect} | OldStreak: ${player.streak}`);

            if (isCorrect) {
                player.streak++;
                const points = calculateScore(gameState.timeLeft, question.time, player.streak);
                player.score += points;
                gameState.answers.set(socket.id, { answer: data.answer, correct: true, points });
            } else {
                player.streak = 0;
                gameState.answers.set(socket.id, { answer: data.answer, correct: false, points: 0 });
            }

            socket.emit('answer-result', {
                correct: isCorrect,
                points: isCorrect ? gameState.answers.get(socket.id).points : 0,
                streak: player.streak
            });

            io.to('host-room').emit('answer-count', {
                count: gameState.answers.size,
                total: gameState.players.size
            });

            if (gameState.answers.size >= gameState.players.size) {
                clearInterval(gameState.timerInterval);
                endQuestion();
            }
        });

        // Disconnect
        socket.on('disconnect', () => {
            if (gameState.players.has(socket.id)) {
                const name = gameState.players.get(socket.id).name;
                gameState.players.delete(socket.id);
                io.to('host-room').emit('player-list', getPlayerList());
                log.info(`Jogador "${name}" saiu. Total: ${gameState.players.size}`);
            }
            if (socket.id === gameState.hostSocket) {
                log.info('Host desconectou.');
                gameState.hostSocket = null;
            }
        });

        // Reset
        socket.on('reset-game', () => {
            if (socket.id !== gameState.hostSocket) return;
            const { generatePin } = require('./gameState'); // Import dynamically to avoid cycle if needed, or stick to module import
            // Note: generatePin is in gameState module

            gameState.phase = 'waiting';
            gameState.currentQuestion = -1;
            gameState.pin = require('./gameState').generatePin(); // Recalculate pin
            // Actually I should import generatePin at top

            gameState.players.forEach(p => {
                p.score = 0;
                p.streak = 0;
                p.answers = [];
            });
            gameState.answers.clear();
            clearInterval(gameState.timerInterval);

            io.to('host-room').emit('game-pin', { pin: gameState.pin });
            io.to('host-room').emit('game-reset');
            io.to('players-room').emit('game-reset');
            log.info(`Jogo resetado. Novo PIN: ${gameState.pin}`);
        });
    });
}

module.exports = setupSocket;
