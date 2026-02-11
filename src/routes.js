const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { state, loadQuestions, questionsPath } = require('./gameState');
const { log, getLocalIp } = require('./utils');

function setupRoutes(app, upload, io, PORT) {
    const LOCAL_IP = getLocalIp();

    // --- API Routes ---

    // Get Questions
    app.get('/api/questions', (req, res) => {
        res.json(state.questions);
    });

    // Save Questions
    app.post('/api/questions', (req, res) => {
        const newQuestions = req.body;
        if (!Array.isArray(newQuestions)) {
            return res.status(400).json({ error: 'Formato inválido' });
        }

        // Validate basic structure
        const valid = newQuestions.every(q => q.question && Array.isArray(q.options));
        if (!valid) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        fs.writeFile(questionsPath, JSON.stringify(newQuestions, null, 2), (err) => {
            if (err) {
                log.error('Erro ao salvar perguntas:', err);
                return res.status(500).json({ error: 'Erro ao salvar arquivo' });
            }
            log.info('Perguntas atualizadas via Admin!');

            // Reload state
            loadQuestions();

            // Reset game to apply changes
            state.game.phase = 'waiting';
            state.game.currentQuestion = -1;
            state.game.answers.clear();
            state.game.players.forEach(p => {
                p.score = 0;
                p.streak = 0;
                p.answers = [];
            });

            io.to('host-room').emit('game-reset');
            io.to('players-room').emit('game-reset');

            res.json({ success: true });
        });
    });

    // QR Code
    app.get('/api/qrcode', async (req, res) => {
        try {
            const protocol = req.protocol;
            // Use local IP instead of host header to ensure mobile access works
            const url = `${protocol}://${LOCAL_IP}:${PORT}/player?pin=${state.game.pin}`;
            const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
            res.json({ qr, pin: state.game.pin, url });
        } catch (err) {
            res.status(500).json({ error: 'Erro ao gerar QR Code' });
        }
    });

    // Upload
    app.post('/api/upload', upload.single('image'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }
        const url = `/uploads/${req.file.filename}`;
        res.json({ url });
    });

    // --- Page Routes ---
    app.get('/painel', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    });

    app.get('/creator', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/creator.html'));
    });

    app.get('/host', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/host.html'));
    });

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    app.get('/player', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/player.html'));
    });
}

module.exports = setupRoutes;
