const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { state, loadQuestions, loadSettings } = require('./gameState');
const { log, getLocalIp } = require('./utils');
const { query, pool } = require('./db');

function setupRoutes(app, upload, io, PORT) {
    const LOCAL_IP = getLocalIp();

    // --- API Routes ---

    // Get Questions
    app.get('/api/questions', async (req, res) => {
        // Optional: reload from DB to ensure fresh data
        await loadQuestions();
        res.json(state.questions);
    });

    // Get Settings
    app.get('/api/settings', async (req, res) => {
        await loadSettings();
        res.json(state.settings);
    });

    // Update Settings
    app.post('/api/settings', async (req, res) => {
        const newSettings = req.body;
        if (!newSettings || !newSettings.theme) {
            return res.status(400).json({ error: 'Formato inválido' });
        }

        try {
            await query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                ['global', newSettings]
            );

            log.info(`Configurações atualizadas: ${newSettings.theme}`);

            // Reload state
            await loadSettings();

            // Emit to everyone
            io.emit('game-settings', state.settings);

            res.json({ success: true });
        } catch (err) {
            log.error('Erro ao salvar configurações no DB:', err);
            return res.status(500).json({ error: 'Erro ao salvar configurações' });
        }
    });

    // Save Questions
    app.post('/api/questions', async (req, res) => {
        const newQuestions = req.body;
        if (!Array.isArray(newQuestions)) {
            return res.status(400).json({ error: 'Formato inválido' });
        }

        // Validate basic structure
        const valid = newQuestions.every(q => q.question && Array.isArray(q.options));
        if (!valid) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Full replace strategy (simplest for now)
            await client.query('DELETE FROM questions');

            const queryText = `
                INSERT INTO questions (id, type, question, time, image, options, correct)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;

            for (const q of newQuestions) {
                // Ensure ID is unique/exists. Front sends timestamp as ID.
                const id = q.id || Date.now();
                await client.query(queryText, [
                    id,
                    q.type || 'quiz',
                    q.question,
                    q.time || 20,
                    q.image || '',
                    JSON.stringify(q.options),
                    q.correct || 0
                ]);
            }

            await client.query('COMMIT');
            log.info('Perguntas atualizadas via Admin (DB)!');

            // Reload state
            await loadQuestions();

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
        } catch (err) {
            await client.query('ROLLBACK');
            log.error('Erro ao salvar perguntas no DB:', err);
            return res.status(500).json({ error: 'Erro ao salvar perguntas' });
        } finally {
            client.release();
        }
    });

    // QR Code
    app.get('/api/qrcode', async (req, res) => {
        try {
            // Railway uses reverse proxy: x-forwarded-host has the public domain
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.headers['x-forwarded-host'] || req.get('host');
            const url = `${protocol}://${host}/player?pin=${state.game.pin}`;
            const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
            res.json({ qr, pin: state.game.pin, url });
        } catch (err) {
            res.status(500).json({ error: 'Erro ao gerar QR Code' });
        }
    });

    // Upload
    app.post('/api/upload', upload.single('image'), (req, res) => {
        if (!req.file) {
            log.error('Upload falhou: Nenhum arquivo recebido.');
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        log.info('📁 Arquivo recebido:', {
            mimetype: req.file.mimetype,
            path: req.file.path,
            filename: req.file.filename
        });

        // Cloudinary returns .path (full URL), Local returns .filename
        let url;
        if (req.file.path && req.file.path.startsWith('http')) {
            url = req.file.path; // Cloudinary URL
        } else {
            // Local fallback
            // Return full URL so frontend (Vercel) can display images from backend (Railway)
            const BACKEND_URL = process.env.RAILWAY_PUBLIC_DOMAIN
                ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
                : '';
            url = `${BACKEND_URL}/uploads/${req.file.filename}`;
            log.warn('⚠️ Usando URL local (Cloudinary não retornou URL HTTP):', url);
        }

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
