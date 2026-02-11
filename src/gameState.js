const fs = require('fs');
const path = require('path');
const { log } = require('./utils');
const { query } = require('./db');

const state = {
    questions: [],
    settings: { theme: 'default' },
    game: {
        pin: generatePin(),
        phase: 'waiting', // waiting | question | results | podium
        currentQuestion: -1,
        players: new Map(),
        answers: new Map(),
        timerInterval: null,
        timeLeft: 0,
        hostSocket: null
    }
};

async function loadQuestions() {
    try {
        const res = await query('SELECT * FROM questions ORDER BY id ASC');
        if (res.rows.length > 0) {
            state.questions = res.rows.map(row => ({
                id: parseInt(row.id),
                type: row.type,
                question: row.question,
                time: row.time,
                image: row.image,
                options: row.options,
                correct: row.correct
            }));
            log.info(`Perguntas carregadas do DB: ${state.questions.length}`);
        } else {
            state.questions = [];
            log.warn('Nenhuma pergunta encontrada no banco de dados.');
        }
    } catch (e) {
        log.error('Erro ao carregar perguntas do DB:', e);
        state.questions = [];
    }
    return state.questions;
}

// Initial load is now async, handled in server.js or initDB
// We can leave this empty or removed, but routes call it.
// Ideally, routes should call it and await.

async function loadSettings() {
    try {
        const res = await query('SELECT value FROM settings WHERE key = $1', ['global']);
        if (res.rows.length > 0) {
            state.settings = res.rows[0].value;
            log.info(`Configurações carregadas: ${JSON.stringify(state.settings)}`);
        } else {
            state.settings = { theme: 'default' };
            // Save default
            await query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['global', state.settings]);
            log.warn('Configurações padrão criadas.');
        }
    } catch (e) {
        log.error('Erro ao carregar configurações:', e);
        state.settings = { theme: 'default' };
    }
    return state.settings;
}

function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPlayerList() {
    const list = [];
    state.game.players.forEach((p, id) => {
        list.push({ id, name: p.name, score: p.score, streak: p.streak, avatar: p.avatar });
    });
    return list;
}

function getRanking() {
    return getPlayerList().sort((a, b) => b.score - a.score);
}

module.exports = {
    state,
    loadQuestions,
    generatePin,
    getPlayerList,
    getRanking,
    getRanking,
    loadSettings
};
